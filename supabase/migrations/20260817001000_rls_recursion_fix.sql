-- ---------------------------------------------------------------------------
-- Istanbul Fast Food — 10. Rupture des cycles de récursion RLS
--
-- PROBLÈME
-- Une policy sur `orders` qui interroge `deliveries` déclenche l'évaluation
-- des policies de `deliveries`, dont l'une interroge `orders`… PostgreSQL
-- lève alors « infinite recursion detected in policy for relation orders ».
-- Le cycle existait entre orders ↔ deliveries ↔ drivers ↔ profiles.
--
-- SOLUTION
-- Déporter chaque prédicat inter-tables dans une fonction SECURITY DEFINER.
-- Exécutée avec les droits du propriétaire (postgres), elle ne déclenche pas
-- la RLS des tables qu'elle lit : le cycle est rompu, et la logique d'accès
-- reste écrite une seule fois.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- Fonctions de prédicat
-- ===========================================================================

/** L'appelant est-il le client de cette commande ? */
create or replace function public.fn_is_order_customer(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order_id and o.customer_id = auth.uid()
  );
$$;

/** L'appelant est-il le livreur assigné à cette commande ? */
create or replace function public.fn_is_order_driver(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.deliveries d
    join public.drivers dr on dr.id = d.driver_id
    where d.order_id = p_order_id and dr.profile_id = auth.uid()
  );
$$;

/**
 * Cette commande porte-t-elle une course libre que l'appelant peut prendre ?
 * Réservé aux livreurs approuvés du même restaurant.
 */
create or replace function public.fn_is_open_offer(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.deliveries d
    join public.orders o  on o.id = d.order_id
    join public.drivers dr on dr.profile_id = auth.uid()
    where d.order_id = p_order_id
      and d.status = 'OFFERED'
      and d.driver_id is null
      and dr.restaurant_id = o.restaurant_id
      and dr.is_approved
  );
$$;

/** L'appelant est-il le client de la commande derrière cette livraison ? */
create or replace function public.fn_is_delivery_customer(p_delivery_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.deliveries d
    join public.orders o on o.id = d.order_id
    where d.id = p_delivery_id and o.customer_id = auth.uid()
  );
$$;

/** L'appelant est-il un livreur approuvé (donc éligible aux courses libres) ? */
create or replace function public.fn_is_approved_driver()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.drivers
    where profile_id = auth.uid() and is_approved
  );
$$;

/** Ce livreur assure-t-il une commande de l'appelant ? */
create or replace function public.fn_driver_serves_me(p_driver_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.deliveries d
    join public.orders o on o.id = d.order_id
    where d.driver_id = p_driver_id and o.customer_id = auth.uid()
  );
$$;

/**
 * Ce profil est-il la contrepartie de l'appelant sur une course en cours ?
 * (le client voit le nom de son livreur, et réciproquement)
 */
create or replace function public.fn_is_counterpart(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    join public.deliveries d on d.order_id = o.id
    join public.drivers dr   on dr.id = d.driver_id
    where (o.customer_id = p_profile_id and dr.profile_id = auth.uid())
       or (dr.profile_id = p_profile_id and o.customer_id = auth.uid())
  );
$$;

/** Le suivi GPS n'est visible que pendant la course. */
create or replace function public.fn_can_track_delivery(p_delivery_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.deliveries d
    join public.orders o on o.id = d.order_id
    where d.id = p_delivery_id
      and o.customer_id = auth.uid()
      and d.status not in ('DELIVERED', 'CANCELLED', 'REJECTED')
  );
$$;

-- ===========================================================================
-- Remplacement des policies cycliques
-- ===========================================================================

-- --- orders ---------------------------------------------------------------
drop policy if exists "orders_read_assigned_driver" on public.orders;
create policy "orders_read_assigned_driver" on public.orders
  for select using (public.fn_is_order_driver(id));

drop policy if exists "orders_read_open_offers" on public.orders;
create policy "orders_read_open_offers" on public.orders
  for select using (public.fn_is_open_offer(id));

-- --- deliveries ------------------------------------------------------------
drop policy if exists "deliveries_read_customer" on public.deliveries;
create policy "deliveries_read_customer" on public.deliveries
  for select using (public.fn_is_order_customer(order_id));

drop policy if exists "deliveries_read_driver" on public.deliveries;
create policy "deliveries_read_driver" on public.deliveries
  for select using (
    driver_id = public.fn_current_driver_id()
    or (driver_id is null and status = 'OFFERED' and public.fn_is_approved_driver())
  );

-- --- drivers ---------------------------------------------------------------
drop policy if exists "drivers_read_by_customer" on public.drivers;
create policy "drivers_read_by_customer" on public.drivers
  for select using (public.fn_driver_serves_me(id));

-- --- profiles --------------------------------------------------------------
drop policy if exists "profiles_read_counterpart" on public.profiles;
create policy "profiles_read_counterpart" on public.profiles
  for select using (public.fn_is_counterpart(id));

-- --- driver_locations ------------------------------------------------------
drop policy if exists "driver_locations_read_customer" on public.driver_locations;
create policy "driver_locations_read_customer" on public.driver_locations
  for select using (
    delivery_id is not null and public.fn_can_track_delivery(delivery_id)
  );

-- --- order_items : la policy d'insertion interrogeait orders ---------------
drop policy if exists "order_items_write_own" on public.order_items;
create policy "order_items_write_own" on public.order_items
  for insert with check (public.fn_is_order_customer(order_id));

-- --- order_item_options ----------------------------------------------------
drop policy if exists "order_item_options_read" on public.order_item_options;

create or replace function public.fn_can_read_order_item(p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_can_read_order((select order_id from public.order_items where id = p_item_id));
$$;

create policy "order_item_options_read" on public.order_item_options
  for select using (public.fn_can_read_order_item(order_item_id));

-- ===========================================================================
-- Droits d'exécution
--
-- Ces fonctions ne renvoient qu'un booléen sur des données que l'appelant a
-- déjà le droit de connaître : les exposer à `authenticated` ne fuit rien.
-- ===========================================================================
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'fn_is_order_customer(uuid)',
    'fn_is_order_driver(uuid)',
    'fn_is_open_offer(uuid)',
    'fn_is_delivery_customer(uuid)',
    'fn_is_approved_driver()',
    'fn_driver_serves_me(uuid)',
    'fn_is_counterpart(uuid)',
    'fn_can_track_delivery(uuid)',
    'fn_can_read_order(uuid)',
    'fn_can_read_order_item(uuid)'
  ]
  loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end;
$$;
