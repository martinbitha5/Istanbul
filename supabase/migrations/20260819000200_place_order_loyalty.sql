-- ---------------------------------------------------------------------------
-- Istanbul Fast Food — 19. fn_place_order v2 : paiement partiel en points
--
-- Nouveau paramètre `p_redeem_points` (défaut 0 : aucun changement pour les
-- clients existants). Le serveur plafonne aux points réellement détenus et à
-- ce qui est dû, ne brûle que le nécessaire, et journalise la dépense dans
-- loyalty_transactions. Le solde est verrouillé (FOR UPDATE) le temps de la
-- transaction : deux commandes simultanées ne dépensent pas les mêmes points.
-- ---------------------------------------------------------------------------

-- Un paramètre ajouté = une SURCHARGE pour PostgreSQL : sans ce drop, les
-- deux versions coexisteraient et PostgREST ne saurait plus laquelle appeler.
drop function if exists public.fn_place_order(
  uuid, public.fulfillment_type, jsonb, text, text, uuid, text, text, text,
  public.payment_provider
);

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
  p_payment_provider public.payment_provider default 'CASH',
  p_redeem_points  integer default 0
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
  -- Fidélité
  v_balance      integer;
  v_point_value  integer;
  v_redeem_value integer := 0;
  v_points_used  integer := 0;
begin
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

  v_service := (v_subtotal * v_rest.service_fee_bps) / 10000;

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

  v_discount := least(v_discount, v_subtotal + v_fee + v_service);

  -- --- Fidélité : paiement partiel en points -------------------------------
  if p_redeem_points > 0 then
    select loyalty_points into v_balance
    from public.profiles where id = v_customer for update;

    v_point_value := public.fn_loyalty_point_value();
    v_points_used := least(p_redeem_points, coalesce(v_balance, 0));
    v_redeem_value := least(
      v_points_used * v_point_value,
      v_subtotal + v_fee + v_service - v_discount
    );
    -- Ne brûler que les points réellement nécessaires au montant retenu.
    v_points_used := ceil(v_redeem_value::numeric / v_point_value)::integer;

    if v_points_used > 0 then
      update public.profiles
      set loyalty_points = loyalty_points - v_points_used
      where id = v_customer;

      insert into public.loyalty_transactions (profile_id, order_id, points, kind)
      values (v_customer, v_order.id, -v_points_used, 'REDEEM');

      v_discount := v_discount + v_redeem_value;
    end if;
  end if;

  update public.orders
  set subtotal        = v_subtotal,
      delivery_fee    = v_fee,
      service_fee     = v_service,
      discount_amount = v_discount,
      total           = v_subtotal + v_fee + v_service - v_discount,
      eta_minutes     = v_eta
  where id = v_order.id
  returning * into v_order;

  insert into public.payments (order_id, provider, amount, currency)
  values (v_order.id, p_payment_provider, v_order.total, v_order.currency);

  update public.products p
  set sold_count = p.sold_count + oi.quantity
  from public.order_items oi
  where oi.order_id = v_order.id and oi.product_id = p.id;

  return v_order;
end;
$$;
