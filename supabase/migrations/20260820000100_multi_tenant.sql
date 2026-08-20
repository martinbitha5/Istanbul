-- ---------------------------------------------------------------------------
-- Istanbul Fast Food — 21. Multi-restaurants réel
--
-- Jusqu'ici le schéma « supportait » plusieurs restaurants au sens où chaque
-- table portait un `restaurant_id` — mais l'autorisation, elle, ne le lisait
-- pas : `fn_is_staff()` répondait « oui » quel que soit le restaurant visé.
-- Concrètement, le staff du partenaire A pouvait modifier le menu de B, lire
-- son chiffre d'affaires et faire avancer ses commandes.
--
-- Cette migration transforme la plateforme en vraie place de marché :
--
--   1. `restaurant_members` — qui gère quel restaurant, et à quel titre
--      (OWNER / MANAGER / STAFF). Un partenaire administre son établissement
--      de bout en bout, y compris son équipe, sans jamais voir les autres.
--   2. Des prédicats d'autorisation qui prennent le restaurant en argument.
--   3. Toutes les policies des tables « tenant » réécrites avec ces prédicats.
--   4. Les fonctions métier SECURITY DEFINER (statuts, assignation, stats)
--      dotées du garde-fou qui leur manquait.
--   5. Les colonnes de place de marché : commission et publication.
--
-- Note de conception : `profiles.restaurant_id` est conservé — il reste le
-- rattachement principal (celui qu'affiche l'app livreur, celui que contrôle
-- la contrainte `profiles_staff_needs_restaurant`). `restaurant_members` est
-- la source de vérité des DROITS. Les deux sont tenus synchronisés par
-- trigger : supprimer l'un des deux modèles aurait cassé l'existant pour un
-- gain nul.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. Place de marché : colonnes de plateforme
-- ===========================================================================

alter table public.restaurants
  add column if not exists is_published boolean not null default true,
  add column if not exists onboarded_at timestamptz;

comment on column public.restaurants.is_published is
  'false = invisible dans l''app client. Sert pendant l''onboarding d''un '
  'partenaire : il monte son menu tranquillement avant d''ouvrir boutique.';

-- Les restaurants déjà en base sont considérés comme onboardés.
update public.restaurants set onboarded_at = created_at where onboarded_at is null;

-- ---------------------------------------------------------------------------
-- Conditions commerciales — table séparée, et ce n'est pas cosmétique.
--
-- `restaurants` est en LECTURE PUBLIQUE : c'est la vitrine, l'app client doit
-- l'afficher avant connexion (policy `restaurants_read_all`). Y ajouter une
-- colonne `commission_bps` publierait le taux négocié de chaque partenaire à
-- ses concurrents — et à n'importe qui avec la clé anon.
--
-- La parade « revoke select (colonne) » existe (c'est celle du code de
-- confirmation, migration 14), mais elle casserait tous les `select *` sur
-- `restaurants` dans les trois applications. Une table à part coûte une
-- jointure au seul endroit qui en a besoin, et c'est aussi là que vivront les
-- futurs champs de facturation (IBAN, périodicité, solde à reverser).
-- ---------------------------------------------------------------------------
create table if not exists public.restaurant_billing (
  restaurant_id   uuid primary key references public.restaurants(id) on delete cascade,
  commission_bps  integer not null default 0 check (commission_bps between 0 and 5000),
  billing_email   text,
  billing_note    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on column public.restaurant_billing.commission_bps is
  'Commission prélevée par la plateforme, en points de base (100 bps = 1%). '
  'Négociée par partenaire ; seul un ADMIN plateforme la modifie.';

drop trigger if exists trg_restaurant_billing_updated_at on public.restaurant_billing;
create trigger trg_restaurant_billing_updated_at
  before update on public.restaurant_billing
  for each row execute function public.fn_set_updated_at();

-- Chaque partenaire existant reçoit sa ligne, à 0 % : la commission se
-- négocie, elle ne s'invente pas dans une migration.
insert into public.restaurant_billing (restaurant_id)
select id from public.restaurants
on conflict (restaurant_id) do nothing;

-- ===========================================================================
-- 2. Appartenance à un restaurant
-- ===========================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'restaurant_role') then
    create type public.restaurant_role as enum ('OWNER', 'MANAGER', 'STAFF');
  end if;
end;
$$;

comment on type public.restaurant_role is
  'OWNER  : tout, y compris l''équipe et les paramètres de l''établissement. '
  'MANAGER: exploitation complète (menu, promos, zones, livreurs) sans l''équipe. '
  'STAFF  : service au quotidien — commandes et disponibilité des produits.';

create table if not exists public.restaurant_members (
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  profile_id     uuid not null references public.profiles(id)    on delete cascade,
  role           public.restaurant_role not null default 'STAFF',
  job_title      text,
  invited_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (restaurant_id, profile_id)
);

create index if not exists idx_restaurant_members_profile
  on public.restaurant_members (profile_id);

