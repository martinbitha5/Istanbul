-- ---------------------------------------------------------------------------
-- Tests pgTAP — policies RLS.
--
-- Lancer :  pnpm test:db   (alias de `supabase test db`, stack locale requise)
--
-- Chaque bloc impersonne un rôle avec `set local role` + claims JWT, exécute
-- une lecture/écriture, puis revient à postgres (`reset role`) pour poser la
-- fixture suivante. Tout est annulé par le rollback final.
-- ---------------------------------------------------------------------------

begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

-- ===========================================================================
-- Fixtures (en tant que postgres, gardes contournées)
-- ===========================================================================
select set_config('app.bypass_guards', 'on', false);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'client1@test.cd'),
  ('22222222-2222-2222-2222-222222222222', 'client2@test.cd'),
  ('33333333-3333-3333-3333-333333333333', 'staff@test.cd'),
  ('44444444-4444-4444-4444-444444444444', 'driver@test.cd');

insert into public.restaurants (id, name, slug, phone, address_line, latitude, longitude)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Resto Test', 'resto-test',
        '+243000000000', 'Avenue Test 1', -4.33, 15.31);

update public.profiles
set role = 'RESTAURANT_STAFF', restaurant_id = 'aaaaaaaa-0000-0000-0000-000000000001'
where id = '33333333-3333-3333-3333-333333333333';

-- Depuis la migration 21, c'est l'appartenance qui donne les droits, pas le
-- seul `profiles.restaurant_id` : sans cette ligne le staff ne voit plus rien.
insert into public.restaurant_members (restaurant_id, profile_id, role)
values ('aaaaaaaa-0000-0000-0000-000000000001',
        '33333333-3333-3333-3333-333333333333', 'OWNER');

update public.profiles set role = 'DRIVER'
where id = '44444444-4444-4444-4444-444444444444';

insert into public.drivers (id, profile_id, restaurant_id, is_approved)
values ('dddddddd-0000-0000-0000-000000000001',
        '44444444-4444-4444-4444-444444444444',
        'aaaaaaaa-0000-0000-0000-000000000001', true);

insert into public.products (id, restaurant_id, name, slug, base_price, is_active) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Shawarma actif', 'shawarma-actif', 5000, true),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Plat retiré', 'plat-retire', 4000, false);

insert into public.addresses (id, profile_id, street) values
  ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Rue du client 1'),
  ('cccccccc-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Rue du client 2');

-- Une commande PICKUP par client (pas d'adresse requise).
insert into public.orders (id, restaurant_id, customer_id, fulfillment, contact_name, contact_phone) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', 'PICKUP', 'Client 1', '+243811111111'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
   '22222222-2222-2222-2222-222222222222', 'PICKUP', 'Client 2', '+243822222222');

-- Une livraison assignée au livreur, sur la commande du client 1.
insert into public.deliveries (id, order_id, driver_id)
values ('ffffffff-0000-0000-0000-000000000001',
        'eeeeeeee-0000-0000-0000-000000000001',
        'dddddddd-0000-0000-0000-000000000001');

select set_config('app.bypass_guards', '', false);

-- Impersonation : role + claims JWT comme le ferait PostgREST.
create or replace function pg_temp.impersonate(p_uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, false);
  execute 'set local role authenticated';
end;
$$;

-- ===========================================================================
-- Anonyme : la vitrine, rien d'autre
-- ===========================================================================
set local role anon;
select set_config('request.jwt.claims', '', false);

select is(
  (select count(*) from public.products),
  1::bigint,
  'anon ne voit que les produits actifs'
);

select is(
  (select count(*) from public.profiles),
  0::bigint,
  'anon ne voit aucun profil'
);

select is(
  (select count(*) from public.orders),
  0::bigint,
  'anon ne voit aucune commande'
);

select is(
  (select count(*) from public.addresses),
  0::bigint,
  'anon ne voit aucune adresse'
);

select throws_ok(
  $$ select id from public.deliveries $$,
  '42501',
  null,
  'anon n''a aucun privilège sur deliveries'
);

reset role;

-- ===========================================================================
-- Client 1 : ses données, et seulement les siennes
-- ===========================================================================
select pg_temp.impersonate('11111111-1111-1111-1111-111111111111');

select is(
  (select count(*) from public.profiles),
  2::bigint,
  'un client voit son profil et celui du livreur en course (contrepartie)'
);

select is(
  (select count(*) from public.orders),
  1::bigint,
  'un client ne voit que ses propres commandes'
);

select is(
  (select customer_id from public.orders limit 1),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'la commande visible est bien la sienne'
);

select is(
  (select count(*) from public.addresses),
  1::bigint,
  'un client ne voit que ses propres adresses'
);

-- La ligne de livraison est visible (colonnes autorisées)…
select is(
  (select count(*) from public.deliveries),
  1::bigint,
  'le client voit la livraison de sa commande'
);

-- …mais jamais le code lui-même.
select throws_ok(
  $$ select confirmation_code from public.deliveries $$,
  '42501',
  null,
  'le code de confirmation n''est pas lisible par un select direct'
);

select is(
  length(public.fn_order_confirmation_code('eeeeeeee-0000-0000-0000-000000000001')),
  4,
  'fn_order_confirmation_code sert le client de la commande'
);

select is(
  (select count(*) from public.app_config),
  0::bigint,
  'la configuration runtime est invisible pour un client'
);

reset role;

-- ===========================================================================
-- Client 2 : ne voit pas la livraison du client 1
-- ===========================================================================
select pg_temp.impersonate('22222222-2222-2222-2222-222222222222');

select is(
  (select count(*) from public.deliveries),
  0::bigint,
  'un client ne voit pas les livraisons des autres'
);

select is(
  public.fn_order_confirmation_code('eeeeeeee-0000-0000-0000-000000000001'),
  null::text,
  'fn_order_confirmation_code ne fuit pas vers un autre client'
);

reset role;

-- ===========================================================================
-- Staff : vue d'ensemble du restaurant
-- ===========================================================================
select pg_temp.impersonate('33333333-3333-3333-3333-333333333333');

select is(
  (select count(*) from public.orders),
  2::bigint,
  'le staff voit toutes les commandes du restaurant'
);

select is(
  (select count(*) from public.products),
  2::bigint,
  'le staff voit aussi les produits désactivés'
);

reset role;

-- ===========================================================================
-- Livreur : sa course, pas celles des autres
-- ===========================================================================
select pg_temp.impersonate('44444444-4444-4444-4444-444444444444');

select is(
  (select count(*) from public.deliveries),
  1::bigint,
  'le livreur voit la course qui lui est assignée'
);

select is(
  public.fn_order_confirmation_code('eeeeeeee-0000-0000-0000-000000000001'),
  null::text,
  'fn_order_confirmation_code ne fuit pas vers le livreur assigné'
);

reset role;

select * from finish();
rollback;
