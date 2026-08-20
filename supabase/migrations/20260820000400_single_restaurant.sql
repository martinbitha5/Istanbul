-- ---------------------------------------------------------------------------
-- Istanbul Fast Food — 24. Retour au mono-restaurant
--
-- Les migrations 21 à 23 ont construit une place de marché : plusieurs
-- partenaires, une commission par partenaire, un onboarding, un agrégat de
-- revenus. Le produit n'est pas ça — c'est le dashboard d'Istanbul Fast Food.
-- Cette migration retire la couche « plateforme » et verrouille la base sur
-- un établissement unique.
--
-- Ce qu'on GARDE, et pourquoi :
--
-- — `restaurant_id` sur toutes les tables. La colonne ne coûte rien, porte les
--   jointures existantes, et la retirer imposerait de réécrire chaque policy,
--   chaque fonction et chaque requête des trois apps pour un gain nul côté
--   utilisateur.
--
-- — Les prédicats `fn_can_{view,serve,manage,admin}_restaurant`. Ils ne
--   servent plus à cloisonner deux partenaires, mais à cloisonner deux
--   MÉTIERS : le caissier fait avancer une commande sans lire le chiffre
--   d'affaires. C'est la barrière de sécurité du dashboard, pas un reliquat.
--
-- — `restaurant_members` et ses trois rôles. C'est l'équipe d'Istanbul.
--
-- Ce qu'on RETIRE :
--
-- — `restaurant_billing` : la commission n'a de sens qu'entre une plateforme
--   et un partenaire tiers. Istanbul ne se facture pas lui-même.
-- — `fn_platform_revenue`, `fn_create_restaurant`, `fn_my_restaurants`.
-- — `fn_is_platform_admin`, qui s'avère être un doublon exact de `fn_is_admin`
--   (migration 06) : les appelants repassent sur l'original.
-- — La création d'un second restaurant, désormais refusée par un trigger.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. `fn_is_platform_admin` était un doublon de `fn_is_admin`
--
-- Les deux fonctions testent `role in ('ADMIN', 'SUPER_ADMIN')` sur le profil
-- de l'appelant, au caractère près : la migration 21 a créé la seconde sans
-- voir que la première existait depuis la migration 06. Il n'y a donc rien à
-- migrer, seulement à recâbler les appelants sur le nom d'origine avant de
-- supprimer le doublon.
-- ===========================================================================

comment on function public.fn_is_admin is
  'Compte ADMIN ou SUPER_ADMIN : accès complet au dashboard sans passer par '
  'restaurant_members. Absorbe fn_is_platform_admin (migration 21), qui en '
  'était un doublon exact.';

-- --- Prédicats d'autorisation, recâblés sur fn_is_admin --------------------
-- `create or replace` conserve l'OID : les ~30 policies qui les appellent
-- continuent de pointer dessus, rien à recréer.