drop trigger if exists trg_restaurant_members_updated_at on public.restaurant_members;
create trigger trg_restaurant_members_updated_at
  before update on public.restaurant_members
  for each row execute function public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- Reprise de l'existant : chaque staff rattaché à un restaurant devient
-- membre. Le plus ancien de chaque établissement en devient le propriétaire —
-- sans quoi personne ne pourrait plus rien administrer après cette migration.
-- ---------------------------------------------------------------------------
insert into public.restaurant_members (restaurant_id, profile_id, role, created_at)
select
  p.restaurant_id,
  p.id,
  case
    when row_number() over (partition by p.restaurant_id order by p.created_at) = 1
      then 'OWNER'::public.restaurant_role
    else 'MANAGER'::public.restaurant_role
  end,
  p.created_at
from public.profiles p
where p.restaurant_id is not null
  and p.role in ('RESTAURANT_STAFF', 'ADMIN', 'SUPER_ADMIN')
on conflict (restaurant_id, profile_id) do nothing;

-- ---------------------------------------------------------------------------
-- Synchronisation membre → profil.
--
-- L'app livreur et la contrainte `profiles_staff_needs_restaurant` lisent
-- `profiles.restaurant_id`. On le remplit à l'ajout d'un membre, et on le
-- vide au retrait du dernier rattachement — en repassant le compte en
-- CUSTOMER, sinon la contrainte casse à la prochaine écriture du profil.
-- ---------------------------------------------------------------------------
create or replace function public.fn_sync_member_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining uuid;
  v_was_bypassed boolean := public.fn_guards_bypassed();
begin
  -- `trg_profiles_guard` (migration 07b) restaure `role` et `restaurant_id`
  -- pour tout appelant qui n'est pas ADMIN plateforme. Sans ce drapeau, un
  -- propriétaire qui ajoute un membre verrait son écriture annulée en
  -- silence : la ligne d'appartenance existerait, mais le profil resterait
  -- CUSTOMER et l'app livreur ne saurait pas où rattacher la personne.
  --
  -- Le drapeau est posé `is_local` — il meurt avec la transaction — et on le
  -- rend dans l'état où on l'a trouvé, pour ne pas ouvrir les gardes au reste
  -- d'une transaction qui ne l'avait pas demandé.
  perform set_config('app.bypass_guards', 'on', true);

  if tg_op in ('INSERT', 'UPDATE') then
    update public.profiles
    set restaurant_id = new.restaurant_id,
        role = case when role in ('ADMIN', 'SUPER_ADMIN') then role
                    else 'RESTAURANT_STAFF'::public.user_role end
    where id = new.profile_id
      and (restaurant_id is distinct from new.restaurant_id
           or role not in ('RESTAURANT_STAFF', 'ADMIN', 'SUPER_ADMIN'));

    if not v_was_bypassed then
      perform set_config('app.bypass_guards', '', true);
    end if;
    return new;
  end if;

  -- DELETE : reste-t-il un autre rattachement ?
  select restaurant_id into v_remaining
  from public.restaurant_members
  where profile_id = old.profile_id
  order by created_at
  limit 1;

  update public.profiles
  set restaurant_id = v_remaining,
      role = case
               when role in ('ADMIN', 'SUPER_ADMIN') then role
               when v_remaining is null then 'CUSTOMER'::public.user_role
               else role
             end
  where id = old.profile_id;

  if not v_was_bypassed then
    perform set_config('app.bypass_guards', '', true);
  end if;
  return old;
end;
$$;

drop trigger if exists trg_restaurant_members_sync on public.restaurant_members;
create trigger trg_restaurant_members_sync
  after insert or update or delete on public.restaurant_members
  for each row execute function public.fn_sync_member_profile();

/**
 * Un établissement garde toujours un propriétaire.
 *
 * `fn_remove_restaurant_member` vérifie déjà le cas de la suppression, mais
 * `setMemberRole` passe par un UPDATE direct sur la table : sans ce garde-fou,
 * l'unique propriétaire pouvait se rétrograder en « Gérant » et rendre son
 * propre établissement inadministrable — plus personne pour inviter qui que
 * ce soit, y compris lui-même.
 */
create or replace function public.fn_guard_last_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role <> 'OWNER' or new.role = 'OWNER' then
    return new;
  end if;

  if (select count(*) from public.restaurant_members
      where restaurant_id = old.restaurant_id and role = 'OWNER') <= 1 then
    raise exception 'Un établissement doit garder au moins un propriétaire. '
                    'Nommez d''abord un autre propriétaire.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_restaurant_members_last_owner on public.restaurant_members;
create trigger trg_restaurant_members_last_owner
  before update on public.restaurant_members
  for each row execute function public.fn_guard_last_owner();

-- ===========================================================================
-- 3. Prédicats d'autorisation
--
-- Tous SECURITY DEFINER et STABLE : ils lisent `restaurant_members` et
-- `profiles` sans redéclencher la RLS de ces tables (cf. migration 10, la
-- récursion de policy), et le planificateur ne les rappelle pas par ligne.
-- ===========================================================================

