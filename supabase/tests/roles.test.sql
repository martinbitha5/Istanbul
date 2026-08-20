-- ---------------------------------------------------------------------------
-- Tests pgTAP — séparation des rôles dans l'équipe (migrations 21 et 24).
--
-- Lancer :  pnpm test:db
--
-- Ce fichier remplace `multi_tenant.test.sql`, qui vérifiait qu'un partenaire
-- ne voyait pas les données d'un autre. Istanbul est de nouveau le seul
-- établissement (migration 24) : ce n'est plus deux restaurants qu'il faut
-- cloisonner, mais deux métiers.
--
-- La question posée ici est donc : **la personne à la caisse peut-elle faire
-- tourner le service sans pouvoir toucher aux prix, à l'équipe, ni au chiffre
-- d'affaires ?** Et symétriquement : un client connecté n'a-t-il vraiment
-- aucune prise sur l'exploitation ?
--
-- Chaque assertion correspond à une brèche réelle d'avant la migration 21 :
-- `fn_is_staff()` répondait « oui » sans distinguer les rôles, et les
-- fonctions SECURITY DEFINER (statuts, stats) ne vérifiaient rien du tout.
-- ---------------------------------------------------------------------------

begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

-- ===========================================================================
-- Fixtures : un restaurant, un rôle par personne
--
-- `app.bypass_guards` lève le garde-fou mono-restaurant de la migration 24 —
-- la base locale porte déjà Istanbul via le seed. Le drapeau est local à la
-- transaction, et celle-ci finit en rollback.
-- ===========================================================================
select set_config('app.bypass_guards', 'on', false);

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'proprietaire@test.cd'),
  ('a0000000-0000-0000-0000-00000000000b', 'gerant@test.cd'),
  ('a0000000-0000-0000-0000-00000000000c', 'caisse@test.cd'),
  ('c0000000-0000-0000-0000-00000000000c', 'client@test.cd');

insert into public.restaurants (id, name, slug, phone, address_line, latitude, longitude)
values ('aaaa0000-0000-0000-0000-00000000000a', 'Istanbul Test', 'istanbul-test',
        '+243000000001', 'Avenue Test', -4.33, 15.31);

insert into public.restaurant_members (restaurant_id, profile_id, role) values
  ('aaaa0000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-00000000000a', 'OWNER'),
  ('aaaa0000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-00000000000b', 'MANAGER'),
  ('aaaa0000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-00000000000c', 'STAFF');

insert into public.products (id, restaurant_id, name, slug, base_price, is_active) values
  ('bbbb1111-0000-0000-0000-000000000001', 'aaaa0000-0000-0000-0000-00000000000a',
   'Shawarma test', 'shawarma-test', 9000, true);

insert into public.orders
  (id, restaurant_id, customer_id, fulfillment, status, contact_name, contact_phone, subtotal, total)
values
  ('bbbb3333-0000-0000-0000-000000000003', 'aaaa0000-0000-0000-0000-00000000000a',
   'c0000000-0000-0000-0000-00000000000c', 'PICKUP', 'NEW', 'Client', '+243800000000',
   7500, 7500);

select set_config('app.bypass_guards', '', false);

create or replace function pg_temp.impersonate(p_uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, false);
  execute 'set local role authenticated';
end;
$$;

-- Une écriture refusée par RLS ne lève pas d'erreur sur un UPDATE : elle ne
-- touche simplement aucune ligne. On compte donc les lignes affectées.
create or replace function pg_temp.updated_rows(p_sql text)
returns bigint language plpgsql as $$
declare v_count bigint;
begin
  execute p_sql;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ===========================================================================
-- 1. La couche plateforme n'existe plus (migration 24)
-- ===========================================================================
select hasnt_table('public', 'restaurant_billing',
  'la table des commissions a disparu');

select hasnt_function('public', 'fn_platform_revenue',
  'l''agrégat de revenus de la plateforme a disparu');

select hasnt_function('public', 'fn_create_restaurant',
  'l''onboarding d''un partenaire a disparu');

select hasnt_function('public', 'fn_my_restaurants',
  'la liste des établissements administrables a disparu');

select hasnt_function('public', 'fn_is_platform_admin',
  'le doublon de fn_is_admin a disparu');

select has_function('public', 'fn_dashboard_bootstrap',
  'l''amorçage du dashboard en un aller-retour est en place');

-- Le garde-fou mono-restaurant, drapeau retombé.
select throws_ok(
  $$ insert into public.restaurants (name, slug, phone, address_line, latitude, longitude)
     values ('Second resto', 'second-resto', '+243000000009', 'Avenue B', -4.34, 15.32) $$,
  '23514',
  null,
  'la base refuse un deuxième restaurant'
);

-- ===========================================================================
-- 2. Propriétaire : tout
-- ===========================================================================
select pg_temp.impersonate('a0000000-0000-0000-0000-00000000000a');

select is(public.fn_can_view_restaurant('aaaa0000-0000-0000-0000-00000000000a'), true,
  'le propriétaire consulte');
