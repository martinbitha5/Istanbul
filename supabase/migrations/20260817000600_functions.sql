-- ---------------------------------------------------------------------------
-- Istanbul Fast Food — 06. Logique métier
--
-- Tout ce qui touche à l'argent et aux transitions de statut vit ici.
-- Le client peut recalculer pour l'affichage, mais le serveur fait autorité.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- Helpers d'identité — STABLE pour éviter la récursion dans les policies RLS
-- ===========================================================================
create or replace function public.fn_current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.fn_current_restaurant()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select restaurant_id from public.profiles where id = auth.uid();
$$;

create or replace function public.fn_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('RESTAURANT_STAFF', 'ADMIN', 'SUPER_ADMIN')
     from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.fn_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('ADMIN', 'SUPER_ADMIN')
     from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.fn_current_driver_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.drivers where profile_id = auth.uid();
$$;

-- ===========================================================================
-- Géographie — haversine. Pas de PostGIS : la précision suffit largement
-- pour tarifer des tranches de 3 km à Kinshasa.
-- ===========================================================================
create or replace function public.fn_distance_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
returns numeric
language sql
immutable
as $$
  select round(
    (6371 * 2 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) *
      power(sin(radians(lng2 - lng1) / 2), 2)
    )))::numeric,
    2
  );
$$;

-- Distance routière approchée : vol d'oiseau x 1.35 (facteur de détour urbain).
create or replace function public.fn_road_distance_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
returns numeric
language sql
immutable
as $$
  select round(public.fn_distance_km(lat1, lng1, lat2, lng2) * 1.35, 2);
$$;

