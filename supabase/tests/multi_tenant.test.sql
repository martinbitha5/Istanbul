-- ---------------------------------------------------------------------------
-- Tests pgTAP — cloisonnement multi-restaurants (migration 21).
--
-- Lancer :  pnpm test:db
--
-- Ce fichier ne teste qu'une chose, mais sous tous les angles : **le staff du
-- partenaire A ne peut rien voir, rien écrire et rien déclencher chez B.**
--
-- Chaque assertion correspond à une brèche réelle d'avant la migration :
-- `fn_is_staff()` répondait « oui » sans regarder de quel restaurant il
-- s'agissait, et les fonctions SECURITY DEFINER (statuts, stats, assignation)
-- ne vérifiaient rien du tout.
-- ---------------------------------------------------------------------------

begin;
create extension if not exists pgtap with schema extensions;

select plan(21);

-- ===========================================================================
-- Fixtures : deux partenaires, un staff chacun
-- ===========================================================================
select set_config('app.bypass_guards', 'on', false);

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'owner-a@test.cd'),
  ('b0000000-0000-0000-0000-00000000000b', 'owner-b@test.cd'),
  ('c0000000-0000-0000-0000-00000000000c', 'client@test.cd'),
  ('50000000-0000-0000-0000-000000000005', 'equipe-a@test.cd');

insert into public.restaurants (id, name, slug, phone, address_line, latitude, longitude) values
  ('aaaa0000-0000-0000-0000-00000000000a', 'Chez A', 'chez-a',
   '+243000000001', 'Avenue A', -4.33, 15.31),
  ('bbbb0000-0000-0000-0000-00000000000b', 'Chez B', 'chez-b',
   '+243000000002', 'Avenue B', -4.34, 15.32);

-- Les conditions commerciales sont créées par `fn_create_restaurant` en
-- production ; ici les restaurants sont insérés à la main, on pose donc les
-- deux lignes explicitement.
insert into public.restaurant_billing (restaurant_id, commission_bps) values
  ('aaaa0000-0000-0000-0000-00000000000a', 1200),
  ('bbbb0000-0000-0000-0000-00000000000b', 800);

insert into public.restaurant_members (restaurant_id, profile_id, role) values
  ('aaaa0000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-00000000000a', 'OWNER'),
  ('bbbb0000-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-00000000000b', 'OWNER'),
  ('aaaa0000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000005', 'STAFF');

-- Un produit inactif chez B : invisible au public, et il doit le rester pour A.
insert into public.products (id, restaurant_id, name, slug, base_price, is_active) values
  ('bbbb1111-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-00000000000b',
   'Secret de B', 'secret-de-b', 9000, false);

insert into public.categories (id, restaurant_id, name, slug) values
  ('bbbb2222-0000-0000-0000-000000000002', 'bbbb0000-0000-0000-0000-00000000000b',
   'Carte de B', 'carte-de-b');

-- Une commande livrée chez B : c'est le chiffre d'affaires que A ne doit pas voir.
insert into public.orders
  (id, restaurant_id, customer_id, fulfillment, status, contact_name, contact_phone, subtotal, total)