select is(public.fn_can_manage_restaurant('aaaa0000-0000-0000-0000-00000000000a'), true,
  'le propriétaire exploite');
select is(public.fn_can_admin_restaurant('aaaa0000-0000-0000-0000-00000000000a'), true,
  'le propriétaire administre l''équipe');

reset role;

-- ===========================================================================
-- 3. Gérant : l'exploitation, pas l'équipe
-- ===========================================================================
select pg_temp.impersonate('a0000000-0000-0000-0000-00000000000b');

select is(public.fn_can_manage_restaurant('aaaa0000-0000-0000-0000-00000000000a'), true,
  'le gérant touche aux prix et aux promotions');
select is(public.fn_can_admin_restaurant('aaaa0000-0000-0000-0000-00000000000a'), false,
  'le gérant n''administre pas l''équipe');

select is(
  pg_temp.updated_rows(
    $$ update public.products set base_price = 100
       where id = 'bbbb1111-0000-0000-0000-000000000001' $$),
  1::bigint,
  'le gérant change un prix'
);

select throws_ok(
  $$ select public.fn_add_restaurant_member(
       'aaaa0000-0000-0000-0000-00000000000a', 'client@test.cd', 'STAFF') $$,
  '42501',
  null,
  'le gérant ne recrute pas'
);

reset role;

-- ===========================================================================
-- 4. Équipe : le service, et rien d'autre
--
-- C'est la raison d'être du niveau « service » : le caissier signale une
-- rupture de stock et fait avancer les commandes sans que quiconque ait à lui
-- ouvrir la grille tarifaire.
-- ===========================================================================
select pg_temp.impersonate('a0000000-0000-0000-0000-00000000000c');

select is(public.fn_can_view_restaurant('aaaa0000-0000-0000-0000-00000000000a'), true,
  'l''équipe consulte le tableau de bord');
select is(public.fn_can_serve_restaurant('aaaa0000-0000-0000-0000-00000000000a'), true,
  'l''équipe fait tourner le service');
select is(public.fn_can_manage_restaurant('aaaa0000-0000-0000-0000-00000000000a'), false,
  'l''équipe ne touche pas aux prix ni aux promotions');
select is(public.fn_can_admin_restaurant('aaaa0000-0000-0000-0000-00000000000a'), false,
  'l''équipe n''administre pas l''équipe');

select is(
  pg_temp.updated_rows(
    $$ update public.products set base_price = 1
       where id = 'bbbb1111-0000-0000-0000-000000000001' $$),
  0::bigint,
  'l''équipe ne peut pas changer un prix'
);

select is(
  pg_temp.updated_rows(
    $$ update public.restaurants set name = 'Renommé'
       where id = 'aaaa0000-0000-0000-0000-00000000000a' $$),
  0::bigint,
  'l''équipe ne peut pas renommer l''établissement'
);

-- Positif : ce que le rôle STAFF doit pouvoir faire.
select lives_ok(
  $$ select public.fn_set_product_availability(
       'bbbb1111-0000-0000-0000-000000000001', false) $$,
  'l''équipe signale une rupture de stock'
);

select lives_ok(
  $$ select public.fn_advance_order_status(
       'bbbb3333-0000-0000-0000-000000000003', 'ACCEPTED') $$,
  'l''équipe accepte une commande'
);

reset role;

-- ===========================================================================
-- 5. Client connecté : aucune prise sur l'exploitation
--
-- Avant la migration 21, `fn_advance_order_status` n'avait aucun contrôle
-- d'appelant et `fn_dashboard_stats` servait le chiffre d'affaires à tout
-- compte connecté.
-- ===========================================================================
select pg_temp.impersonate('c0000000-0000-0000-0000-00000000000c');

select is(public.fn_can_view_restaurant('aaaa0000-0000-0000-0000-00000000000a'), false,
  'un client n''a pas accès au dashboard');

select throws_ok(
  $$ select public.fn_dashboard_stats('aaaa0000-0000-0000-0000-00000000000a') $$,
  '42501',
  null,
  'le chiffre d''affaires est refusé à un client'
);

select throws_ok(
  $$ select public.fn_sales_series('aaaa0000-0000-0000-0000-00000000000a') $$,
  '42501',
  null,
  'la série de ventes est refusée à un client'
);

select throws_ok(
  $$ select public.fn_top_products('aaaa0000-0000-0000-0000-00000000000a') $$,
  '42501',
  null,
  'le palmarès produits est refusé à un client'
);

select is(
  (select count(*) from public.restaurant_members),
  0::bigint,
  'un client ne voit pas l''équipe'
);

select throws_ok(
  $$ insert into public.products (restaurant_id, name, slug, base_price)
     values ('aaaa0000-0000-0000-0000-00000000000a', 'Intrus', 'intrus', 100) $$,
  '42501',
  null,
  'un client ne glisse pas un produit dans la carte'
);

reset role;

select * from finish();
rollback;
