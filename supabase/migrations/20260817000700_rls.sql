-- ---------------------------------------------------------------------------
-- Istanbul Fast Food — 07. Row Level Security
--
-- Règle : RLS activée sur TOUTES les tables publiques, sans exception.
-- Les écritures sensibles (statuts, montants, codes) passent par les fonctions
-- SECURITY DEFINER de la migration 06 — les policies d'UPDATE restent donc
-- volontairement étroites.
-- ---------------------------------------------------------------------------

alter table public.restaurants           enable row level security;
alter table public.opening_hours         enable row level security;
alter table public.profiles              enable row level security;
alter table public.addresses             enable row level security;
alter table public.delivery_zones        enable row level security;
alter table public.drivers               enable row level security;
alter table public.categories            enable row level security;
alter table public.products              enable row level security;
alter table public.product_option_groups enable row level security;
alter table public.product_options       enable row level security;
alter table public.favorites             enable row level security;
alter table public.promotions            enable row level security;
alter table public.promotion_products    enable row level security;
alter table public.promotion_redemptions enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.order_item_options    enable row level security;
alter table public.order_status_history  enable row level security;
alter table public.payments              enable row level security;
alter table public.reviews               enable row level security;
alter table public.deliveries            enable row level security;
alter table public.driver_locations      enable row level security;
alter table public.notifications         enable row level security;

