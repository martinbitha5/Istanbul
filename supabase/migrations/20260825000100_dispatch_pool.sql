-- ---------------------------------------------------------------------------
-- Istanbul Fast Food — 25. Répartition par pool (le livreur accepte lui-même)
--
-- POURQUOI
-- Jusqu'ici, une commande prête était assignée d'office : soit au livreur le
-- plus proche (fn_auto_assign_nearest), soit au livreur fantôme du mode démo.
-- La ligne `deliveries` naissait donc TOUJOURS avec un `driver_id`. Or la
-- policy `deliveries_read_driver` ne montre à un livreur que ses propres
-- courses ou celles **sans livreur** en statut OFFERED — autrement dit, un
-- vrai livreur connecté ne voyait jamais rien à accepter, l'écran « Courses
-- disponibles » restait vide par construction.
--
-- CE QUE FAIT CETTE MIGRATION
--   1. La commande prête est publiée dans un pool : une course OFFERED sans
--      livreur, visible par tous les livreurs approuvés du restaurant.
--   2. `fn_claim_delivery` : le livreur prend la course. Atomique et en
--      SECURITY DEFINER — un simple UPDATE ne peut pas passer, la policy
--      `deliveries_update_driver` exige `driver_id = <moi>` sur la ligne
--      d'AVANT, ce qui est faux tant que la course n'appartient à personne.
--   3. Le livreur fantôme de la démo ne se sert plus que dans les restes :
--      il ne prend une course du pool qu'après un délai de grâce, si aucun
--      humain ne l'a acceptée. Le parcours client reste donc complet tout
--      seul, mais un livreur connecté est toujours prioritaire.
--
-- RÉGLAGES (public.app_config)
--   dispatch_mode              'POOL' (défaut) | 'AUTO' (ancien comportement)
--   demo_pool_grace_seconds    délai avant que le fantôme se serve (60 s)
-- ---------------------------------------------------------------------------

insert into public.app_config (key, value) values
  ('dispatch_mode', 'POOL'),
  ('demo_pool_grace_seconds', '60')
on conflict (key) do nothing;