/**
 * Repli de `unaccent` : l'extension n'est pas garantie sur toutes les
 * instances, et on ne veut pas qu'un accent dans un nom d'enseigne fasse
 * échouer l'onboarding d'un partenaire au moment de calculer son slug.
 */
create or replace function public.unaccent_fallback(p_text text)
returns text
language sql
immutable
as $$
  select translate(
    p_text,
    'àáâãäåçèéêëìíîïñòóôõöùúûüýÿÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ',
    'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY'
  );
$$;

/** Administrateur de la plateforme — voit et gère tous les partenaires. */
create or replace function public.fn_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('ADMIN', 'SUPER_ADMIN') from public.profiles where id = auth.uid()),
    false
  );
$$;

/** Rôle de l'appelant dans un restaurant donné, null s'il n'en est pas membre. */
create or replace function public.fn_member_role(p_restaurant_id uuid)
returns public.restaurant_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.restaurant_members
  where restaurant_id = p_restaurant_id and profile_id = auth.uid();
$$;

/** Restaurants dont l'appelant est membre, quel que soit son rôle. */
create or replace function public.fn_my_restaurant_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    array(select restaurant_id from public.restaurant_members where profile_id = auth.uid()),
    '{}'::uuid[]
  );
$$;

/** Lecture : tableau de bord, commandes, clients d'un établissement. */
create or replace function public.fn_can_view_restaurant(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_is_platform_admin()
      or public.fn_member_role(p_restaurant_id) is not null;
$$;

/**
 * Service : faire tourner le comptoir.
 *
 * Accepter une commande, la passer en cuisine, assigner un livreur, signaler
 * une rupture de stock — tout membre le fait, y compris le rôle STAFF. C'est
 * précisément le travail de la personne à la caisse ; le lui interdire
 * l'obligerait à réveiller le gérant à chaque plat épuisé.
 *
 * Aujourd'hui l'ensemble coïncide avec `fn_can_view_restaurant`. Les deux
 * restent distincts parce qu'ils répondent à des questions différentes, et
 * qu'un futur rôle en lecture seule (comptable, franchiseur) les séparera.
 */
create or replace function public.fn_can_serve_restaurant(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_is_platform_admin()
      or public.fn_member_role(p_restaurant_id) is not null;
$$;

/** Exploitation : menu, prix, promotions, zones, agrément des livreurs. */
create or replace function public.fn_can_manage_restaurant(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_is_platform_admin()
      or public.fn_member_role(p_restaurant_id) in ('OWNER', 'MANAGER');
$$;

/** Administration : équipe, paramètres et identité de l'établissement. */
create or replace function public.fn_can_admin_restaurant(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_is_platform_admin()
      or public.fn_member_role(p_restaurant_id) = 'OWNER';
$$;

-- --- Dérivés pour les tables qui ne portent pas de restaurant_id -----------

create or replace function public.fn_can_manage_product(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_can_manage_restaurant(
    (select restaurant_id from public.products where id = p_product_id)
  );
$$;

create or replace function public.fn_can_manage_option_group(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_can_manage_product(
    (select product_id from public.product_option_groups where id = p_group_id)
  );
$$;

/**
 * Écriture sur une commande : niveau service, pas niveau gérance.
 *
 * `fn_can_manage_order` porte mal son nom si on la lit comme « gérer » au
 * sens de `fn_can_manage_restaurant` — c'est volontaire : ce qu'on fait sur
 * une commande (statut, livraison, encaissement) relève du comptoir.
 */
create or replace function public.fn_can_manage_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_can_serve_restaurant(
    (select restaurant_id from public.orders where id = p_order_id)
  );
$$;

/**
 * Rupture de stock, sans donner accès aux prix.
 *
 * La RLS filtre des lignes, pas des colonnes : impossible d'écrire une policy
 * « STAFF peut modifier `is_available` mais pas `base_price` ». On passe donc
 * par une fonction SECURITY DEFINER dont la signature *est* la restriction —
 * même motif que le code de confirmation (migration 09).
 */
create or replace function public.fn_set_product_availability(
  p_product_id   uuid,
  p_is_available boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
begin
  select restaurant_id into v_restaurant from public.products where id = p_product_id;

  if v_restaurant is null then
    raise exception 'Produit introuvable.' using errcode = 'no_data_found';
  end if;

  if not public.fn_can_serve_restaurant(v_restaurant) then
    raise exception 'Produit hors de votre périmètre.' using errcode = '42501';
  end if;

  update public.products
  set is_available = p_is_available
  where id = p_product_id;
end;
$$;

create or replace function public.fn_can_view_order_as_staff(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_can_view_restaurant(
    (select restaurant_id from public.orders where id = p_order_id)
  );
$$;

create or replace function public.fn_can_manage_delivery(p_delivery_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_can_manage_order((select order_id from public.deliveries where id = p_delivery_id));
$$;

create or replace function public.fn_can_view_delivery_as_staff(p_delivery_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_can_view_order_as_staff(
    (select order_id from public.deliveries where id = p_delivery_id)
  );
$$;

/**
 * Un profil est lisible par le staff s'il gravite autour d'un de mes
 * établissements : collègue, livreur, ou client ayant déjà commandé.
 * L'ancienne policy ouvrait l'annuaire complet de la plateforme.
 */
create or replace function public.fn_staff_can_read_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_is_platform_admin()
    or exists (
      select 1 from public.restaurant_members m
      where m.profile_id = p_profile_id
        and m.restaurant_id = any (public.fn_my_restaurant_ids())
    )
    or exists (
      select 1 from public.drivers d
      where d.profile_id = p_profile_id
        and d.restaurant_id = any (public.fn_my_restaurant_ids())
    )
    or exists (
      select 1 from public.orders o
      where o.customer_id = p_profile_id
        and o.restaurant_id = any (public.fn_my_restaurant_ids())
    );
$$;

/** Une adresse n'est lisible par le staff que via une commande chez lui. */
create or replace function public.fn_staff_can_read_address(p_address_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_is_platform_admin()
    or exists (
      select 1 from public.orders o
      where o.address_id = p_address_id
        and o.restaurant_id = any (public.fn_my_restaurant_ids())
    );
$$;

-- ===========================================================================
-- 4. Policies réécrites — chaque `fn_is_staff()` non qualifié disparaît
-- ===========================================================================

-- --- restaurants ----------------------------------------------------------
-- La vitrine reste publique : l'app client doit s'afficher avant connexion.
-- En revanche seule l'équipe de l'établissement (ou la plateforme) l'édite,
-- et la création / suppression d'un partenaire reste à la plateforme.
drop policy if exists "restaurants_write_admin" on public.restaurants;
drop policy if exists "restaurants_update_own"  on public.restaurants;
drop policy if exists "restaurants_insert_platform" on public.restaurants;
drop policy if exists "restaurants_delete_platform" on public.restaurants;

create policy "restaurants_update_own" on public.restaurants
  for update using (public.fn_can_admin_restaurant(id))
  with check (public.fn_can_admin_restaurant(id));

create policy "restaurants_insert_platform" on public.restaurants
  for insert with check (public.fn_is_platform_admin());

create policy "restaurants_delete_platform" on public.restaurants
  for delete using (public.fn_is_platform_admin());

-- --- restaurant_members ---------------------------------------------------
alter table public.restaurant_members enable row level security;

drop policy if exists "restaurant_members_read"   on public.restaurant_members;
drop policy if exists "restaurant_members_manage" on public.restaurant_members;

-- On voit ses collègues, et sa propre ligne (utile pour connaître son rôle).
create policy "restaurant_members_read" on public.restaurant_members
  for select using (
    profile_id = auth.uid() or public.fn_can_view_restaurant(restaurant_id)
  );

create policy "restaurant_members_manage" on public.restaurant_members
  for all using (public.fn_can_admin_restaurant(restaurant_id))
  with check (public.fn_can_admin_restaurant(restaurant_id));

-- --- restaurant_billing ---------------------------------------------------
-- Le partenaire lit son taux (il a le droit de savoir ce qu'on lui prélève),
-- la plateforme seule l'écrit.
alter table public.restaurant_billing enable row level security;

drop policy if exists "restaurant_billing_read"  on public.restaurant_billing;
drop policy if exists "restaurant_billing_write" on public.restaurant_billing;

create policy "restaurant_billing_read" on public.restaurant_billing
  for select using (public.fn_can_admin_restaurant(restaurant_id));

create policy "restaurant_billing_write" on public.restaurant_billing
  for all using (public.fn_is_platform_admin())
  with check (public.fn_is_platform_admin());

-- --- opening_hours --------------------------------------------------------
drop policy if exists "opening_hours_write_staff" on public.opening_hours;
create policy "opening_hours_write_staff" on public.opening_hours
  for all using (public.fn_can_manage_restaurant(restaurant_id))
  with check (public.fn_can_manage_restaurant(restaurant_id));

-- --- catégories et produits ----------------------------------------------
drop policy if exists "categories_read_all"    on public.categories;
drop policy if exists "categories_write_staff" on public.categories;
create policy "categories_read_all" on public.categories
  for select using (is_active or public.fn_can_view_restaurant(restaurant_id));
create policy "categories_write_staff" on public.categories
  for all using (public.fn_can_manage_restaurant(restaurant_id))
  with check (public.fn_can_manage_restaurant(restaurant_id));

drop policy if exists "products_read_all"    on public.products;
drop policy if exists "products_write_staff" on public.products;
create policy "products_read_all" on public.products
  for select using (is_active or public.fn_can_view_restaurant(restaurant_id));
create policy "products_write_staff" on public.products
  for all using (public.fn_can_manage_restaurant(restaurant_id))
  with check (public.fn_can_manage_restaurant(restaurant_id));

drop policy if exists "option_groups_write_staff" on public.product_option_groups;
create policy "option_groups_write_staff" on public.product_option_groups
  for all using (public.fn_can_manage_product(product_id))
  with check (public.fn_can_manage_product(product_id));

drop policy if exists "product_options_write_staff" on public.product_options;
create policy "product_options_write_staff" on public.product_options
  for all using (public.fn_can_manage_option_group(group_id))
  with check (public.fn_can_manage_option_group(group_id));

-- --- zones de livraison ---------------------------------------------------
drop policy if exists "delivery_zones_read_all"   on public.delivery_zones;
drop policy if exists "delivery_zones_write_admin" on public.delivery_zones;
create policy "delivery_zones_read_all" on public.delivery_zones
  for select using (is_active or public.fn_can_view_restaurant(restaurant_id));
create policy "delivery_zones_write_admin" on public.delivery_zones
  for all using (public.fn_can_manage_restaurant(restaurant_id))
  with check (public.fn_can_manage_restaurant(restaurant_id));

-- --- promotions -----------------------------------------------------------
drop policy if exists "promotions_read_public"  on public.promotions;
drop policy if exists "promotions_write_admin"  on public.promotions;
create policy "promotions_read_public" on public.promotions
  for select using (
    public.fn_can_view_restaurant(restaurant_id)
    or (is_active and code is null and now() between starts_at and coalesce(ends_at, 'infinity'))
  );
create policy "promotions_write_admin" on public.promotions
  for all using (public.fn_can_manage_restaurant(restaurant_id))
  with check (public.fn_can_manage_restaurant(restaurant_id));

drop policy if exists "promotion_products_write_admin" on public.promotion_products;
create policy "promotion_products_write_admin" on public.promotion_products
  for all using (
    public.fn_can_manage_restaurant(
      (select r.restaurant_id from public.promotions r where r.id = promotion_id)
    )
  )
  with check (
    public.fn_can_manage_restaurant(
      (select r.restaurant_id from public.promotions r where r.id = promotion_id)
    )
  );

drop policy if exists "promotion_redemptions_read_own" on public.promotion_redemptions;
create policy "promotion_redemptions_read_own" on public.promotion_redemptions
  for select using (
    profile_id = auth.uid()
    or public.fn_can_view_restaurant(
      (select r.restaurant_id from public.promotions r where r.id = promotion_id)
    )
  );

-- --- livreurs -------------------------------------------------------------
drop policy if exists "drivers_read_staff"    on public.drivers;
drop policy if exists "drivers_manage_admin"  on public.drivers;
create policy "drivers_read_staff" on public.drivers
  for select using (public.fn_can_view_restaurant(restaurant_id));
create policy "drivers_manage_admin" on public.drivers
  for all using (public.fn_can_manage_restaurant(restaurant_id))
  with check (public.fn_can_manage_restaurant(restaurant_id));

-- --- profils et adresses --------------------------------------------------
drop policy if exists "profiles_read_staff"   on public.profiles;
drop policy if exists "profiles_manage_admin" on public.profiles;
create policy "profiles_read_staff" on public.profiles
  for select using (public.fn_staff_can_read_profile(id));
create policy "profiles_manage_admin" on public.profiles
  for all using (public.fn_is_platform_admin())
  with check (public.fn_is_platform_admin());

drop policy if exists "addresses_read_staff" on public.addresses;
create policy "addresses_read_staff" on public.addresses
  for select using (public.fn_staff_can_read_address(id));

-- --- commandes ------------------------------------------------------------
drop policy if exists "orders_read_staff"   on public.orders;
drop policy if exists "orders_update_staff" on public.orders;
create policy "orders_read_staff" on public.orders
  for select using (public.fn_can_view_restaurant(restaurant_id));
create policy "orders_update_staff" on public.orders
  for update using (public.fn_can_serve_restaurant(restaurant_id))
  with check (true);

drop policy if exists "order_items_manage_staff" on public.order_items;
create policy "order_items_manage_staff" on public.order_items
  for all using (public.fn_can_manage_order(order_id))
  with check (public.fn_can_manage_order(order_id));

drop policy if exists "order_item_options_manage_staff" on public.order_item_options;
create policy "order_item_options_manage_staff" on public.order_item_options
  for all using (
    public.fn_can_manage_order(
      (select oi.order_id from public.order_items oi where oi.id = order_item_id)
    )
  )
  with check (
    public.fn_can_manage_order(
      (select oi.order_id from public.order_items oi where oi.id = order_item_id)
    )
  );

drop policy if exists "payments_manage_staff" on public.payments;
create policy "payments_manage_staff" on public.payments
  for all using (public.fn_can_manage_order(order_id))
  with check (public.fn_can_manage_order(order_id));

drop policy if exists "reviews_read_staff" on public.reviews;
create policy "reviews_read_staff" on public.reviews
  for select using (public.fn_can_view_order_as_staff(order_id));

-- --- livraisons et positions ---------------------------------------------
drop policy if exists "deliveries_read_staff"   on public.deliveries;
drop policy if exists "deliveries_manage_staff" on public.deliveries;
create policy "deliveries_read_staff" on public.deliveries
  for select using (public.fn_can_view_order_as_staff(order_id));
create policy "deliveries_manage_staff" on public.deliveries
  for all using (public.fn_can_manage_order(order_id))
  with check (public.fn_can_manage_order(order_id));

drop policy if exists "driver_locations_read_staff" on public.driver_locations;
create policy "driver_locations_read_staff" on public.driver_locations
  for select using (
    public.fn_can_view_restaurant(
      (select d.restaurant_id from public.drivers d where d.id = driver_id)
    )
  );

-- --- notifications --------------------------------------------------------
-- Le staff n'avait aucune raison de lire la boîte de n'importe qui : les
-- notifications sont écrites par les triggers, pas par le dashboard.
drop policy if exists "notifications_manage_staff" on public.notifications;
create policy "notifications_insert_platform" on public.notifications
  for insert with check (public.fn_is_platform_admin());

-- ===========================================================================
-- 5. Garde-fous dans les fonctions métier
--
-- Ces fonctions sont SECURITY DEFINER : la RLS ne s'y applique pas. Sans
-- vérification explicite, `fn_advance_order_status` permettait à n'importe
-- quel compte connecté de faire avancer n'importe quelle commande.
--
-- `auth.uid() is null` = appel serveur (pg_cron du mode démo, service_role,
-- Edge Function) : ces contextes sont déjà de confiance.
-- ===========================================================================

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

  -- Qui a le droit de bouger cette commande ?
  --   le restaurant qui la prépare · le livreur qui la porte ·
  --   le client, et seulement pour l'annuler tant que rien n'est parti en
  --   cuisine · la plateforme · le serveur lui-même.
  if not (
    auth.uid() is null
    or public.fn_can_serve_restaurant(v_order.restaurant_id)
    or public.fn_is_order_driver(p_order_id)
    or (
      v_order.customer_id = auth.uid()
      and p_to = 'CANCELLED'
      and v_order.status in ('NEW', 'ACCEPTED')
    )
  ) then
    raise exception 'Vous n''êtes pas autorisé à modifier cette commande.'
      using errcode = '42501';
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

-- ---------------------------------------------------------------------------
-- Assignation : le restaurant de la commande, avec un livreur de ce même
-- restaurant. Croiser les deux était possible avant cette migration.
-- ---------------------------------------------------------------------------
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
  v_driver_restaurant uuid;
begin
  perform set_config('app.bypass_guards', 'on', true);

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Commande introuvable.' using errcode = 'no_data_found';
  end if;

  if not (auth.uid() is null or public.fn_can_serve_restaurant(v_order.restaurant_id)) then
    raise exception 'Réservé à l''équipe du restaurant concerné.' using errcode = '42501';
  end if;

  select restaurant_id into v_driver_restaurant from public.drivers where id = p_driver_id;
  if v_driver_restaurant is null then
    raise exception 'Livreur introuvable.' using errcode = 'no_data_found';
  end if;
  if v_driver_restaurant <> v_order.restaurant_id then
    raise exception 'Ce livreur n''est pas rattaché au restaurant de la commande.'
      using errcode = 'check_violation';
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

-- ---------------------------------------------------------------------------
-- Statistiques : le chiffre d'affaires d'un partenaire ne regarde que lui.
-- Les trois fonctions passent en plpgsql pour porter le contrôle d'accès.
-- ---------------------------------------------------------------------------
create or replace function public.fn_dashboard_stats(
  p_restaurant_id uuid,
  p_from timestamptz default date_trunc('day', now()),
  p_to   timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.fn_can_view_restaurant(p_restaurant_id) then
    raise exception 'Restaurant hors de votre périmètre.' using errcode = '42501';
  end if;

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
  into v_result
  from public.orders o
  where o.restaurant_id = p_restaurant_id
    and o.created_at >= p_from
    and o.created_at <= p_to;

  return v_result;
end;
$$;

create or replace function public.fn_sales_series(
  p_restaurant_id uuid,
  p_bucket        text default 'day',
  p_from          timestamptz default now() - interval '30 days',
  p_to            timestamptz default now()
)
returns table (bucket timestamptz, revenue bigint, orders bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
-- Même précaution que dans `fn_top_products` : la colonne de sortie `orders`
-- porte le nom d'une table du schéma, et `bucket` celui d'une fonction.
#variable_conflict use_column
begin
  if not public.fn_can_view_restaurant(p_restaurant_id) then
    raise exception 'Restaurant hors de votre périmètre.' using errcode = '42501';
  end if;

  return query
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
end;
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
language plpgsql
stable
security definer
set search_path = public
as $$
-- En plpgsql, les colonnes de sortie d'un `returns table` deviennent des
-- variables : `order by quantity` se résoudrait sur la variable, pas sur la
-- colonne, et PostgreSQL lèverait une ambiguïté. Cette directive tranche en
-- faveur de la colonne — la version précédente était en `language sql` et
-- n'avait pas ce problème.
#variable_conflict use_column
begin
  if not public.fn_can_view_restaurant(p_restaurant_id) then
    raise exception 'Restaurant hors de votre périmètre.' using errcode = '42501';
  end if;

  return query
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
  order by 4 desc
  limit p_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- Le code de confirmation : même correction de périmètre. `fn_is_staff()`
-- l'ouvrait à toute la plateforme, y compris au staff d'un concurrent.
--
-- On conserve le retour `null` (et non une exception) pour l'appelant non
-- autorisé : c'était le choix de la migration 09, et il vaut toujours —
-- inutile d'indiquer au livreur qu'il y a quelque chose à forcer.
-- ---------------------------------------------------------------------------
create or replace function public.fn_order_confirmation_code(p_order_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_customer   uuid;
  v_code       text;
begin
  select o.restaurant_id, o.customer_id, d.confirmation_code
  into v_restaurant, v_customer, v_code
  from public.orders o
  join public.deliveries d on d.order_id = o.id
  where o.id = p_order_id;

  if not found then
    return null;
  end if;

  if v_customer = auth.uid() or public.fn_can_view_restaurant(v_restaurant) then
    return v_code;
  end if;

  return null;
end;
$$;

-- ===========================================================================
-- 6. Gestion de l'équipe et onboarding d'un partenaire
-- ===========================================================================

/**
 * Ajoute un membre à l'équipe à partir de son e-mail.
 *
 * On ne crée pas le compte : la personne s'inscrit d'abord depuis l'app (ou
 * reçoit une invitation Supabase Auth), puis le propriétaire la rattache. Créer
 * un utilisateur depuis SQL supposerait la clé service_role dans le navigateur.
 */
create or replace function public.fn_add_restaurant_member(
  p_restaurant_id uuid,
  p_email         text,
  p_role          public.restaurant_role default 'STAFF',
  p_job_title     text default null
)
returns public.restaurant_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_member     public.restaurant_members%rowtype;
begin
  if not public.fn_can_admin_restaurant(p_restaurant_id) then
    raise exception 'Seul le propriétaire de l''établissement gère son équipe.'
      using errcode = '42501';
  end if;

  select id into v_profile_id
  from public.profiles
  where lower(email) = lower(trim(p_email))
  limit 1;

  if v_profile_id is null then
    raise exception 'Aucun compte Istanbul avec l''adresse %. La personne doit d''abord créer son compte.',
      p_email using errcode = 'no_data_found';
  end if;

  insert into public.restaurant_members (restaurant_id, profile_id, role, job_title, invited_by)
  values (p_restaurant_id, v_profile_id, p_role, p_job_title, auth.uid())
  on conflict (restaurant_id, profile_id) do update
    set role = excluded.role,
        job_title = coalesce(excluded.job_title, public.restaurant_members.job_title)
  returning * into v_member;

  return v_member;
end;
$$;

/**
 * Retire un membre.
 *
 * Un établissement sans propriétaire n'est plus administrable par personne
 * hormis la plateforme : on refuse de retirer le dernier OWNER.
 */
create or replace function public.fn_remove_restaurant_member(
  p_restaurant_id uuid,
  p_profile_id    uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role    public.restaurant_role;
  v_owners  integer;
begin
  if not public.fn_can_admin_restaurant(p_restaurant_id) then
    raise exception 'Seul le propriétaire de l''établissement gère son équipe.'
      using errcode = '42501';
  end if;

  select role into v_role from public.restaurant_members
  where restaurant_id = p_restaurant_id and profile_id = p_profile_id;

  if v_role is null then
    return;
  end if;

  if v_role = 'OWNER' then
    select count(*) into v_owners from public.restaurant_members
    where restaurant_id = p_restaurant_id and role = 'OWNER';

    if v_owners <= 1 then
      raise exception 'Un établissement doit garder au moins un propriétaire.'
        using errcode = 'check_violation';
    end if;
  end if;

  delete from public.restaurant_members
  where restaurant_id = p_restaurant_id and profile_id = p_profile_id;
end;
$$;

/**
 * Onboarding d'un partenaire par la plateforme.
 *
 * Crée l'établissement non publié, son propriétaire, une grille de zones de
 * livraison par défaut et des horaires 7j/7 — sans quoi le partenaire arrive
 * sur un dashboard qui ne sait rien tarifer.
 */
create or replace function public.fn_create_restaurant(
  p_name          text,
  p_phone         text,
  p_address_line  text,
  p_latitude      double precision,
  p_longitude     double precision,
  p_owner_email   text default null,
  p_commission_bps integer default 0,
  p_city          text default 'Kinshasa'
)
returns public.restaurants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant public.restaurants%rowtype;
  v_slug       text;
  v_suffix     integer := 0;
  v_owner      uuid;
begin
  if not public.fn_is_platform_admin() then
    raise exception 'Réservé à l''administration de la plateforme.' using errcode = '42501';
  end if;

  v_slug := regexp_replace(lower(unaccent_fallback(p_name)), '[^a-z0-9]+', '-', 'g');
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then v_slug := 'restaurant'; end if;

  while exists (select 1 from public.restaurants where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := trim(both '-' from
      regexp_replace(lower(unaccent_fallback(p_name)), '[^a-z0-9]+', '-', 'g')) || '-' || v_suffix;
  end loop;

  insert into public.restaurants (
    name, slug, phone, address_line, city, latitude, longitude,
    is_published, is_accepting_orders, onboarded_at
  ) values (
    p_name, v_slug, p_phone, p_address_line, p_city, p_latitude, p_longitude,
    false, false, now()
  )
  returning * into v_restaurant;

  insert into public.restaurant_billing (restaurant_id, commission_bps)
  values (v_restaurant.id, coalesce(p_commission_bps, 0));

  -- Horaires par défaut : 10h–22h tous les jours, à ajuster au dashboard.
  insert into public.opening_hours (restaurant_id, day_of_week, opens_at, closes_at)
  select v_restaurant.id, d, time '10:00', time '22:00' from generate_series(0, 6) as d;

  -- Grille de livraison par défaut, calquée sur celle du seed Kinshasa.
  insert into public.delivery_zones
    (restaurant_id, name, min_distance_km, max_distance_km, fee_amount, eta_minutes, sort_order)
  values
    (v_restaurant.id, '0–3 km',  0, 3,  150, 25, 0),
    (v_restaurant.id, '3–6 km',  3, 6,  250, 35, 1),
    (v_restaurant.id, '6–10 km', 6, 10, 400, 50, 2);

  if p_owner_email is not null then
    select id into v_owner from public.profiles
    where lower(email) = lower(trim(p_owner_email)) limit 1;

    if v_owner is null then
      raise exception 'Aucun compte avec l''adresse % : créez-le avant d''ouvrir l''établissement.',
        p_owner_email using errcode = 'no_data_found';
    end if;

    insert into public.restaurant_members (restaurant_id, profile_id, role, invited_by)
    values (v_restaurant.id, v_owner, 'OWNER', auth.uid());
  end if;

  return v_restaurant;
end;
$$;

/** Les établissements que l'appelant peut ouvrir dans le dashboard. */
create or replace function public.fn_my_restaurants()
returns table (
  id uuid,
  name text,
  slug text,
  logo_url text,
  city text,
  is_open boolean,
  is_accepting_orders boolean,
  is_published boolean,
  member_role text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id, r.name, r.slug, r.logo_url, r.city,
    r.is_open, r.is_accepting_orders, r.is_published,
    coalesce(m.role::text, 'PLATFORM') as member_role
  from public.restaurants r
  left join public.restaurant_members m
    on m.restaurant_id = r.id and m.profile_id = auth.uid()
  where m.profile_id is not null or public.fn_is_platform_admin()
  order by r.name;
$$;

-- ===========================================================================
-- 7. Droits d'exécution
-- ===========================================================================

grant select, insert, update, delete on public.restaurant_members to authenticated;
grant select, insert, update, delete on public.restaurant_billing to authenticated;

revoke all on function public.fn_add_restaurant_member    from public, anon;
revoke all on function public.fn_remove_restaurant_member from public, anon;
revoke all on function public.fn_create_restaurant        from public, anon;
revoke all on function public.fn_my_restaurants           from public, anon;

grant execute on function public.fn_add_restaurant_member    to authenticated;
grant execute on function public.fn_remove_restaurant_member to authenticated;
grant execute on function public.fn_create_restaurant        to authenticated;
grant execute on function public.fn_my_restaurants           to authenticated;

grant execute on function public.fn_is_platform_admin        to authenticated, anon;
grant execute on function public.fn_member_role              to authenticated;
grant execute on function public.fn_my_restaurant_ids        to authenticated;
grant execute on function public.fn_can_view_restaurant      to authenticated, anon;
grant execute on function public.fn_can_serve_restaurant     to authenticated, anon;
grant execute on function public.fn_can_manage_restaurant    to authenticated, anon;
grant execute on function public.fn_can_admin_restaurant     to authenticated, anon;
grant execute on function public.fn_can_manage_product       to authenticated, anon;
grant execute on function public.fn_can_manage_option_group  to authenticated, anon;
grant execute on function public.fn_can_manage_order         to authenticated, anon;
grant execute on function public.fn_can_view_order_as_staff  to authenticated, anon;
grant execute on function public.fn_can_manage_delivery      to authenticated, anon;
grant execute on function public.fn_can_view_delivery_as_staff to authenticated, anon;
grant execute on function public.fn_staff_can_read_profile   to authenticated, anon;
grant execute on function public.fn_staff_can_read_address   to authenticated, anon;
grant execute on function public.unaccent_fallback           to authenticated, anon;

revoke all on function public.fn_set_product_availability from public, anon;
grant execute on function public.fn_set_product_availability to authenticated;

-- Realtime : le dashboard écoute déjà `orders`, l'équipe doit voir arriver
-- les changements d'effectif sans recharger la page.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.restaurant_members;
  end if;
exception
  when duplicate_object then null;
end;
$$;
