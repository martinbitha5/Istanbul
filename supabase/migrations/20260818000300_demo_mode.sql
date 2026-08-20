-- ---------------------------------------------------------------------------
-- Istanbul Fast Food — 15. Mode démo
--
-- POURQUOI
-- Pour montrer le produit (ou le tester seul), il faut un restaurant qui
-- accepte et un livreur qui roule. Ce module joue les deux : un tick pg_cron
-- toutes les 10 secondes fait avancer chaque commande active pas à pas et
-- déplace un livreur fantôme sur la carte, GPS réaliste inclus.
--
-- Le client vit alors le parcours complet sans intervention :
--   commande → acceptée (~10 s) → en cuisine → prête → livreur assigné →
--   il roule vers le restaurant → récupère → roule vers vous (la carte
--   bouge) → arrivé (notification « préparez votre code ») → livré (~4 min).
--
-- ACTIVATION : app_config.demo_mode = 'on'  (mis à 'on' au déploiement).
-- COUPURE    : update public.app_config set value = '' where key = 'demo_mode';
-- La seule différence avec la prod réelle : la clôture se fait sans code de
-- confirmation — c'est un automate, pas un livreur.
-- ---------------------------------------------------------------------------

insert into public.app_config (key, value) values ('demo_mode', 'on')
on conflict (key) do nothing;

-- ===========================================================================
-- Le livreur fantôme — un vrai compte, pour que RLS et jointures s'appliquent
-- exactement comme en production.
-- ===========================================================================
do $$
declare
  v_restaurant uuid;
begin
  select id into v_restaurant from public.restaurants order by created_at limit 1;
  if v_restaurant is null then
    raise notice 'demo: aucun restaurant, livreur fantôme non créé.';
    return;
  end if;

  insert into auth.users (id, email, raw_user_meta_data)
  values ('de300000-0000-4000-a000-000000000001', 'livreur-demo@istanbul.cd',
          jsonb_build_object('full_name', 'Jean Mobutu (démo)'))
  on conflict (id) do nothing;

  -- Le trigger de création de profil a fait le miroir ; on ajuste le rôle.
  update public.profiles
  set role = 'DRIVER', full_name = 'Jean Mobutu (démo)', phone = '+243890000001'
  where id = 'de300000-0000-4000-a000-000000000001';

  insert into public.drivers (id, profile_id, restaurant_id, vehicle, availability, is_approved)
  values ('de300000-0000-4000-a000-000000000002',
          'de300000-0000-4000-a000-000000000001',
          v_restaurant, 'MOTORCYCLE', 'AVAILABLE', true)
  on conflict (profile_id) do nothing;
end;
$$;