-- ===========================================================================
-- A. PUBLIER UNE COURSE DANS LE POOL
--
-- Volontairement silencieuse : appelée depuis un trigger sur `orders`, elle
-- ne doit jamais empêcher une commande de passer READY.
-- ===========================================================================
create or replace function public.fn_offer_delivery_to_pool(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order   public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_cash    integer := 0;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.fulfillment <> 'DELIVERY' or v_order.status <> 'READY' then
    return;
  end if;

  if exists (select 1 from public.deliveries where order_id = p_order_id) then
    return; -- déjà publiée, assignée à la main, ou reprise par un tick
  end if;

  perform set_config('app.bypass_guards', 'on', true);

  select * into v_payment from public.payments where order_id = p_order_id limit 1;
  if v_payment.provider = 'CASH' and v_payment.status <> 'PAID' then
    v_cash := v_order.total;
  end if;

  -- driver_id à NULL : c'est ce qui rend la course visible à tout le monde.
  -- La commande reste READY — elle ne passe ASSIGNED qu'à l'acceptation.
  insert into public.deliveries (
    order_id, driver_id, status, payout_amount, cash_to_collect,
    distance_km, eta_minutes
  ) values (
    p_order_id, null, 'OFFERED',
    greatest(coalesce(v_order.delivery_fee, 0), 100), v_cash,
    v_order.distance_km, v_order.eta_minutes
  )
  on conflict (order_id) do nothing;
exception when others then
  raise warning 'fn_offer_delivery_to_pool: %', sqlerrm;
end;
$$;

revoke all on function public.fn_offer_delivery_to_pool(uuid) from public, anon, authenticated;

-- ===========================================================================
-- B. AIGUILLAGE AU PASSAGE « PRÊTE »
-- ===========================================================================
create or replace function public.fn_trg_auto_assign()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text;
begin
  v_mode := upper(coalesce(
    (select value from public.app_config where key = 'dispatch_mode'), 'POOL'));

  if v_mode = 'AUTO' then
    -- Ancien comportement : le plus proche reçoit la course, sans la choisir.
    perform public.fn_auto_assign_nearest(new.id);
  else
    perform public.fn_offer_delivery_to_pool(new.id);
  end if;

  return new;
end;
$$;

-- Le nom disait « auto_assign » alors que le trigger arbitre maintenant entre
-- deux modes : on le renomme pour que la prochaine lecture ne mente pas.
drop trigger if exists trg_orders_auto_assign on public.orders;
drop trigger if exists trg_orders_dispatch on public.orders;
create trigger trg_orders_dispatch
  after update of status on public.orders
  for each row
  when (new.status = 'READY')
  execute function public.fn_trg_auto_assign();

-- ===========================================================================
-- C. LE LIVREUR PREND LA COURSE
--
-- Deux entrées, un seul chemin : une course du pool (`driver_id` nul) ou une
-- course que le gérant lui a nommément confiée. Tout est verrouillé sur une
-- seule ligne — deux livreurs qui appuient sur « Accepter » à la même seconde
-- sont sérialisés par le `for update`, et le second reçoit un refus explicite
-- au lieu d'un no-op silencieux.
-- ===========================================================================
create or replace function public.fn_claim_delivery(p_delivery_id uuid)
returns public.deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver   public.drivers%rowtype;
  v_delivery public.deliveries%rowtype;
  v_order    public.orders%rowtype;
begin
  select * into v_driver from public.drivers where id = public.fn_current_driver_id();
  if not found then
    raise exception 'Aucun compte livreur n''est associé à cette session.'
      using errcode = '42501';
  end if;

  if not v_driver.is_approved then
    raise exception 'Votre compte livreur n''est pas encore validé par le restaurant.'
      using errcode = '42501';
  end if;

  select * into v_delivery from public.deliveries where id = p_delivery_id for update;
  if not found then
    raise exception 'Course introuvable.' using errcode = 'no_data_found';
  end if;

  -- Idempotence : un double tap ou un renvoi après coupure réseau ne doit pas
  -- ressembler à un échec — la course est déjà acceptée, on la rend telle quelle.
  if v_delivery.driver_id = v_driver.id and v_delivery.status <> 'OFFERED' then
    return v_delivery;
  end if;

  -- Reste donc : le pool, ou une course que le gérant lui a confiée et qui
  -- attend encore son accord.
  if v_delivery.driver_id is distinct from v_driver.id and v_delivery.driver_id is not null then
    raise exception 'Cette course vient d''être prise par un autre livreur.';
  end if;

  if v_delivery.status <> 'OFFERED' then
    raise exception 'Cette course n''est plus disponible.';
  end if;

  select * into v_order from public.orders where id = v_delivery.order_id;
  if v_order.restaurant_id is distinct from v_driver.restaurant_id then
    raise exception 'Cette course ne dépend pas de votre restaurant.'
      using errcode = '42501';
  end if;

  perform set_config('app.bypass_guards', 'on', true);

  update public.deliveries
  set driver_id = v_driver.id,
      status    = 'ACCEPTED',
      accepted_at = now()
  where id = p_delivery_id
  returning * into v_delivery;

  update public.drivers set availability = 'BUSY' where id = v_driver.id;

  -- La commande n'est « assignée » qu'ici : tant que personne n'avait accepté,
  -- elle devait rester READY pour le restaurant et pour le client.
  if v_order.status = 'READY' then
    perform public.fn_advance_order_status(v_delivery.order_id, 'ASSIGNED');
  end if;

  return v_delivery;
end;
$$;

revoke all on function public.fn_claim_delivery(uuid) from public, anon, authenticated;
grant execute on function public.fn_claim_delivery(uuid) to authenticated;

-- ===========================================================================
-- D. NOTIFIER LE POOL
--
-- La version précédente ne prévenait que `new.driver_id` : une course sans
-- livreur ne réveillait personne. On prévient donc tous les livreurs
-- approuvés et disponibles du restaurant.
-- ===========================================================================
create or replace function public.fn_notify_delivery_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_profile uuid;
  v_customer       uuid;
  v_order_number   text;
  v_restaurant     uuid;
  v_profile        uuid;
begin
  -- 1. Course proposée nommément à un livreur (assignation manuelle ou AUTO).
  if new.driver_id is not null
     and new.status = 'OFFERED'
     and (tg_op = 'INSERT'
          or old.status is distinct from new.status
          or old.driver_id is distinct from new.driver_id)
  then
    select profile_id into v_driver_profile
    from public.drivers where id = new.driver_id;

    select o.order_number into v_order_number
    from public.orders o where o.id = new.order_id;

    if v_driver_profile is not null then
      perform public.fn_notify(
        v_driver_profile, 'DELIVERY_OFFERED', new.order_id,
        'Nouvelle course',
        'Commande ' || coalesce(v_order_number, '') || ' — gain '
          || to_char(new.payout_amount / 100.0, 'FM999990.00') || ' $.',
        jsonb_build_object('delivery_id', new.id)
      );
    end if;
    return new;
  end if;

  -- 2. Course publiée dans le pool : premier arrivé, premier servi.
  if new.driver_id is null
     and new.status = 'OFFERED'
     and (tg_op = 'INSERT' or old.driver_id is not null)
  then
    select o.order_number, o.restaurant_id into v_order_number, v_restaurant
    from public.orders o where o.id = new.order_id;

    for v_profile in
      select d.profile_id from public.drivers d
      where d.restaurant_id = v_restaurant
        and d.is_approved
        and d.availability = 'AVAILABLE'
    loop
      perform public.fn_notify(
        v_profile, 'DELIVERY_OFFERED', new.order_id,
        'Course disponible',
        'Commande ' || coalesce(v_order_number, '') || ' — gain '
          || to_char(new.payout_amount / 100.0, 'FM999990.00')
          || ' $. Premier arrivé, premier servi.',
        jsonb_build_object('delivery_id', new.id)
      );
    end loop;
    return new;
  end if;

  -- 3. Le livreur est arrivé → le client sort son code.
  if tg_op = 'UPDATE' and old.status is distinct from new.status
     and new.status = 'ARRIVED'
  then
    select o.customer_id, o.order_number into v_customer, v_order_number
    from public.orders o where o.id = new.order_id;

    perform public.fn_notify(
      v_customer, 'DRIVER_ON_THE_WAY', new.order_id,
      'Votre livreur est arrivé',
      'Il vous attend. Préparez votre code de confirmation.',
      jsonb_build_object('delivery_id', new.id, 'status', new.status)
    );
  end if;

  return new;
end;
$$;

revoke execute on function public.fn_notify_delivery_status from public, anon, authenticated;

-- ===========================================================================
-- E. LE MODE DÉMO PASSE EN SECOND
--
-- Identique à la version « suit les rues » (migration 18), à un détail près :
-- au lieu de s'attribuer la course à l'instant où elle est prête, le fantôme
-- publie dans le pool et n'y pioche qu'après le délai de grâce, s'il est
-- libre et si personne n'a accepté.
-- ===========================================================================
create or replace function public.fn_demo_tick()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver     public.drivers%rowtype;
  v_rest       public.restaurants%rowtype;
  v_order      record;
  v_delivery   record;
  v_pool       record;
  v_grace      integer;
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

  select * into v_driver from public.drivers
  where id = 'de300000-0000-4000-a000-000000000002';
  if not found then return; end if;

  select * into v_rest from public.restaurants where id = v_driver.restaurant_id;
  if not found then return; end if;

  v_grace := greatest(0, coalesce(
    (select nullif(value, '')::integer from public.app_config
     where key = 'demo_pool_grace_seconds'), 60));

  perform set_config('app.bypass_guards', 'on', true);

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
  -- Une seule course à la fois, et seulement s'il est libre : sinon la
  -- simulation téléporterait un livreur déjà en route.
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