values
  ('bbbb3333-0000-0000-0000-000000000003', 'bbbb0000-0000-0000-0000-00000000000b',
   'c0000000-0000-0000-0000-00000000000c', 'PICKUP', 'DELIVERED', 'Client', '+243800000000',
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

-- ===========================================================================
-- Propriétaire de A face aux données de B
-- ===========================================================================
select pg_temp.impersonate('a0000000-0000-0000-0000-00000000000a');

select is(
  public.fn_can_view_restaurant('bbbb0000-0000-0000-0000-00000000000b'),
  false,
  'A n''a pas le droit de consulter B'
);

select is(
  public.fn_can_manage_restaurant('aaaa0000-0000-0000-0000-00000000000a'),
  true,
  'A administre bien son propre établissement'
);

-- Lecture -------------------------------------------------------------------
select is(
  (select count(*) from public.products
   where restaurant_id = 'bbbb0000-0000-0000-0000-00000000000b'),
  0::bigint,
  'A ne voit pas le produit désactivé de B'
);

select is(
  (select count(*) from public.orders
   where restaurant_id = 'bbbb0000-0000-0000-0000-00000000000b'),
  0::bigint,
  'A ne voit aucune commande de B'
);

-- Écriture ------------------------------------------------------------------
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

select is(
  pg_temp.updated_rows(
    $$ update public.products set base_price = 1
       where id = 'bbbb1111-0000-0000-0000-000000000001' $$),
  0::bigint,
  'A ne peut pas changer le prix d''un produit de B'
);

select is(
  pg_temp.updated_rows(
    $$ update public.categories set name = 'Piraté'
       where id = 'bbbb2222-0000-0000-0000-000000000002' $$),
  0::bigint,
  'A ne peut pas renommer une catégorie de B'
);

select is(
  pg_temp.updated_rows(
    $$ update public.restaurants set is_accepting_orders = false
       where id = 'bbbb0000-0000-0000-0000-00000000000b' $$),
  0::bigint,
  'A ne peut pas fermer les commandes de B'
);

-- La commission est la donnée la plus sensible de la place de marché : ni un
-- concurrent, ni le partenaire lui-même ne doit pouvoir la réécrire.
select is(
  (select count(*) from public.restaurant_billing),
  1::bigint,
  'A ne voit que ses propres conditions commerciales'
);

select is(
  pg_temp.updated_rows(
    $$ update public.restaurant_billing set commission_bps = 0
       where restaurant_id = 'aaaa0000-0000-0000-0000-00000000000a' $$),
  0::bigint,
  'A ne peut pas renégocier sa commission tout seul'
);

select throws_ok(
  $$ insert into public.products (restaurant_id, name, slug, base_price)
     values ('bbbb0000-0000-0000-0000-00000000000b', 'Intrus', 'intrus', 100) $$,
  '42501',
  null,
  'A ne peut pas glisser un produit dans la carte de B'
);

-- Fonctions métier ----------------------------------------------------------
select throws_ok(
  $$ select public.fn_dashboard_stats('bbbb0000-0000-0000-0000-00000000000b') $$,
  '42501',
  null,
  'le chiffre d''affaires de B est refusé à A'
);

select throws_ok(
  $$ select public.fn_sales_series('bbbb0000-0000-0000-0000-00000000000b') $$,
  '42501',
  null,
  'la série de ventes de B est refusée à A'
);

select throws_ok(
  $$ select public.fn_top_products('bbbb0000-0000-0000-0000-00000000000b') $$,
  '42501',
  null,
  'le palmarès produits de B est refusé à A'
);

select throws_ok(
  $$ select public.fn_advance_order_status(
       'bbbb3333-0000-0000-0000-000000000003', 'CANCELLED') $$,
  '42501',
  null,
  'A ne peut pas faire avancer une commande de B'
);

-- Équipe --------------------------------------------------------------------
select is(
  (select count(*) from public.restaurant_members
   where restaurant_id = 'bbbb0000-0000-0000-0000-00000000000b'),
  0::bigint,
  'A ne voit pas l''équipe de B'
);

select throws_ok(
  $$ select public.fn_add_restaurant_member(
       'bbbb0000-0000-0000-0000-00000000000b', 'owner-a@test.cd', 'OWNER') $$,
  '42501',
  null,
  'A ne peut pas s''ajouter à l''équipe de B'
);

reset role;

-- ===========================================================================
-- Membre « Équipe » de A : exploitation refusée, lecture autorisée
-- ===========================================================================
select pg_temp.impersonate('50000000-0000-0000-0000-000000000005');

select is(
  public.fn_can_view_restaurant('aaaa0000-0000-0000-0000-00000000000a'),
  true,
  'un membre STAFF consulte son établissement'
);

select is(
  public.fn_can_admin_restaurant('aaaa0000-0000-0000-0000-00000000000a'),
  false,
  'un membre STAFF n''administre pas l''équipe'
);

select is(
  public.fn_can_manage_restaurant('aaaa0000-0000-0000-0000-00000000000a'),
  false,
  'un membre STAFF ne touche pas aux prix ni aux promotions'
);

-- …mais il tient le comptoir : c'est tout l'intérêt du niveau « service ».
select is(
  public.fn_can_serve_restaurant('aaaa0000-0000-0000-0000-00000000000a'),
  true,
  'un membre STAFF fait tourner le service de son établissement'
);

select is(
  public.fn_can_serve_restaurant('bbbb0000-0000-0000-0000-00000000000b'),
  false,
  'un membre STAFF de A ne sert pas chez B'
);

reset role;

select * from finish();
rollback;