-- ===========================================================================
-- Le tick : un pas de simulation. Idempotent, silencieux, sans danger —
-- il ne touche qu'aux commandes des 6 dernières heures et ne fait rien
-- si demo_mode est vide.
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
  -- Trajet simulé
  v_from_lat   double precision;
  v_from_lng   double precision;
  v_to_lat     double precision;
  v_to_lng     double precision;
  v_p          double precision;   -- progression 0 → 1
  v_lat        double precision;
  v_lng        double precision;
  c_pickup_leg_s   constant double precision := 45;  -- vers le restaurant
  c_dropoff_leg_s  constant double precision := 90;  -- vers le client
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

  -- -------------------------------------------------------------------------
  -- 1. Côté restaurant : accepter, cuisiner, marquer prêt.
  -- -------------------------------------------------------------------------
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
        -- L'horodatage de PREPARING n'est pas stocké : on se cale sur accepted_at.
        if now() - v_order.accepted_at >= interval '40 seconds' then
          perform public.fn_advance_order_status(v_order.id, 'READY');
        end if;

      when 'READY' then
        if v_order.fulfillment = 'PICKUP' then
          -- Retrait : le client « passe au comptoir » une minute plus tard.
          if now() - v_order.ready_at >= interval '60 seconds' then
            perform public.fn_advance_order_status(v_order.id, 'DELIVERED');
            update public.payments set status = 'PAID', paid_at = now()
            where order_id = v_order.id and status = 'PENDING';
          end if;
        else
          -- Livraison : assignation du livreur fantôme (équivalent de
          -- fn_assign_driver, sans le contrôle staff — on EST le staff ici).
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

  -- -------------------------------------------------------------------------
  -- 2. Côté livreur : accepter la course, rouler, livrer.
  -- -------------------------------------------------------------------------
  for v_delivery in
    select d.*, o.delivery_latitude, o.delivery_longitude, o.total as order_total
    from public.deliveries d
    join public.orders o on o.id = d.order_id
    where d.driver_id = v_driver.id
      and d.status in ('OFFERED', 'ACCEPTED', 'HEADING_TO_RESTAURANT',
                       'PICKED_UP', 'HEADING_TO_CUSTOMER', 'ARRIVED')
      and d.created_at > now() - interval '6 hours'
  loop
    -- Point de départ du livreur : ~1,5 km du restaurant.
    v_from_lat := v_rest.latitude  - 0.011;
    v_from_lng := v_rest.longitude + 0.008;
    -- Destination : l'adresse du client, ou un point de repli à ~1,7 km.
    v_to_lat := coalesce(v_delivery.delivery_latitude,  v_rest.latitude  + 0.013);
    v_to_lng := coalesce(v_delivery.delivery_longitude, v_rest.longitude - 0.009);

    case v_delivery.status
      when 'OFFERED' then
        if now() - v_delivery.offered_at >= interval '10 seconds' then
          update public.deliveries
          set status = 'ACCEPTED', accepted_at = now()
          where id = v_delivery.id;
        end if;

      when 'ACCEPTED' then
        update public.deliveries
        set status = 'HEADING_TO_RESTAURANT', heading_to_restaurant_at = now()
        where id = v_delivery.id;

      when 'HEADING_TO_RESTAURANT' then
        v_p := least(1.0, extract(epoch from now() - v_delivery.heading_to_restaurant_at)
                          / c_pickup_leg_s);
        v_lat := v_from_lat + (v_rest.latitude  - v_from_lat) * v_p;
        v_lng := v_from_lng + (v_rest.longitude - v_from_lng) * v_p;

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
        end if;

      when 'PICKED_UP' then
        update public.deliveries
        set status = 'HEADING_TO_CUSTOMER', heading_to_customer_at = now()
        where id = v_delivery.id;

      when 'HEADING_TO_CUSTOMER' then
        v_p := least(1.0, extract(epoch from now() - v_delivery.heading_to_customer_at)
                          / c_dropoff_leg_s);
        v_lat := v_rest.latitude  + (v_to_lat - v_rest.latitude)  * v_p;
        v_lng := v_rest.longitude + (v_to_lng - v_rest.longitude) * v_p;

        insert into public.driver_locations (driver_id, delivery_id, latitude, longitude, speed_kmh)
        values (v_driver.id, v_delivery.id, v_lat, v_lng, 26);
        update public.drivers
        set last_latitude = v_lat, last_longitude = v_lng, last_location_at = now()
        where id = v_driver.id;

        if v_p >= 1.0 then
          -- Déclenche la notification « votre livreur est arrivé ».
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
  -- Un tick qui casse ne doit jamais s'accumuler en erreurs cron : on trace.
  raise warning 'fn_demo_tick: %', sqlerrm;
end;
$$;

revoke execute on function public.fn_demo_tick from public, anon, authenticated;

-- ===========================================================================
-- Cadence : toutes les 10 secondes (pg_cron >= 1.5).
-- ===========================================================================
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'demo-tick';
    perform cron.schedule('demo-tick', '10 seconds', $cron$ select public.fn_demo_tick(); $cron$);
  else
    raise notice 'pg_cron indisponible : appeler fn_demo_tick() manuellement.';
  end if;
end;
$$;