-- ===========================================================================
-- Frais de livraison : trouve la zone correspondant à la distance
-- ===========================================================================
create or replace function public.fn_delivery_quote(
  p_restaurant_id uuid,
  p_latitude      double precision,
  p_longitude     double precision,
  p_subtotal      integer default 0
)
returns table (
  zone_id     uuid,
  zone_name   text,
  distance_km numeric,
  fee_amount  integer,
  eta_minutes integer,
  in_range    boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rest    public.restaurants%rowtype;
  v_dist    numeric;
  v_zone    public.delivery_zones%rowtype;
begin
  select * into v_rest from public.restaurants where id = p_restaurant_id;
  if not found then
    raise exception 'Restaurant introuvable: %', p_restaurant_id
      using errcode = 'no_data_found';
  end if;

  if p_latitude is null or p_longitude is null then
    -- Sans coordonnées, on applique la zone la moins chère active.
    select * into v_zone
    from public.delivery_zones
    where restaurant_id = p_restaurant_id and is_active
    order by min_distance_km
    limit 1;

    return query select
      v_zone.id, v_zone.name, null::numeric,
      coalesce(v_zone.fee_amount, 0), coalesce(v_zone.eta_minutes, 30), true;
    return;
  end if;

  v_dist := public.fn_road_distance_km(
    v_rest.latitude, v_rest.longitude, p_latitude, p_longitude
  );

  select * into v_zone
  from public.delivery_zones
  where restaurant_id = p_restaurant_id
    and is_active
    and v_dist >= min_distance_km
    and v_dist <  max_distance_km
  order by min_distance_km
  limit 1;

  if not found then
    -- Hors zone : on renvoie in_range = false, le checkout bloquera.
    return query select
      null::uuid,
      'Hors zone de livraison'::text,
      v_dist,
      0,
      0,
      false;
    return;
  end if;

  return query select
    v_zone.id,
    v_zone.name,
    v_dist,
    case
      when v_zone.free_above is not null and p_subtotal >= v_zone.free_above then 0
      else v_zone.fee_amount
    end,
    v_zone.eta_minutes + v_rest.avg_prep_minutes,
    true;
end;
$$;

-- ===========================================================================
-- Promotions : valide un code et calcule la réduction
-- ===========================================================================
create or replace function public.fn_evaluate_promotion(
  p_restaurant_id uuid,
  p_code          text,
  p_subtotal      integer,
  p_delivery_fee  integer,
  p_profile_id    uuid default auth.uid()
)
returns table (
  promotion_id     uuid,
  title            text,
  discount_amount  integer,
  applies_to_delivery boolean,
  is_valid         boolean,
  reason           text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_promo   public.promotions%rowtype;
  v_used    integer;
  v_orders  integer;
  v_disc    integer := 0;
begin
  select * into v_promo
  from public.promotions
  where restaurant_id = p_restaurant_id
    and code is not null
    and upper(code) = upper(trim(p_code));

  if not found then
    return query select null::uuid, null::text, 0, false, false,
      'Ce code promo n''existe pas.'::text;
    return;
  end if;

  if not v_promo.is_active then
    return query select v_promo.id, v_promo.title, 0, false, false,
      'Cette promotion n''est plus active.'::text;
    return;
  end if;

  if now() < v_promo.starts_at then
    return query select v_promo.id, v_promo.title, 0, false, false,
      'Cette promotion n''a pas encore commencé.'::text;
    return;
  end if;

  if v_promo.ends_at is not null and now() > v_promo.ends_at then
    return query select v_promo.id, v_promo.title, 0, false, false,
      'Cette promotion a expiré.'::text;
    return;
  end if;

  if p_subtotal < v_promo.min_order_amount then
    return query select v_promo.id, v_promo.title, 0, false, false,
      format('Commande minimum de %s requise.',
             to_char(v_promo.min_order_amount / 100.0, 'FM999990.00 $'))::text;
    return;
  end if;

  if v_promo.usage_limit is not null and v_promo.usage_count >= v_promo.usage_limit then
    return query select v_promo.id, v_promo.title, 0, false, false,
      'Cette promotion a atteint sa limite d''utilisation.'::text;
    return;
  end if;

  select count(*) into v_used
  from public.promotion_redemptions
  where promotion_id = v_promo.id and profile_id = p_profile_id;

  if v_used >= v_promo.usage_limit_per_user then
    return query select v_promo.id, v_promo.title, 0, false, false,
      'Vous avez déjà utilisé ce code.'::text;
    return;
  end if;

  if v_promo.first_order_only then
    select count(*) into v_orders
    from public.orders
    where customer_id = p_profile_id and status <> 'CANCELLED';

    if v_orders > 0 then
      return query select v_promo.id, v_promo.title, 0, false, false,
        'Ce code est réservé à la première commande.'::text;
      return;
    end if;
  end if;

  -- Calcul de la réduction
  case v_promo.type
    when 'PERCENTAGE' then
      v_disc := (p_subtotal * v_promo.value) / 10000;
      if v_promo.max_discount_amount is not null then
        v_disc := least(v_disc, v_promo.max_discount_amount);
      end if;
    when 'FIXED_AMOUNT' then
      v_disc := least(v_promo.value, p_subtotal);
    when 'FREE_DELIVERY' then
      v_disc := p_delivery_fee;
  end case;

  return query select
    v_promo.id,
    v_promo.title,
    greatest(v_disc, 0),
    v_promo.type = 'FREE_DELIVERY',
    true,
    null::text;
end;
$$;

-- ===========================================================================
-- Passage de commande — transaction unique, serveur autoritaire sur le prix
--
-- p_items : [{ "product_id": uuid, "quantity": 2,
--              "option_ids": [uuid, ...], "note": "sans oignons" }]
-- ===========================================================================
create or replace function public.fn_place_order(
  p_restaurant_id  uuid,
  p_fulfillment    public.fulfillment_type,
  p_items          jsonb,
  p_contact_name   text,
  p_contact_phone  text,
  p_address_id     uuid    default null,
  p_delivery_notes text    default null,
  p_customer_note  text    default null,
  p_promo_code     text    default null,
  p_payment_provider public.payment_provider default 'CASH'
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer   uuid := auth.uid();
  v_rest       public.restaurants%rowtype;
  v_addr       public.addresses%rowtype;
  v_order      public.orders%rowtype;
  v_item       jsonb;
  v_product    public.products%rowtype;
  v_item_id    uuid;
  v_opt        public.product_options%rowtype;
  v_group_name text;
  v_opt_id     uuid;
  v_opts_total integer;
  v_qty        smallint;
  v_line       integer;
  v_subtotal   integer := 0;
  v_quote      record;
  v_promo      record;
  v_fee        integer := 0;
  v_service    integer := 0;
  v_discount   integer := 0;
  v_eta        integer;
  v_lat        double precision;
  v_lng        double precision;
begin
  -- Les triggers de garde (migration 07b) doivent laisser passer nos écritures.
  -- is_local = true : le drapeau meurt avec la transaction.
  perform set_config('app.bypass_guards', 'on', true);

  if v_customer is null then
    raise exception 'Authentification requise.' using errcode = '42501';
  end if;

  select * into v_rest from public.restaurants where id = p_restaurant_id;
  if not found then
    raise exception 'Restaurant introuvable.' using errcode = 'no_data_found';
  end if;

  if not v_rest.is_accepting_orders then
    raise exception 'Le restaurant n''accepte pas de commande pour le moment.'
      using errcode = 'check_violation';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'Le panier est vide.' using errcode = 'check_violation';
  end if;

  -- Adresse (livraison uniquement)
  if p_fulfillment = 'DELIVERY' then
    if p_address_id is null then
      raise exception 'Une adresse de livraison est requise.' using errcode = 'check_violation';
    end if;

    select * into v_addr
    from public.addresses
    where id = p_address_id and profile_id = v_customer;

    if not found then
      raise exception 'Adresse introuvable.' using errcode = 'no_data_found';
    end if;

    v_lat := v_addr.latitude;
    v_lng := v_addr.longitude;
  end if;

  -- Création de l'enveloppe de commande (montants remplis plus bas)
  insert into public.orders (
    restaurant_id, customer_id, fulfillment, address_id,
    delivery_address, delivery_commune, delivery_details, delivery_notes,
    delivery_latitude, delivery_longitude,
    contact_name, contact_phone, currency, customer_note
  ) values (
    p_restaurant_id, v_customer, p_fulfillment, p_address_id,
    v_addr.street, v_addr.commune, v_addr.details,
    coalesce(p_delivery_notes, v_addr.delivery_notes),
    v_lat, v_lng,
    p_contact_name, p_contact_phone, v_rest.currency, p_customer_note
  )
  returning * into v_order;

  -- Lignes de commande
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product
    from public.products
    where id = (v_item ->> 'product_id')::uuid
      and restaurant_id = p_restaurant_id
      and is_active;

    if not found then
      raise exception 'Produit indisponible: %', v_item ->> 'product_id'
        using errcode = 'no_data_found';
    end if;

    if not v_product.is_available then
      raise exception 'Produit en rupture: %', v_product.name
        using errcode = 'check_violation';
    end if;

    v_qty := greatest(1, least(99, coalesce((v_item ->> 'quantity')::smallint, 1)));
    v_opts_total := 0;

    insert into public.order_items (
      order_id, product_id, product_name, product_image,
      unit_price, options_price, quantity, line_total, note
    ) values (
      v_order.id, v_product.id, v_product.name, v_product.image_url,
      v_product.base_price, 0, v_qty, 0, v_item ->> 'note'
    )
    returning id into v_item_id;

    -- Options choisies
    if v_item ? 'option_ids' then
      for v_opt_id in
        select (value #>> '{}')::uuid from jsonb_array_elements(v_item -> 'option_ids')
      loop
        select o.* into v_opt
        from public.product_options o
        join public.product_option_groups g on g.id = o.group_id
        where o.id = v_opt_id and g.product_id = v_product.id and o.is_available;

        if not found then
          raise exception 'Option invalide pour le produit %', v_product.name
            using errcode = 'check_violation';
        end if;

        select g.name into v_group_name
        from public.product_option_groups g where g.id = v_opt.group_id;

        insert into public.order_item_options (
          order_item_id, option_id, group_name, option_name, price_delta
        ) values (
          v_item_id, v_opt.id, v_group_name, v_opt.name, v_opt.price_delta
        );

        v_opts_total := v_opts_total + v_opt.price_delta;
      end loop;
    end if;

    v_line := (v_product.base_price + v_opts_total) * v_qty;

    update public.order_items
    set options_price = v_opts_total, line_total = v_line
    where id = v_item_id;

    v_subtotal := v_subtotal + v_line;
  end loop;

  if v_subtotal < v_rest.min_order_amount then
    raise exception 'Montant minimum de commande non atteint (% requis).',
      to_char(v_rest.min_order_amount / 100.0, 'FM999990.00')
      using errcode = 'check_violation';
  end if;

  -- Frais de livraison
  if p_fulfillment = 'DELIVERY' then
    select * into v_quote
    from public.fn_delivery_quote(p_restaurant_id, v_lat, v_lng, v_subtotal);

    if not v_quote.in_range then
      raise exception 'Adresse hors zone de livraison (% km).', v_quote.distance_km
        using errcode = 'check_violation';
    end if;

    v_fee := v_quote.fee_amount;
    v_eta := v_quote.eta_minutes;

    update public.orders
    set delivery_zone_id = v_quote.zone_id, distance_km = v_quote.distance_km
    where id = v_order.id;
  else
    v_eta := v_rest.avg_prep_minutes;
  end if;

  -- Frais de service
  v_service := (v_subtotal * v_rest.service_fee_bps) / 10000;

  -- Promotion
  if p_promo_code is not null and length(trim(p_promo_code)) > 0 then
    select * into v_promo
    from public.fn_evaluate_promotion(
      p_restaurant_id, p_promo_code, v_subtotal, v_fee, v_customer
    );

    if not v_promo.is_valid then
      raise exception '%', v_promo.reason using errcode = 'check_violation';
    end if;

    v_discount := v_promo.discount_amount;

    insert into public.promotion_redemptions (promotion_id, profile_id, order_id, amount)
    values (v_promo.promotion_id, v_customer, v_order.id, v_discount);

    update public.promotions
    set usage_count = usage_count + 1
    where id = v_promo.promotion_id;

    update public.orders
    set promotion_id = v_promo.promotion_id, promotion_code = upper(trim(p_promo_code))
    where id = v_order.id;
  end if;

  -- La réduction ne peut pas dépasser ce qui est dû
  v_discount := least(v_discount, v_subtotal + v_fee + v_service);

  update public.orders
  set subtotal        = v_subtotal,
      delivery_fee    = v_fee,
      service_fee     = v_service,
      discount_amount = v_discount,
      total           = v_subtotal + v_fee + v_service - v_discount,
      eta_minutes     = v_eta
  where id = v_order.id
  returning * into v_order;

  -- Paiement (CASH au lancement : reste PENDING jusqu'à la remise)
  insert into public.payments (order_id, provider, amount, currency)
  values (v_order.id, p_payment_provider, v_order.total, v_order.currency);

  -- Compteurs produits
  update public.products p
  set sold_count = p.sold_count + oi.quantity
  from public.order_items oi
  where oi.order_id = v_order.id and oi.product_id = p.id;

  return v_order;
end;
$$;

-- ===========================================================================
-- Machine à états : commande
-- ===========================================================================
create or replace function public.fn_order_can_transition(
  p_from public.order_status,
  p_to   public.order_status,
  p_fulfillment public.fulfillment_type
)
returns boolean
language sql
immutable
as $$
  select case
    -- Annulation possible jusqu'à la récupération incluse
    when p_to = 'CANCELLED' then
      p_from in ('NEW', 'ACCEPTED', 'PREPARING', 'READY', 'ASSIGNED', 'PICKED_UP')
    when p_from = 'NEW'       then p_to = 'ACCEPTED'
    when p_from = 'ACCEPTED'  then p_to = 'PREPARING'
    when p_from = 'PREPARING' then p_to = 'READY'
    when p_from = 'READY'     then
      case when p_fulfillment = 'PICKUP' then p_to = 'DELIVERED'
           else p_to = 'ASSIGNED' end
    when p_from = 'ASSIGNED'  then p_to = 'PICKED_UP'
    when p_from = 'PICKED_UP' then p_to = 'DELIVERED'
    else false
  end;
$$;

create or replace function public.fn_advance_order_status(
  p_order_id uuid,
  p_to       public.order_status,
  p_note     text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  perform set_config('app.bypass_guards', 'on', true);

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Commande introuvable.' using errcode = 'no_data_found';
  end if;

  if v_order.status = p_to then
    return v_order;   -- idempotent : un double tap ne casse rien
  end if;

  if not public.fn_order_can_transition(v_order.status, p_to, v_order.fulfillment) then
    raise exception 'Transition interdite: % → % (commande %)',
      v_order.status, p_to, v_order.order_number
      using errcode = 'check_violation';
  end if;

  update public.orders
  set status       = p_to,
      accepted_at  = case when p_to = 'ACCEPTED'  then now() else accepted_at  end,
      ready_at     = case when p_to = 'READY'     then now() else ready_at     end,
      picked_up_at = case when p_to = 'PICKED_UP' then now() else picked_up_at end,
      delivered_at = case when p_to = 'DELIVERED' then now() else delivered_at end,
      cancelled_at = case when p_to = 'CANCELLED' then now() else cancelled_at end,
      cancelled_by = case when p_to = 'CANCELLED' then auth.uid() else cancelled_by end,
      cancellation_reason = case when p_to = 'CANCELLED' then p_note else cancellation_reason end
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

-- Journalisation automatique de chaque changement de statut
create or replace function public.fn_log_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.order_status_history (
      order_id, from_status, to_status, changed_by, actor_role, note
    ) values (
      new.id,
      case when tg_op = 'INSERT' then null else old.status end,
      new.status,
      auth.uid(),
      public.fn_current_role(),
      case when new.status = 'CANCELLED' then new.cancellation_reason else null end
    );
  end if;
  return new;
end;
$$;

create trigger trg_orders_log_status
  after insert or update of status on public.orders
  for each row execute function public.fn_log_order_status();

-- ===========================================================================
-- Assignation d'un livreur : crée la livraison et fait passer la commande
-- en ASSIGNED, dans la même transaction.
-- ===========================================================================
create or replace function public.fn_assign_driver(
  p_order_id  uuid,
  p_driver_id uuid,
  p_payout    integer default null
)
returns public.deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order    public.orders%rowtype;
  v_delivery public.deliveries%rowtype;
  v_payment  public.payments%rowtype;
  v_cash     integer := 0;
begin
  perform set_config('app.bypass_guards', 'on', true);

  if not public.fn_is_staff() then
    raise exception 'Réservé au personnel du restaurant.' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Commande introuvable.' using errcode = 'no_data_found';
  end if;

  if v_order.fulfillment <> 'DELIVERY' then
    raise exception 'Cette commande est un retrait sur place.' using errcode = 'check_violation';
  end if;

  if v_order.status not in ('READY', 'ASSIGNED') then
    raise exception 'La commande doit être prête avant assignation (statut actuel: %).',
      v_order.status using errcode = 'check_violation';
  end if;

  select * into v_payment from public.payments where order_id = p_order_id limit 1;
  if v_payment.provider = 'CASH' and v_payment.status <> 'PAID' then
    v_cash := v_order.total;
  end if;

  insert into public.deliveries (
    order_id, driver_id, status, payout_amount, cash_to_collect,
    distance_km, eta_minutes
  ) values (
    p_order_id, p_driver_id, 'OFFERED',
    coalesce(p_payout, v_order.delivery_fee),
    v_cash,
    v_order.distance_km, v_order.eta_minutes
  )
  on conflict (order_id) do update
    set driver_id  = excluded.driver_id,
        status     = 'OFFERED',
        offered_at = now(),
        rejected_at = null
  returning * into v_delivery;

  if v_order.status = 'READY' then
    perform public.fn_advance_order_status(p_order_id, 'ASSIGNED');
  end if;

  update public.drivers set availability = 'BUSY' where id = p_driver_id;

  return v_delivery;
end;
$$;

-- ===========================================================================
-- Machine à états : livraison
-- ===========================================================================
create or replace function public.fn_delivery_can_transition(
  p_from public.delivery_status,
  p_to   public.delivery_status
)
returns boolean
language sql
immutable
as $$
  select case
    when p_to = 'CANCELLED' then p_from <> 'DELIVERED'
    when p_from = 'OFFERED'               then p_to in ('ACCEPTED', 'REJECTED')
    when p_from = 'ACCEPTED'              then p_to = 'HEADING_TO_RESTAURANT'
    when p_from = 'HEADING_TO_RESTAURANT' then p_to = 'PICKED_UP'
    when p_from = 'PICKED_UP'             then p_to = 'HEADING_TO_CUSTOMER'
    when p_from = 'HEADING_TO_CUSTOMER'   then p_to = 'ARRIVED'
    when p_from = 'ARRIVED'               then p_to = 'DELIVERED'
    else false
  end;
$$;

create or replace function public.fn_advance_delivery_status(
  p_delivery_id uuid,
  p_to          public.delivery_status
)
returns public.deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery public.deliveries%rowtype;
  v_driver   uuid := public.fn_current_driver_id();
begin
  perform set_config('app.bypass_guards', 'on', true);

  select * into v_delivery from public.deliveries where id = p_delivery_id for update;
  if not found then
    raise exception 'Livraison introuvable.' using errcode = 'no_data_found';
  end if;

  if v_delivery.driver_id is distinct from v_driver and not public.fn_is_staff() then
    raise exception 'Cette course ne vous est pas assignée.' using errcode = '42501';
  end if;

  if p_to = 'DELIVERED' then
    raise exception 'Utiliser fn_confirm_delivery avec le code du client.'
      using errcode = 'check_violation';
  end if;

  if v_delivery.status = p_to then
    return v_delivery;
  end if;

  if not public.fn_delivery_can_transition(v_delivery.status, p_to) then
    raise exception 'Transition interdite: % → %', v_delivery.status, p_to
      using errcode = 'check_violation';
  end if;

  update public.deliveries
  set status = p_to,
      accepted_at              = case when p_to = 'ACCEPTED'              then now() else accepted_at end,
      rejected_at              = case when p_to = 'REJECTED'              then now() else rejected_at end,
      heading_to_restaurant_at = case when p_to = 'HEADING_TO_RESTAURANT' then now() else heading_to_restaurant_at end,
      picked_up_at             = case when p_to = 'PICKED_UP'             then now() else picked_up_at end,
      heading_to_customer_at   = case when p_to = 'HEADING_TO_CUSTOMER'   then now() else heading_to_customer_at end,
      arrived_at               = case when p_to = 'ARRIVED'               then now() else arrived_at end,
      cancelled_at             = case when p_to = 'CANCELLED'             then now() else cancelled_at end
  where id = p_delivery_id
  returning * into v_delivery;

  -- La récupération par le livreur fait avancer la commande côté restaurant
  if p_to = 'PICKED_UP' then
    perform public.fn_advance_order_status(v_delivery.order_id, 'PICKED_UP');
  end if;

  -- Un refus libère le livreur et remet la commande en attente d'assignation
  if p_to = 'REJECTED' then
    update public.drivers set availability = 'AVAILABLE' where id = v_delivery.driver_id;
    update public.deliveries set driver_id = null where id = p_delivery_id;
  end if;

  return v_delivery;
end;
$$;

-- ===========================================================================
-- Clôture par code de confirmation — la vérification est faite ici, jamais
-- côté application.
-- ===========================================================================
create or replace function public.fn_confirm_delivery(
  p_delivery_id uuid,
  p_code        text
)
returns public.deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery public.deliveries%rowtype;
  v_driver   uuid := public.fn_current_driver_id();
begin
  perform set_config('app.bypass_guards', 'on', true);

  select * into v_delivery from public.deliveries where id = p_delivery_id for update;
  if not found then
    raise exception 'Livraison introuvable.' using errcode = 'no_data_found';
  end if;

  if v_delivery.driver_id is distinct from v_driver and not public.fn_is_staff() then
    raise exception 'Cette course ne vous est pas assignée.' using errcode = '42501';
  end if;

  if v_delivery.status = 'DELIVERED' then
    return v_delivery;
  end if;

  if v_delivery.status <> 'ARRIVED' then
    raise exception 'Indiquez d''abord votre arrivée chez le client.'
      using errcode = 'check_violation';
  end if;

  if v_delivery.confirmation_attempts >= 5 then
    raise exception 'Trop de tentatives. Contactez le restaurant.'
      using errcode = 'check_violation';
  end if;

  if v_delivery.confirmation_code <> lpad(trim(p_code), 4, '0') then
    update public.deliveries
    set confirmation_attempts = confirmation_attempts + 1
    where id = p_delivery_id;

    raise exception 'Code de confirmation incorrect.' using errcode = 'check_violation';
  end if;

  update public.deliveries
  set status = 'DELIVERED', delivered_at = now()
  where id = p_delivery_id
  returning * into v_delivery;

  perform public.fn_advance_order_status(v_delivery.order_id, 'DELIVERED');

  -- Encaissement du paiement à la livraison
  update public.payments
  set status = 'PAID', paid_at = now()
  where order_id = v_delivery.order_id and provider = 'CASH' and status = 'PENDING';

  -- Compteurs du livreur
  update public.drivers
  set total_deliveries = total_deliveries + 1,
      total_earnings   = total_earnings + v_delivery.payout_amount,
      availability     = 'AVAILABLE'
  where id = v_delivery.driver_id;

  return v_delivery;
end;
$$;

-- ===========================================================================
-- Position du livreur — écriture légère, appelée toutes les 15 s
-- ===========================================================================
create or replace function public.fn_push_driver_location(
  p_latitude    double precision,
  p_longitude   double precision,
  p_delivery_id uuid  default null,
  p_heading     real  default null,
  p_speed_kmh   real  default null,
  p_accuracy_m  real  default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver uuid := public.fn_current_driver_id();
begin
  if v_driver is null then
    raise exception 'Profil livreur introuvable.' using errcode = '42501';
  end if;

  insert into public.driver_locations (
    driver_id, delivery_id, latitude, longitude, heading, speed_kmh, accuracy_m
  ) values (
    v_driver, p_delivery_id, p_latitude, p_longitude, p_heading, p_speed_kmh, p_accuracy_m
  );

  update public.drivers
  set last_latitude = p_latitude,
      last_longitude = p_longitude,
      last_location_at = now()
  where id = v_driver;
end;
$$;

create or replace function public.fn_purge_driver_locations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.driver_locations where recorded_at < now() - interval '7 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- ===========================================================================
-- Statistiques du dashboard — une seule requête au lieu de six
-- ===========================================================================
create or replace function public.fn_dashboard_stats(
  p_restaurant_id uuid,
  p_from timestamptz default date_trunc('day', now()),
  p_to   timestamptz default now()
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'revenue',          coalesce(sum(o.total) filter (where o.status = 'DELIVERED'), 0),
    'orders_total',     count(*),
    'orders_new',       count(*) filter (where o.status = 'NEW'),
    'orders_preparing', count(*) filter (where o.status in ('ACCEPTED', 'PREPARING')),
    'orders_ready',     count(*) filter (where o.status = 'READY'),
    'orders_in_transit',count(*) filter (where o.status in ('ASSIGNED', 'PICKED_UP')),
    'orders_delivered', count(*) filter (where o.status = 'DELIVERED'),
    'orders_cancelled', count(*) filter (where o.status = 'CANCELLED'),
    'avg_basket',       coalesce(round(avg(o.total) filter (where o.status = 'DELIVERED')), 0),
    'customers',        count(distinct o.customer_id),
    'drivers_active',   (select count(*) from public.drivers
                         where restaurant_id = p_restaurant_id
                           and availability <> 'OFFLINE' and is_approved)
  )
  from public.orders o
  where o.restaurant_id = p_restaurant_id
    and o.created_at >= p_from
    and o.created_at <= p_to;
$$;

-- Série temporelle des ventes (day | week | month)
create or replace function public.fn_sales_series(
  p_restaurant_id uuid,
  p_bucket        text default 'day',
  p_from          timestamptz default now() - interval '30 days',
  p_to            timestamptz default now()
)
returns table (bucket timestamptz, revenue bigint, orders bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    date_trunc(
      case when p_bucket in ('day', 'week', 'month') then p_bucket else 'day' end,
      o.created_at
    ) as bucket,
    coalesce(sum(o.total), 0)::bigint  as revenue,
    count(*)::bigint                   as orders
  from public.orders o
  where o.restaurant_id = p_restaurant_id
    and o.status = 'DELIVERED'
    and o.created_at between p_from and p_to
  group by 1
  order by 1;
$$;

create or replace function public.fn_top_products(
  p_restaurant_id uuid,
  p_limit         integer default 10,
  p_from          timestamptz default now() - interval '30 days'
)
returns table (
  product_id uuid, product_name text, image_url text,
  quantity bigint, revenue bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    oi.product_id,
    oi.product_name,
    oi.product_image,
    sum(oi.quantity)::bigint   as quantity,
    sum(oi.line_total)::bigint as revenue
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.restaurant_id = p_restaurant_id
    and o.status = 'DELIVERED'
    and o.created_at >= p_from
  group by oi.product_id, oi.product_name, oi.product_image
  order by quantity desc
  limit p_limit;
$$;
