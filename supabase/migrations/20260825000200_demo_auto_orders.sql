-- ---------------------------------------------------------------------------
-- Istanbul Fast Food — 26. Des commandes qui tombent toutes seules
--
-- POURQUOI
-- Pour tester l'app livreur, il fallait jusqu'ici lancer l'app client en
-- parallèle et passer une commande à la main. Sur une seule machine, c'est
-- impossible : on ne fait pas tourner deux apps Expo et deux sessions en même
-- temps. Le mode démo joue donc aussi le client — une commande complète
-- (articles, adresse à Kinshasa, paiement) apparaît à intervalle régulier et
-- suit tout le parcours jusqu'au pool de courses.
--
-- Le livreur connecté n'a plus qu'à regarder son écran : la course arrive.
--
-- RÉGLAGES (public.app_config)
--   demo_orders                     'on' (défaut) | '' pour couper
--   demo_orders_interval_seconds    délai entre deux commandes (120 s)
--   demo_orders_max_open            commandes en cours au-delà desquelles on
--                                   arrête d'en créer (2)
--   demo_pool_grace_online_seconds  temps laissé à un vrai livreur connecté
--                                   avant que le fantôme se serve (600 s)
--
-- TOUT COUPER (mise en production réelle) :
--   update public.app_config set value = '' where key in ('demo_mode', 'demo_orders');
-- ---------------------------------------------------------------------------

insert into public.app_config (key, value) values
  ('demo_orders', 'on'),
  ('demo_orders_interval_seconds', '120'),
  ('demo_orders_max_open', '2'),
  ('demo_pool_grace_online_seconds', '600')
on conflict (key) do nothing;

-- ===========================================================================
-- Le client fantôme — un vrai compte, comme le livreur fantôme, pour que les
-- jointures et la RLS se comportent exactement comme en production.
-- ===========================================================================
-- Le compte est retrouvé par son e-mail, jamais par un id en dur : un compte
-- de démo créé à la main dans une session précédente porte un autre uuid, et
-- un INSERT aveugle se casse sur l'unicité de l'e-mail.
do $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where email = 'client-demo@istanbul.cd' limit 1;

  if v_id is null then
    v_id := 'de300000-0000-4000-a000-00000000c001';
    insert into auth.users (id, email, raw_user_meta_data)
    values (v_id, 'client-demo@istanbul.cd',
            jsonb_build_object('full_name', 'Client démo'))
    on conflict (id) do nothing;
  end if;

  update public.profiles
  set full_name = coalesce(nullif(full_name, ''), 'Client démo'),
      phone     = coalesce(phone, '+243890000003')
  where id = v_id;
end;
$$;