-- ===========================================================================
-- CATALOGUE — lecture publique (la vitrine doit s'afficher avant connexion),
-- écriture réservée au staff.
-- ===========================================================================
create policy "restaurants_read_all" on public.restaurants
  for select using (true);
create policy "restaurants_write_admin" on public.restaurants
  for all using (public.fn_is_admin()) with check (public.fn_is_admin());

create policy "opening_hours_read_all" on public.opening_hours
  for select using (true);
create policy "opening_hours_write_staff" on public.opening_hours
  for all using (public.fn_is_staff()) with check (public.fn_is_staff());

create policy "categories_read_all" on public.categories
  for select using (is_active or public.fn_is_staff());
create policy "categories_write_staff" on public.categories
  for all using (public.fn_is_staff()) with check (public.fn_is_staff());

create policy "products_read_all" on public.products
  for select using (is_active or public.fn_is_staff());
create policy "products_write_staff" on public.products
  for all using (public.fn_is_staff()) with check (public.fn_is_staff());

create policy "option_groups_read_all" on public.product_option_groups
  for select using (true);
create policy "option_groups_write_staff" on public.product_option_groups
  for all using (public.fn_is_staff()) with check (public.fn_is_staff());

create policy "product_options_read_all" on public.product_options
  for select using (true);
create policy "product_options_write_staff" on public.product_options
  for all using (public.fn_is_staff()) with check (public.fn_is_staff());

create policy "delivery_zones_read_all" on public.delivery_zones
  for select using (is_active or public.fn_is_staff());
create policy "delivery_zones_write_admin" on public.delivery_zones
  for all using (public.fn_is_admin()) with check (public.fn_is_admin());

-- Les promotions publiques sont visibles ; les codes restent utilisables via
-- fn_evaluate_promotion sans être listables par force brute.
create policy "promotions_read_public" on public.promotions
  for select using (
    public.fn_is_staff()
    or (is_active and code is null and now() between starts_at and coalesce(ends_at, 'infinity'))
  );
create policy "promotions_write_admin" on public.promotions
  for all using (public.fn_is_admin()) with check (public.fn_is_admin());

create policy "promotion_products_read" on public.promotion_products
  for select using (true);
create policy "promotion_products_write_admin" on public.promotion_products
  for all using (public.fn_is_admin()) with check (public.fn_is_admin());

create policy "promotion_redemptions_read_own" on public.promotion_redemptions
  for select using (profile_id = auth.uid() or public.fn_is_staff());

-- ===========================================================================
-- PROFILS
-- ===========================================================================
create policy "profiles_read_own" on public.profiles
  for select using (id = auth.uid());

create policy "profiles_read_staff" on public.profiles
  for select using (public.fn_is_staff());

-- Un livreur en course doit pouvoir lire le nom du client, et inversement.
create policy "profiles_read_counterpart" on public.profiles
  for select using (
    exists (
      select 1
      from public.orders o
      join public.deliveries d on d.order_id = o.id
      join public.drivers dr   on dr.id = d.driver_id
      where (o.customer_id = public.profiles.id and dr.profile_id = auth.uid())
         or (dr.profile_id = public.profiles.id and o.customer_id = auth.uid())
    )
  );

-- L'élévation de privilège est bloquée par le trigger trg_profiles_guard
-- (migration 07b) et non par un WITH CHECK : une sous-requête sur la même
-- table dans une policy provoquerait une récursion RLS.
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "profiles_manage_admin" on public.profiles
  for all using (public.fn_is_admin()) with check (public.fn_is_admin());

-- ===========================================================================
-- ADRESSES — strictement privées
-- ===========================================================================
create policy "addresses_own" on public.addresses
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Le livreur assigné voit l'adresse via la commande, pas via cette table.
create policy "addresses_read_staff" on public.addresses
  for select using (public.fn_is_staff());

-- ===========================================================================
-- FAVORIS
-- ===========================================================================
create policy "favorites_own" on public.favorites
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ===========================================================================
-- LIVREURS
-- ===========================================================================
create policy "drivers_read_own" on public.drivers
  for select using (profile_id = auth.uid());

create policy "drivers_read_staff" on public.drivers
  for select using (public.fn_is_staff());

-- Le client voit le livreur qui lui apporte sa commande.
create policy "drivers_read_by_customer" on public.drivers
  for select using (
    exists (
      select 1 from public.deliveries d
      join public.orders o on o.id = d.order_id
      where d.driver_id = public.drivers.id and o.customer_id = auth.uid()
    )
  );

-- Le livreur ne pilote que sa disponibilité et son véhicule ; is_approved et
-- les compteurs de revenus sont figés par trg_drivers_guard (migration 07b).
create policy "drivers_update_own" on public.drivers
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "drivers_manage_admin" on public.drivers
  for all using (public.fn_is_admin()) with check (public.fn_is_admin());

-- ===========================================================================
-- COMMANDES
-- ===========================================================================
create policy "orders_read_own" on public.orders
  for select using (customer_id = auth.uid());

create policy "orders_read_staff" on public.orders
  for select using (
    public.fn_is_staff()
    and (restaurant_id = public.fn_current_restaurant() or public.fn_is_admin())
  );

create policy "orders_read_assigned_driver" on public.orders
  for select using (
    exists (
      select 1 from public.deliveries d
      where d.order_id = public.orders.id
        and d.driver_id = public.fn_current_driver_id()
    )
  );

-- Les courses proposées mais pas encore prises : un livreur approuvé du
-- restaurant peut les voir pour les accepter.
create policy "orders_read_open_offers" on public.orders
  for select using (
    exists (
      select 1
      from public.deliveries d
      join public.drivers dr on dr.profile_id = auth.uid()
      where d.order_id = public.orders.id
        and d.status = 'OFFERED'
        and d.driver_id is null
        and dr.restaurant_id = public.orders.restaurant_id
        and dr.is_approved
    )
  );

-- La création passe par fn_place_order ; cette policy couvre le cas direct.
create policy "orders_insert_own" on public.orders
  for insert with check (customer_id = auth.uid());

-- Le client ne peut qu'annuler, et seulement tant que rien n'est parti en cuisine.
create policy "orders_cancel_own" on public.orders
  for update using (customer_id = auth.uid() and status in ('NEW', 'ACCEPTED'))
  with check (customer_id = auth.uid() and status in ('NEW', 'ACCEPTED', 'CANCELLED'));

create policy "orders_update_staff" on public.orders
  for update using (
    public.fn_is_staff()
    and (restaurant_id = public.fn_current_restaurant() or public.fn_is_admin())
  ) with check (true);

-- ---------------------------------------------------------------------------
-- Lignes de commande : héritent de la visibilité de la commande parente
-- ---------------------------------------------------------------------------
create or replace function public.fn_can_read_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order_id
      and (
        o.customer_id = auth.uid()
        or public.fn_is_staff()
        or exists (
          select 1 from public.deliveries d
          where d.order_id = o.id and d.driver_id = public.fn_current_driver_id()
        )
      )
  );
$$;

create policy "order_items_read" on public.order_items
  for select using (public.fn_can_read_order(order_id));
create policy "order_items_write_own" on public.order_items
  for insert with check (
    exists (select 1 from public.orders o
            where o.id = order_id and o.customer_id = auth.uid())
  );
create policy "order_items_manage_staff" on public.order_items
  for all using (public.fn_is_staff()) with check (public.fn_is_staff());

create policy "order_item_options_read" on public.order_item_options
  for select using (
    exists (select 1 from public.order_items oi
            where oi.id = order_item_id and public.fn_can_read_order(oi.order_id))
  );
