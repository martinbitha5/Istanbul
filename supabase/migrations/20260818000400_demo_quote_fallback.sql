-- ---------------------------------------------------------------------------
-- Istanbul Fast Food — 16. Mode démo : jamais « hors zone »
--
-- En démo, l'adresse du testeur est là où le hasard (ou l'émulateur) l'a mise :
-- à 12 km du restaurant, voire sur un autre continent. Le refus « hors zone »
-- est alors un mur qui empêche de voir le produit.
--
-- Quand app_config.demo_mode = 'on', une distance au-delà de toutes les zones
-- retombe sur la zone active la plus éloignée (son tarif, son ETA) au lieu de
-- bloquer. Démo coupée → comportement de production inchangé : hors zone,
-- le checkout refuse.
-- ---------------------------------------------------------------------------

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
  v_demo    boolean;
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
    v_demo := coalesce(
      (select value from public.app_config where key = 'demo_mode'), ''
    ) = 'on';

    if v_demo then
      -- Démo : la zone la plus éloignée sert de filet.
      select * into v_zone
      from public.delivery_zones
      where restaurant_id = p_restaurant_id and is_active
      order by max_distance_km desc
      limit 1;

      if found then
        return query select
          v_zone.id,
          (v_zone.name || ' (démo)')::text,
          v_dist,
          case
            when v_zone.free_above is not null and p_subtotal >= v_zone.free_above then 0
            else v_zone.fee_amount
          end,
          v_zone.eta_minutes + v_rest.avg_prep_minutes,
          true;
        return;
      end if;
    end if;

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