-- ===========================================================================
-- Fabrique une commande plausible : 1 à 3 articles tirés de la carte, une
-- adresse dans Kinshasa à quelques kilomètres du restaurant, un paiement en
-- espèces deux fois sur trois (c'est le cas qui intéresse le livreur : il a
-- de l'argent à encaisser).
--
-- Renvoie l'id de la commande créée, ou NULL si ce n'était pas le moment.
-- ===========================================================================
create or replace function public.fn_demo_seed_order()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer  uuid;
  v_rest      public.restaurants%rowtype;
  v_interval  integer;
  v_max_open  integer;
  v_open      integer;
  v_last      timestamptz;
  v_order     uuid;
  v_cart      jsonb;
  v_subtotal  integer := 0;
  v_fee       integer;
  v_lines     integer;
  v_lat       double precision;
  v_lng       double precision;
  v_cash      boolean;
  v_name      text;
  v_commune   text;
  c_names    constant text[] := array[
    'Grâce Ilunga', 'Patrick Kabeya', 'Sarah Mbala', 'Joseph Tshibangu',
    'Nadine Lokwa', 'Éric Mukendi', 'Chantal Nsimba', 'Blaise Mputu'];
  c_communes constant text[] := array[
    'Gombe', 'Kintambo', 'Ngaliema', 'Limete', 'Lingwala', 'Barumbu',
    'Kalamu', 'Bandalungwa'];
  c_streets  constant text[] := array[
    'av. de la Justice', 'av. Kasa-Vubu', 'bd du 30 Juin', 'av. Colonel Ebeya',
    'av. de la Paix', 'av. Kabinda', 'av. Lukusa', 'av. Tombalbaye'];
begin
  if coalesce((select value from public.app_config where key = 'demo_mode'), '') <> 'on'
     or coalesce((select value from public.app_config where key = 'demo_orders'), '') <> 'on'
  then
    return null;
  end if;

  select * into v_rest from public.restaurants order by created_at limit 1;
  if not found then return null; end if;

  select id into v_customer from auth.users where email = 'client-demo@istanbul.cd' limit 1;
  if v_customer is null then return null; end if;

  v_interval := greatest(20, coalesce(
    (select nullif(value, '')::integer from public.app_config
     where key = 'demo_orders_interval_seconds'), 120));
  v_max_open := greatest(1, coalesce(
    (select nullif(value, '')::integer from public.app_config
     where key = 'demo_orders_max_open'), 2));

  -- Ne pas empiler : une file de dix commandes fantômes noierait les vraies.
  select count(*) into v_open from public.orders
  where status in ('NEW', 'ACCEPTED', 'PREPARING', 'READY', 'ASSIGNED', 'PICKED_UP')
    and created_at > now() - interval '6 hours';
  if v_open >= v_max_open then return null; end if;

  -- Cadence : on se cale sur la dernière commande fantôme, pas sur une
  -- horloge interne — ainsi le rythme survit à un redémarrage du cron.
  select max(created_at) into v_last from public.orders where customer_id = v_customer;
  if v_last is not null and now() - v_last < make_interval(secs => v_interval) then
    return null;
  end if;

  perform set_config('app.bypass_guards', 'on', true);

  -- Adresse : un point au hasard dans un rayon d'environ 2 km.
  v_lat := v_rest.latitude  + (random() - 0.5) * 0.036;
  v_lng := v_rest.longitude + (random() - 0.5) * 0.036;
  v_name    := c_names[1 + floor(random() * array_length(c_names, 1))::int];
  v_commune := c_communes[1 + floor(random() * array_length(c_communes, 1))::int];
  v_cash    := random() < 0.66;
  v_fee     := 150 + floor(random() * 4)::int * 50;   -- 1,50 $ à 3,00 $

  -- Le panier AVANT la commande : `orders_total_consistent` exige
  -- total = subtotal + frais dès l'INSERT. Créer la ligne à zéro puis la
  -- recaler après coup viole la contrainte et fait échouer tout le semis.
  v_lines := 1 + floor(random() * 3)::int;

  with pick as (
    select p.id, p.name, p.image_url, p.base_price,
           (1 + floor(random() * 2))::int as qty
    from public.products p
    where p.restaurant_id = v_rest.id and p.is_active and p.is_available
    order by random()
    limit v_lines
  )
  select jsonb_agg(jsonb_build_object(
           'id', id, 'name', name, 'image', image_url,
           'price', base_price, 'qty', qty)),
         coalesce(sum(base_price * qty), 0)
  into v_cart, v_subtotal
  from pick;

  if v_cart is null or v_subtotal = 0 then
    return null; -- carte vide : la commande n'aurait aucun sens
  end if;

  insert into public.orders (
    restaurant_id, customer_id, status, fulfillment,
    delivery_address, delivery_commune, delivery_latitude, delivery_longitude,
    contact_phone, contact_name, currency,
    subtotal, delivery_fee, total, distance_km, eta_minutes,
    customer_note
  ) values (
    v_rest.id, v_customer, 'NEW', 'DELIVERY',
    (1 + floor(random() * 90))::int || ' '
      || c_streets[1 + floor(random() * array_length(c_streets, 1))::int],
    v_commune, v_lat, v_lng,
    '+2438' || lpad(floor(random() * 100000000)::bigint::text, 8, '0'),
    v_name, v_rest.currency,
    v_subtotal, v_fee, v_subtotal + v_fee,
    round(public.fn_distance_km(v_rest.latitude, v_rest.longitude, v_lat, v_lng)::numeric, 2),
    20 + floor(random() * 20)::int,
    case when random() < 0.3 then 'Sonnez au portail, merci.' else null end
  )
  returning id into v_order;

  insert into public.order_items (
    order_id, product_id, product_name, product_image,
    unit_price, quantity, line_total
  )
  select v_order,
         (item->>'id')::uuid, item->>'name', item->>'image',
         (item->>'price')::integer, (item->>'qty')::smallint,
         (item->>'price')::integer * (item->>'qty')::integer
  from jsonb_array_elements(v_cart) as item;

  insert into public.payments (order_id, provider, status, amount, currency, paid_at)
  values (
    v_order,
    case when v_cash then 'CASH' else 'MPESA' end::public.payment_provider,
    case when v_cash then 'PENDING' else 'PAID' end::public.payment_status,
    v_subtotal + v_fee, v_rest.currency,
    case when v_cash then null else now() end
  );

  return v_order;
exception when others then
  raise warning 'fn_demo_seed_order: %', sqlerrm;
  return null;
end;
$$;

revoke all on function public.fn_demo_seed_order() from public, anon, authenticated;

-- ===========================================================================
-- Le tick appelle le semeur, et laisse sa chance au livreur humain.
--
-- Seul changement de fond par rapport à la migration 25 : le délai de grâce
-- avant que le fantôme se serve dans le pool devient beaucoup plus long dès
-- qu'un livreur humain est connecté et disponible. Sinon la course lui filait
-- sous le nez pendant qu'il lisait la carte.
-- ===========================================================================
create or replace function public.fn_demo_tick()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c_ghost      constant uuid := 'de300000-0000-4000-a000-000000000002';
  v_driver     public.drivers%rowtype;
  v_rest       public.restaurants%rowtype;
  v_order      record;
  v_delivery   record;
  v_pool       record;
  v_grace      integer;
  v_human      boolean;
  v_from_lat   double precision;
  v_from_lng   double precision;
  v_to_lat     double precision;
  v_to_lng     double precision;
  v_p          double precision;
  v_lat        double precision;
  v_lng        double precision;
  v_route      jsonb;
  c_pickup_leg_s   constant double precision := 45;
  c_dropoff_leg_s  constant double precision := 90;
begin
  if coalesce((select value from public.app_config where key = 'demo_mode'), '') <> 'on' then
    return;
  end if;

  select * into v_driver from public.drivers where id = c_ghost;
  if not found then return; end if;

  select * into v_rest from public.restaurants where id = v_driver.restaurant_id;
  if not found then return; end if;

  perform set_config('app.bypass_guards', 'on', true);

  -- Le client fantôme passe commande.
  perform public.fn_demo_seed_order();

  -- Un livreur humain est-il en train de regarder son écran ?
  select exists (
    select 1 from public.drivers d
    where d.id <> c_ghost
      and d.restaurant_id = v_driver.restaurant_id
      and d.is_approved
      and d.availability = 'AVAILABLE'
  ) into v_human;

  v_grace := greatest(0, coalesce(
    (select nullif(value, '')::integer from public.app_config
     where key = case when v_human then 'demo_pool_grace_online_seconds'
                      else 'demo_pool_grace_seconds' end),
    case when v_human then 600 else 60 end));

  -- ------------------------- côté restaurant ------------------------------
  for v_order in
    select * from public.orders
    where status in ('NEW', 'ACCEPTED', 'PREPARING', 'READY')
      and created_at > now() - interval '6 hours'
  loop
    case v_order.status
      when 'NEW' then
        if now() - v_order.created_at >= interval '10 seconds' then
          perform public.fn_advance_order_status(v_order.id, 'ACCEPTED');
        end if;

      when 'ACCEPTED' then
        if now() - v_order.accepted_at >= interval '15 seconds' then
          perform public.fn_advance_order_status(v_order.id, 'PREPARING');
        end if;

      when 'PREPARING' then
        if now() - v_order.accepted_at >= interval '40 seconds' then
          perform public.fn_advance_order_status(v_order.id, 'READY');
        end if;

      when 'READY' then
        if v_order.fulfillment = 'PICKUP' then
          if now() - v_order.ready_at >= interval '60 seconds' then
            perform public.fn_advance_order_status(v_order.id, 'DELIVERED');
            update public.payments set status = 'PAID', paid_at = now()
            where order_id = v_order.id and status = 'PENDING';
          end if;
        else
          -- Filet : le trigger de dispatch l'a déjà fait dans le cas normal.
          perform public.fn_offer_delivery_to_pool(v_order.id);
        end if;
    end case;
  end loop;

  -- ------------------- le fantôme récupère les invendus --------------------
  if v_driver.availability <> 'BUSY'
     and not exists (
       select 1 from public.deliveries
       where driver_id = v_driver.id
         and status in ('ACCEPTED', 'HEADING_TO_RESTAURANT', 'PICKED_UP',
                        'HEADING_TO_CUSTOMER', 'ARRIVED'))
  then
    for v_pool in
      select d.id, d.order_id
      from public.deliveries d
      join public.orders o on o.id = d.order_id
      where d.driver_id is null
        and d.status = 'OFFERED'
        and o.restaurant_id = v_driver.restaurant_id
        and d.offered_at <= now() - make_interval(secs => v_grace)
        and d.created_at > now() - interval '6 hours'
      order by d.offered_at
      limit 1
    loop
      update public.deliveries
      set driver_id = v_driver.id, status = 'ACCEPTED', accepted_at = now()
      where id = v_pool.id and driver_id is null;

      if found then
        update public.drivers set availability = 'BUSY' where id = v_driver.id;
        if (select status from public.orders where id = v_pool.order_id) = 'READY' then
          perform public.fn_advance_order_status(v_pool.order_id, 'ASSIGNED');
        end if;
      end if;
    end loop;
  end if;

  -- ------------------------- côté livreur ---------------------------------
  for v_delivery in
    select d.*, o.delivery_latitude, o.delivery_longitude
    from public.deliveries d
    join public.orders o on o.id = d.order_id
    where d.driver_id = v_driver.id
      and d.status in ('OFFERED', 'ACCEPTED', 'HEADING_TO_RESTAURANT',
                       'PICKED_UP', 'HEADING_TO_CUSTOMER', 'ARRIVED')
      and d.created_at > now() - interval '6 hours'
  loop
    v_from_lat := v_rest.latitude  - 0.011;
    v_from_lng := v_rest.longitude + 0.008;
    v_to_lat := coalesce(v_delivery.delivery_latitude,  v_rest.latitude  + 0.013);
    v_to_lng := coalesce(v_delivery.delivery_longitude, v_rest.longitude - 0.009);

    case v_delivery.status
      when 'OFFERED' then
        if now() - v_delivery.offered_at >= interval '10 seconds' then
          update public.deliveries
          set status = 'ACCEPTED', accepted_at = now()
          where id = v_delivery.id;
          perform public.fn_demo_route(v_delivery.id, 'pickup',
            v_from_lat, v_from_lng, v_rest.latitude, v_rest.longitude);
        end if;

      when 'ACCEPTED' then
        update public.deliveries
        set status = 'HEADING_TO_RESTAURANT', heading_to_restaurant_at = now()
        where id = v_delivery.id;
        perform public.fn_demo_route(v_delivery.id, 'pickup',
          v_from_lat, v_from_lng, v_rest.latitude, v_rest.longitude);

      when 'HEADING_TO_RESTAURANT' then
        v_p := least(1.0, extract(epoch from now() - v_delivery.heading_to_restaurant_at)
                          / c_pickup_leg_s);

        v_route := public.fn_demo_route(v_delivery.id, 'pickup',
          v_from_lat, v_from_lng, v_rest.latitude, v_rest.longitude);

        if v_route is not null then
          select o_lat, o_lng into v_lat, v_lng
          from public.fn_demo_point_along(v_route, v_p);
        else
          v_lat := v_from_lat + (v_rest.latitude  - v_from_lat) * v_p;
          v_lng := v_from_lng + (v_rest.longitude - v_from_lng) * v_p;
        end if;

        insert into public.driver_locations (driver_id, delivery_id, latitude, longitude, speed_kmh)
        values (v_driver.id, v_delivery.id, v_lat, v_lng, 24);
        update public.drivers
        set last_latitude = v_lat, last_longitude = v_lng, last_location_at = now()
        where id = v_driver.id;

        if v_p >= 1.0 then
          update public.deliveries
          set status = 'PICKED_UP', picked_up_at = now()
          where id = v_delivery.id;
          perform public.fn_advance_order_status(v_delivery.order_id, 'PICKED_UP');
          perform public.fn_demo_route(v_delivery.id, 'dropoff',
            v_rest.latitude, v_rest.longitude, v_to_lat, v_to_lng);
        end if;

      when 'PICKED_UP' then
        update public.deliveries
        set status = 'HEADING_TO_CUSTOMER', heading_to_customer_at = now()
        where id = v_delivery.id;

      when 'HEADING_TO_CUSTOMER' then
        v_p := least(1.0, extract(epoch from now() - v_delivery.heading_to_customer_at)
                          / c_dropoff_leg_s);

        v_route := public.fn_demo_route(v_delivery.id, 'dropoff',
          v_rest.latitude, v_rest.longitude, v_to_lat, v_to_lng);

        if v_route is not null then
          select o_lat, o_lng into v_lat, v_lng
          from public.fn_demo_point_along(v_route, v_p);
        else
          v_lat := v_rest.latitude  + (v_to_lat - v_rest.latitude)  * v_p;
          v_lng := v_rest.longitude + (v_to_lng - v_rest.longitude) * v_p;
        end if;

        insert into public.driver_locations (driver_id, delivery_id, latitude, longitude, speed_kmh)
        values (v_driver.id, v_delivery.id, v_lat, v_lng, 26);
        update public.drivers
        set last_latitude = v_lat, last_longitude = v_lng, last_location_at = now()
        where id = v_driver.id;

        if v_p >= 1.0 then
          update public.deliveries
          set status = 'ARRIVED', arrived_at = now()
          where id = v_delivery.id;
        end if;

      when 'ARRIVED' then
        if now() - v_delivery.arrived_at >= interval '30 seconds' then
          update public.deliveries
          set status = 'DELIVERED', delivered_at = now()
          where id = v_delivery.id;

          perform public.fn_advance_order_status(v_delivery.order_id, 'DELIVERED');

          update public.payments set status = 'PAID', paid_at = now()
          where order_id = v_delivery.order_id and status = 'PENDING';

          update public.drivers
          set total_deliveries = total_deliveries + 1,
              total_earnings   = total_earnings + v_delivery.payout_amount,
              availability     = 'AVAILABLE'
          where id = v_driver.id;
        end if;
    end case;
  end loop;
exception when others then
  raise warning 'fn_demo_tick: %', sqlerrm;
end;
$$;

revoke execute on function public.fn_demo_tick from public, anon, authenticated;
