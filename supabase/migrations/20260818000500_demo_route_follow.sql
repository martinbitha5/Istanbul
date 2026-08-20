-- ---------------------------------------------------------------------------
-- Istanbul Fast Food — 17. Mode démo : le livreur fantôme suit les rues
--
-- Avant : interpolation en ligne droite entre deux points — le scooter
-- traversait les pâtés de maisons. Ici, au moment où la course démarre, le
-- tick demande l'itinéraire réel à OSRM via pg_net (asynchrone : la réponse
-- est relevée au tick suivant dans net._http_response), stocke la polyligne,
-- puis fait avancer le livreur LE LONG de cette polyligne à vitesse
-- constante. La trace GPS épouse alors les rues, comme un vrai téléphone
-- dans une vraie sacoche.
--
-- Si OSRM ne répond pas (hors ligne, quota), on retombe sur la ligne droite :
-- la démo ne casse jamais.
-- ---------------------------------------------------------------------------

create table if not exists public.demo_routes (
  delivery_id uuid   not null references public.deliveries(id) on delete cascade,
  leg         text   not null check (leg in ('pickup', 'dropoff')),
  request_id  bigint,
  points      jsonb,          -- [[lat, lng], ...] — déjà inversé depuis GeoJSON
  created_at  timestamptz not null default now(),
  primary key (delivery_id, leg)
);

-- Table interne au simulateur : aucune policy, invisible pour les apps.
alter table public.demo_routes enable row level security;
revoke all on public.demo_routes from anon, authenticated;

-- ===========================================================================
-- Demande / relève d'un itinéraire OSRM.
-- Renvoie les points si disponibles, null sinon (requête en vol ou échec).
-- ===========================================================================
create or replace function public.fn_demo_route(
  p_delivery uuid,
  p_leg      text,
  p_from_lat double precision,
  p_from_lng double precision,
  p_to_lat   double precision,
  p_to_lng   double precision
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row    public.demo_routes%rowtype;
  v_status integer;
  v_body   jsonb;
  v_coords jsonb;
  v_req    bigint;
begin
  select * into v_row from public.demo_routes
  where delivery_id = p_delivery and leg = p_leg;

  -- Premier passage : on lance la requête, la réponse arrivera plus tard.
  if not found then
    v_req := net.http_get(
      url := format(
        'https://router.project-osrm.org/route/v1/driving/%s,%s;%s,%s?overview=full&geometries=geojson',
        p_from_lng, p_from_lat, p_to_lng, p_to_lat
      ),
      timeout_milliseconds := 8000
    );
    insert into public.demo_routes (delivery_id, leg, request_id)
    values (p_delivery, p_leg, v_req)
    on conflict (delivery_id, leg) do nothing;
    return null;
  end if;

  if v_row.points is not null then
    return v_row.points;
  end if;

  -- La réponse est-elle arrivée ?
  select status_code, content::jsonb into v_status, v_body
  from net._http_response where id = v_row.request_id;

  if v_status = 200 then
    v_coords := v_body #> '{routes,0,geometry,coordinates}';
    if v_coords is not null and jsonb_array_length(v_coords) >= 2 then
      -- GeoJSON donne [lng, lat] : on stocke [lat, lng] une fois pour toutes.
      select jsonb_agg(jsonb_build_array(c -> 1, c -> 0)) into v_coords
      from jsonb_array_elements(v_coords) c;

      update public.demo_routes set points = v_coords
      where delivery_id = p_delivery and leg = p_leg;

      return v_coords;
    end if;
  end if;

  return null; -- en vol, ou erreur : l'appelant retombe sur la ligne droite
exception when others then
  return null;
end;
$$;

revoke execute on function public.fn_demo_route from public, anon, authenticated;

-- ===========================================================================
-- Position à la fraction p (0 → 1) le long d'une polyligne, à distance
-- constante. L'approximation équirectangulaire suffit : les segments OSRM
-- font quelques dizaines de mètres.
-- ===========================================================================
create or replace function public.fn_demo_point_along(
  p_points jsonb,
  p_p      double precision,
  out o_lat double precision,
  out o_lng double precision
)
language plpgsql
immutable
as $$
declare
  n      integer;
  i      integer;
  a_lat  double precision; a_lng double precision;
  b_lat  double precision; b_lng double precision;
  seg    double precision;
  total  double precision := 0;
  target double precision;
  acc    double precision := 0;
  f      double precision;
  lens   double precision[] := '{}';
begin
  n := jsonb_array_length(p_points);
  if n is null or n < 2 then
    return;
  end if;

  for i in 0 .. n - 2 loop
    a_lat := (p_points -> i -> 0)::double precision;
    a_lng := (p_points -> i -> 1)::double precision;
    b_lat := (p_points -> (i + 1) -> 0)::double precision;
    b_lng := (p_points -> (i + 1) -> 1)::double precision;
    seg := sqrt(power(b_lat - a_lat, 2) + power((b_lng - a_lng) * cos(radians(a_lat)), 2));
    lens := lens || seg;
    total := total + seg;
  end loop;

  if total = 0 then
    o_lat := (p_points -> 0 -> 0)::double precision;
    o_lng := (p_points -> 0 -> 1)::double precision;
    return;
  end if;

  target := greatest(0, least(1, p_p)) * total;

  for i in 0 .. n - 2 loop
    seg := lens[i + 1];
    if acc + seg >= target or i = n - 2 then
      f := case when seg = 0 then 0 else (target - acc) / seg end;
      a_lat := (p_points -> i -> 0)::double precision;
      a_lng := (p_points -> i -> 1)::double precision;
      b_lat := (p_points -> (i + 1) -> 0)::double precision;
      b_lng := (p_points -> (i + 1) -> 1)::double precision;
      o_lat := a_lat + (b_lat - a_lat) * f;
      o_lng := a_lng + (b_lng - a_lng) * f;
      return;
    end if;
    acc := acc + seg;
  end loop;
end;
$$;

-- ===========================================================================
-- Le tick, version « suit les rues ».
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
  v_payment    public.payments%rowtype;
  v_cash       integer;
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
          select * into v_payment from public.payments
          where order_id = v_order.id limit 1;
          v_cash := case
            when v_payment.provider = 'CASH' and v_payment.status <> 'PAID'
            then v_order.total else 0 end;

          insert into public.deliveries (
            order_id, driver_id, status, payout_amount, cash_to_collect,
            distance_km, eta_minutes
          ) values (
            v_order.id, v_driver.id, 'OFFERED',
            greatest(v_order.delivery_fee, 100), v_cash,
            v_order.distance_km, v_order.eta_minutes
          )
          on conflict (order_id) do nothing;

          perform public.fn_advance_order_status(v_order.id, 'ASSIGNED');
          update public.drivers set availability = 'BUSY' where id = v_driver.id;
        end if;
    end case;
  end loop;

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
          -- Préchauffe l'itinéraire du premier tronçon.
          perform public.fn_demo_route(v_delivery.id, 'pickup',
            v_from_lat, v_from_lng, v_rest.latitude, v_rest.longitude);
        end if;

      when 'ACCEPTED' then
        update public.deliveries
        set status = 'HEADING_TO_RESTAURANT', heading_to_restaurant_at = now()
        where id = v_delivery.id;

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
          -- Préchauffe le tronçon vers le client pendant la « récupération ».
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