create policy "order_item_options_manage_staff" on public.order_item_options
  for all using (public.fn_is_staff()) with check (public.fn_is_staff());

create policy "order_status_history_read" on public.order_status_history
  for select using (public.fn_can_read_order(order_id));

create policy "payments_read" on public.payments
  for select using (public.fn_can_read_order(order_id));
create policy "payments_manage_staff" on public.payments
  for all using (public.fn_is_staff()) with check (public.fn_is_staff());

create policy "reviews_own" on public.reviews
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "reviews_read_staff" on public.reviews
  for select using (public.fn_is_staff());

-- ===========================================================================
-- LIVRAISONS
-- ===========================================================================
create policy "deliveries_read_customer" on public.deliveries
  for select using (
    exists (select 1 from public.orders o
            where o.id = order_id and o.customer_id = auth.uid())
  );

create policy "deliveries_read_driver" on public.deliveries
  for select using (
    driver_id = public.fn_current_driver_id()
    or (
      driver_id is null
      and status = 'OFFERED'
      and exists (select 1 from public.drivers dr
                  where dr.profile_id = auth.uid() and dr.is_approved)
    )
  );

create policy "deliveries_read_staff" on public.deliveries
  for select using (public.fn_is_staff());

create policy "deliveries_manage_staff" on public.deliveries
  for all using (public.fn_is_staff()) with check (public.fn_is_staff());

-- Le livreur écrit uniquement sa note et sa photo de preuve ; les statuts, le
-- code de confirmation et la rémunération sont figés par trg_deliveries_guard.
create policy "deliveries_update_driver" on public.deliveries
  for update using (driver_id = public.fn_current_driver_id())
  with check (driver_id = public.fn_current_driver_id());

-- ===========================================================================
-- POSITIONS GPS
-- ===========================================================================
create policy "driver_locations_insert_own" on public.driver_locations
  for insert with check (driver_id = public.fn_current_driver_id());

create policy "driver_locations_read_own" on public.driver_locations
  for select using (driver_id = public.fn_current_driver_id());

create policy "driver_locations_read_staff" on public.driver_locations
  for select using (public.fn_is_staff());

-- Le client suit son livreur, uniquement pendant sa course.
create policy "driver_locations_read_customer" on public.driver_locations
  for select using (
    delivery_id is not null
    and exists (
      select 1 from public.deliveries d
      join public.orders o on o.id = d.order_id
      where d.id = public.driver_locations.delivery_id
        and o.customer_id = auth.uid()
        and d.status not in ('DELIVERED', 'CANCELLED', 'REJECTED')
    )
  );

-- ===========================================================================
-- NOTIFICATIONS
-- ===========================================================================
create policy "notifications_read_own" on public.notifications
  for select using (profile_id = auth.uid());

create policy "notifications_update_own" on public.notifications
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "notifications_manage_staff" on public.notifications
  for all using (public.fn_is_staff()) with check (public.fn_is_staff());

-- ===========================================================================
-- Droits d'exécution des fonctions métier
-- ===========================================================================
revoke all on function public.fn_place_order            from public, anon;
revoke all on function public.fn_advance_order_status   from public, anon;
revoke all on function public.fn_advance_delivery_status from public, anon;
revoke all on function public.fn_confirm_delivery       from public, anon;
revoke all on function public.fn_assign_driver          from public, anon;
revoke all on function public.fn_push_driver_location   from public, anon;
revoke all on function public.fn_dashboard_stats        from public, anon;
revoke all on function public.fn_sales_series           from public, anon;
revoke all on function public.fn_top_products           from public, anon;
revoke all on function public.fn_purge_driver_locations from public, anon, authenticated;

grant execute on function public.fn_place_order             to authenticated;
grant execute on function public.fn_advance_order_status    to authenticated;
grant execute on function public.fn_advance_delivery_status to authenticated;
grant execute on function public.fn_confirm_delivery        to authenticated;
grant execute on function public.fn_assign_driver           to authenticated;
grant execute on function public.fn_push_driver_location    to authenticated;
grant execute on function public.fn_dashboard_stats         to authenticated;
grant execute on function public.fn_sales_series            to authenticated;
grant execute on function public.fn_top_products            to authenticated;

-- Le devis de livraison et l'évaluation d'un code promo sont consultables
-- avant connexion (écran menu, bandeau promo).
grant execute on function public.fn_delivery_quote     to anon, authenticated;
grant execute on function public.fn_evaluate_promotion to authenticated;
grant execute on function public.fn_distance_km        to anon, authenticated;
grant execute on function public.fn_road_distance_km   to anon, authenticated;