create or replace function public.fn_can_view_restaurant(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_is_admin()
      or public.fn_member_role(p_restaurant_id) is not null;
$$;

create or replace function public.fn_can_serve_restaurant(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_is_admin()
      or public.fn_member_role(p_restaurant_id) is not null;
$$;

create or replace function public.fn_can_manage_restaurant(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_is_admin()
      or public.fn_member_role(p_restaurant_id) in ('OWNER', 'MANAGER');
$$;

create or replace function public.fn_can_admin_restaurant(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_is_admin()
      or public.fn_member_role(p_restaurant_id) = 'OWNER';
$$;

-- --- Lecture des profils et adresses par le staff --------------------------
-- `= any (fn_my_restaurant_ids())` disparaît au profit de
-- `fn_can_view_restaurant(...)` : strictement équivalent (l'expression ORe
-- déjà fn_is_admin), et une liste d'identifiants n'a plus de sens à un seul
-- établissement.

create or replace function public.fn_staff_can_read_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_is_admin()
    or exists (
      select 1 from public.restaurant_members m
      where m.profile_id = p_profile_id
        and public.fn_can_view_restaurant(m.restaurant_id)
    )
    or exists (
      select 1 from public.drivers d
      where d.profile_id = p_profile_id
        and public.fn_can_view_restaurant(d.restaurant_id)
    )
    or exists (
      select 1 from public.orders o
      where o.customer_id = p_profile_id
        and public.fn_can_view_restaurant(o.restaurant_id)
    );
$$;

create or replace function public.fn_staff_can_read_address(p_address_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_is_admin()
    or exists (
      select 1 from public.orders o
      where o.address_id = p_address_id
        and public.fn_can_view_restaurant(o.restaurant_id)
    );
$$;

-- --- Policies qui nommaient fn_is_platform_admin directement ---------------

drop policy if exists "profiles_manage_admin" on public.profiles;
create policy "profiles_manage_admin" on public.profiles
  for all using (public.fn_is_admin())
  with check (public.fn_is_admin());

drop policy if exists "notifications_insert_platform" on public.notifications;
create policy "notifications_insert_admin" on public.notifications
  for insert with check (public.fn_is_admin());

-- ===========================================================================
-- 2. Un seul établissement, définitivement
--
-- La création passait par `fn_create_restaurant`, réservée à la plateforme.
-- La fonction disparaît ; on ferme aussi la porte d'à côté (un `insert` direct
-- via PostgREST) plutôt que de compter sur le fait que plus personne ne
-- l'appelle. Une deuxième ligne dans `restaurants` casserait silencieusement
-- les apps, qui résolvent l'établissement par « la seule ligne de la table ».
--
-- Seul `app.bypass_guards` passe outre — le drapeau local de la migration 07b,
-- posé par les fixtures pgTAP qui montent leur propre restaurant de test dans
-- une transaction annulée. Il ne survit pas à la transaction, donc il ne peut
-- pas servir de porte dérobée en production.
-- ===========================================================================

drop policy if exists "restaurants_insert_platform" on public.restaurants;
drop policy if exists "restaurants_delete_platform" on public.restaurants;

create or replace function public.fn_guard_single_restaurant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.fn_guards_bypassed() then
    return new;
  end if;

  if exists (select 1 from public.restaurants) then
    raise exception
      'Istanbul Fast Food est mono-restaurant : la table restaurants ne peut contenir qu''une ligne.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_restaurants_single on public.restaurants;
create trigger trg_restaurants_single
  before insert on public.restaurants
  for each row execute function public.fn_guard_single_restaurant();

-- Fonction de trigger : jamais une RPC (cf. migration 22).
revoke all on function public.fn_guard_single_restaurant from public, anon, authenticated;

-- ===========================================================================
-- 3. Amorçage du dashboard en un aller-retour
--
-- Le dashboard demandait successivement : la session, le profil, puis la
-- liste des établissements — trois allers-retours en série avant d'afficher
-- quoi que ce soit, dont le dernier après hydratation. Sur un réseau mobile
-- kinois, cela faisait plusieurs secondes d'écran d'attente.
--
-- Cette fonction renvoie tout ce dont la coquille a besoin, en une requête
-- faite côté serveur Next.js : identité, établissement, rôle dans l'équipe.
-- `restaurant` est null si la base est vide (avant le seed) — l'appelant doit
-- gérer ce cas plutôt que de planter.
-- ===========================================================================

create or replace function public.fn_dashboard_bootstrap()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'profile',    (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'restaurant', (select to_jsonb(r) from public.restaurants r order by r.created_at limit 1),
    'role',       (select m.role::text
                   from public.restaurant_members m
                   where m.profile_id = auth.uid()
                   limit 1),
    'is_admin',   public.fn_is_admin()
  );
$$;

comment on function public.fn_dashboard_bootstrap is
  'Tout ce que la coquille du dashboard doit savoir avant son premier rendu, '
  'en un aller-retour : profil de l''appelant, fiche de l''établissement, rôle '
  'dans l''équipe. Ne renvoie que des données déjà lisibles par l''appelant.';

revoke all on function public.fn_dashboard_bootstrap from public, anon;
grant execute on function public.fn_dashboard_bootstrap to authenticated;

-- ===========================================================================
-- 4. Suppression de la couche plateforme
-- ===========================================================================

drop function if exists public.fn_platform_revenue(timestamptz, timestamptz);
drop function if exists public.fn_create_restaurant(
  text, text, text, double precision, double precision, text, integer, text
);
drop function if exists public.fn_my_restaurants();

-- Plus aucun appelant depuis la réécriture de fn_staff_can_read_* ci-dessus.
drop function if exists public.fn_my_restaurant_ids();

-- La commission n'a de sens qu'entre une plateforme et un partenaire tiers.
-- `cascade` emporte ses policies et son trigger updated_at.
drop table if exists public.restaurant_billing cascade;

-- En dernier : plus aucune policy ni fonction ne la référence.
drop function if exists public.fn_is_platform_admin();

-- `unaccent_fallback` ne servait qu'au calcul du slug dans
-- `fn_create_restaurant`. Le slug d'Istanbul est figé depuis le seed.
drop function if exists public.unaccent_fallback(text);

comment on function public.fn_can_view_restaurant is
  'Prédicat d''autorisation. Exécutable par anon À DESSEIN : les policies de '
  'lecture publique du catalogue l''évaluent avant connexion. Renvoie toujours '
  'false quand auth.uid() est null.';
