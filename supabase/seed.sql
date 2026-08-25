-- ---------------------------------------------------------------------------
-- Istanbul Fast Food — données de démonstration
--
-- Chargé automatiquement par `supabase db reset`.
-- NE PAS exécuter en production : contient des comptes à mot de passe connu.
--
-- Les images sont des PLACEHOLDERS déterministes. Remplacez-les par les vraies
-- photos une fois uploadées dans le bucket `product-images` :
--   https://<projet>.supabase.co/storage/v1/object/public/product-images/<fichier>
-- ---------------------------------------------------------------------------

begin;

-- ===========================================================================
-- Restaurant
-- ===========================================================================
insert into public.restaurants (
  id, name, slug, tagline, description, phone, email,
  address_line, city, latitude, longitude, currency,
  min_order_amount, avg_prep_minutes, service_fee_bps, logo_url, cover_url
) values (
  '00000000-0000-0000-0000-000000000001',
  'Istanbul Fast Food',
  'istanbul-fast-food',
  'Le vrai goût d''Istanbul, livré chez vous',
  'Shawarmas, burgers et grillades préparés à la commande. Halal. Livraison dans tout Kinshasa.',
  '+243 999 000 111',
  'contact@istanbulfastfood.cd',
  'Avenue Delvaux n°42, Ngaliema',
  'Kinshasa',
  -4.3735, 15.2662,
  'USD',
  500,    -- 5,00 $ minimum
  25,
  0,
  'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/restaurants/46c8a870-e1ab-472e-abee-891269e87da2.webp',
  'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/restaurant/hero-cover.webp'
);

-- Horaires : ouvert tous les jours 10h00 – 23h00
insert into public.opening_hours (restaurant_id, day_of_week, opens_at, closes_at)
select '00000000-0000-0000-0000-000000000001', d, '10:00', '23:00'
from generate_series(0, 6) d;

-- ===========================================================================
-- Zones de livraison — Kinshasa
-- ===========================================================================
insert into public.delivery_zones
  (restaurant_id, name, min_distance_km, max_distance_km, fee_amount, eta_minutes, free_above, sort_order)
values
  ('00000000-0000-0000-0000-000000000001', 'Proche — 0 à 3 km',   0,  3,  200, 15, 3000, 1),
  ('00000000-0000-0000-0000-000000000001', 'Moyen — 3 à 6 km',    3,  6,  300, 25, 5000, 2),
  ('00000000-0000-0000-0000-000000000001', 'Éloigné — 6 à 10 km', 6, 10,  500, 40, null, 3);

-- ===========================================================================
-- Catégories
-- ===========================================================================
insert into public.categories (id, restaurant_id, name, slug, icon, sort_order, image_url) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Shawarma',   'shawarma',   'Wrap',        1, 'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/categories/shawarma.webp'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Burgers',    'burgers',    'Hamburger',   2, 'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/categories/burgers.webp'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Sandwichs',  'sandwichs',  'Sandwich',    3, 'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/categories/sandwichs.webp'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Poulet',     'poulet',     'BowlFood',    4, 'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/categories/poulet.webp'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Pizzas',     'pizzas',     'Pizza',       5, 'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/categories/pizzas.webp'),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Frites',     'frites',     'FrenchFries', 6, 'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/categories/frites.webp'),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Snacks',     'snacks',     'Popcorn',     7, 'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/categories/snacks.webp'),
  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'Boissons',   'boissons',   'Martini',     8, 'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/categories/boissons.webp'),
  ('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'Desserts',   'desserts',   'IceCream',    9, 'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/categories/desserts.webp');

-- ===========================================================================
-- Produits
-- ===========================================================================
insert into public.products (
  id, restaurant_id, category_id, name, slug, description, image_url,
  base_price, compare_at_price, is_popular, is_recommended, prep_minutes,
  spicy_level, tags, sort_order
) values
  -- Shawarma -----------------------------------------------------------------
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   'Shawarma Poulet', 'shawarma-poulet',
   'Poulet mariné 24 h, grillé à la broche, servi dans un pain pita chaud avec crudités et sauce à l''ail.',
   'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/products/shawarma-poulet.webp', 450, null, true, true, 8, 1, '{halal,populaire}', 1),

  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   'Shawarma Bœuf', 'shawarma-boeuf',
   'Émincé de bœuf épicé, oignons rouges, persil, sauce tahini maison.',
   'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/products/shawarma-boeuf.webp', 550, null, true, false, 8, 2, '{halal}', 2),

  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   'Shawarma Mixte XL', 'shawarma-mixte-xl',
   'Poulet et bœuf, double portion de viande, pain XL. Le préféré des affamés.',
   'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/products/shawarma-mixte-xl.webp', 750, 850, true, true, 10, 2, '{halal,nouveau}', 3),

  -- Burgers ------------------------------------------------------------------
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002',
   'Istanbul Burger', 'istanbul-burger',
   'Notre signature : steak haché 150 g, cheddar fondu, oignons caramélisés, sauce Istanbul secrète.',
   'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/products/istanbul-burger.webp', 700, null, true, true, 12, 1, '{signature}', 1),

  ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002',
   'Double Cheese', 'double-cheese',
   'Deux steaks, double cheddar, cornichons, ketchup et moutarde.',
   'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/products/double-cheese.webp', 900, null, true, false, 14, 0, '{}', 2),

  ('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002',
   'Chicken Burger', 'chicken-burger',
   'Filet de poulet pané croustillant, salade iceberg, mayonnaise citronnée.',
   'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/products/chicken-burger.webp', 650, null, false, true, 12, 1, '{halal}', 3),

  -- Sandwichs ----------------------------------------------------------------
  ('20000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003',
   'Sandwich Kefta', 'sandwich-kefta',
   'Boulettes de viande hachée aux herbes, tomate grillée, sauce yaourt-menthe.',
   'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/products/sandwich-kefta.webp', 500, null, false, false, 10, 2, '{halal}', 1),

  ('20000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003',
   'Sandwich Falafel', 'sandwich-falafel',
   'Falafels croustillants, houmous, crudités. 100 % végétarien.',
   'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/products/sandwich-falafel.webp', 400, null, false, false, 8, 1, '{végétarien}', 2),

  -- Poulet -------------------------------------------------------------------
  ('20000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004',
   'Demi-poulet grillé', 'demi-poulet-grille',
   'Demi-poulet mariné aux épices turques, grillé au charbon, servi avec frites.',
   'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/products/demi-poulet-grille.webp', 1000, null, true, true, 20, 1, '{halal}', 1),

  ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004',
   'Ailes de poulet (8 pcs)', 'ailes-poulet-8',
   'Huit ailes marinées, sauce au choix : BBQ, piquante ou miel-moutarde.',
   'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/products/ailes-poulet-8.webp', 600, null, false, true, 15, 2, '{halal}', 2),

  -- Pizzas -------------------------------------------------------------------
  ('20000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005',
   'Pizza Margherita', 'pizza-margherita',
   'Sauce tomate San Marzano, mozzarella, basilic frais. Pâte levée 48 h.',
   'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/products/pizza-margherita.webp', 800, null, false, false, 18, 0, '{végétarien}', 1),

  ('20000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005',
   'Pizza Sucuk', 'pizza-sucuk',
   'Saucisse turque épicée, poivrons, oignons, mozzarella.',
   'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/products/pizza-sucuk.webp', 1100, 1250, true, true, 18, 2, '{halal,nouveau}', 2),

  -- Frites -------------------------------------------------------------------
  ('20000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000006',
   'Frites maison', 'frites-maison',
   'Pommes de terre fraîches coupées sur place, double cuisson.',
   'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/products/frites-maison.webp', 200, null, true, false, 6, 0, '{végétarien}', 1),

  ('20000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000006',
   'Frites Istanbul', 'frites-istanbul',
   'Frites nappées de cheddar fondu, émincé de viande et sauce à l''ail.',
   'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/products/frites-istanbul.webp', 450, null, true, true, 9, 1, '{}', 2),

  -- Snacks -------------------------------------------------------------------
  ('20000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007',
   'Bourek fromage (4 pcs)', 'bourek-fromage',
   'Feuilletés croustillants au fromage et persil.',
   'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/products/bourek-fromage.webp', 350, null, false, false, 8, 0, '{végétarien}', 1),

  ('20000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007',
   'Onion rings', 'onion-rings',
   'Rondelles d''oignon panées, sauce burger.',
   'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/products/onion-rings.webp', 300, null, false, false, 7, 0, '{végétarien}', 2),

  -- Boissons -----------------------------------------------------------------
  ('20000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000008',
   'Coca-Cola 50 cl', 'coca-cola-50',
   'Bouteille bien fraîche.',
   'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/products/coca-cola-50.webp', 150, null, true, false, 1, 0, '{}', 1),

  ('20000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000008',
   'Ayran', 'ayran',
   'Boisson au yaourt salée, la compagne traditionnelle du shawarma.',
   'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/products/ayran.webp', 200, null, false, true, 1, 0, '{halal}', 2),

  ('20000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000008',
   'Jus d''ananas frais', 'jus-ananas',
   'Pressé à la commande.',
   'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/products/jus-ananas.webp', 250, null, false, false, 4, 0, '{végétarien}', 3),

  -- Desserts -----------------------------------------------------------------
  ('20000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000009',
   'Baklava (3 pcs)', 'baklava',
   'Pâte filo, pistaches, sirop de miel. Fait maison.',
   'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/products/baklava.webp', 350, null, true, true, 2, 0, '{végétarien}', 1),

  ('20000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000009',
   'Künefe', 'kunefe',
   'Dessert chaud au fromage et cheveux d''ange, servi tiède.',
   'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/products/kunefe.webp', 450, null, false, false, 12, 0, '{végétarien}', 2);

-- ===========================================================================
-- Groupes d'options
-- ===========================================================================

-- Shawarma Poulet : taille (obligatoire), sauce (obligatoire), suppléments
insert into public.product_option_groups (id, product_id, name, selection_type, is_required, min_select, max_select, sort_order) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Taille',       'SINGLE',   true,  1, 1, 1),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Sauce',        'SINGLE',   true,  1, 1, 2),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Suppléments',  'MULTIPLE', false, 0, 5, 3),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'Accompagnement','SINGLE',  false, 0, 1, 4);

insert into public.product_options (group_id, name, price_delta, is_default, sort_order) values
  ('30000000-0000-0000-0000-000000000001', 'Normal',                  0, true,  1),
  ('30000000-0000-0000-0000-000000000001', 'Grand (+50 %  de viande)', 150, false, 2),
  ('30000000-0000-0000-0000-000000000001', 'XL (double viande)',      300, false, 3),

  ('30000000-0000-0000-0000-000000000002', 'Sauce à l''ail',   0, true,  1),
  ('30000000-0000-0000-0000-000000000002', 'Sauce piquante',   0, false, 2),
  ('30000000-0000-0000-0000-000000000002', 'Sauce algérienne', 0, false, 3),
  ('30000000-0000-0000-0000-000000000002', 'Sauce tahini',    50, false, 4),
  ('30000000-0000-0000-0000-000000000002', 'Sans sauce',       0, false, 5),

  ('30000000-0000-0000-0000-000000000003', 'Fromage',        100, false, 1),
  ('30000000-0000-0000-0000-000000000003', 'Œuf',             75, false, 2),
  ('30000000-0000-0000-0000-000000000003', 'Frites dedans',  100, false, 3),
  ('30000000-0000-0000-0000-000000000003', 'Double viande',  300, false, 4),
  ('30000000-0000-0000-0000-000000000003', 'Piments forts',    0, false, 5),

  ('30000000-0000-0000-0000-000000000004', 'Sans accompagnement',        0, true,  1),
  ('30000000-0000-0000-0000-000000000004', 'Frites',                   150, false, 2),
  ('30000000-0000-0000-0000-000000000004', 'Frites + boisson (menu)',  280, false, 3);

-- Istanbul Burger : cuisson, suppléments, menu
insert into public.product_option_groups (id, product_id, name, selection_type, is_required, min_select, max_select, sort_order) values
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000004', 'Cuisson',     'SINGLE',   true,  1, 1, 1),
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000004', 'Suppléments', 'MULTIPLE', false, 0, 6, 2),
  ('30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000004', 'Formule',     'SINGLE',   false, 0, 1, 3);

insert into public.product_options (group_id, name, price_delta, is_default, sort_order) values
  ('30000000-0000-0000-0000-000000000005', 'À point', 0, true,  1),
  ('30000000-0000-0000-0000-000000000005', 'Saignant', 0, false, 2),
  ('30000000-0000-0000-0000-000000000005', 'Bien cuit', 0, false, 3),

  ('30000000-0000-0000-0000-000000000006', 'Bacon de bœuf', 150, false, 1),
  ('30000000-0000-0000-0000-000000000006', 'Cheddar supplémentaire', 100, false, 2),
  ('30000000-0000-0000-0000-000000000006', 'Œuf au plat', 75, false, 3),
  ('30000000-0000-0000-0000-000000000006', 'Steak supplémentaire', 250, false, 4),
  ('30000000-0000-0000-0000-000000000006', 'Sans cornichons', 0, false, 5),
  ('30000000-0000-0000-0000-000000000006', 'Sans oignons', 0, false, 6),

  ('30000000-0000-0000-0000-000000000007', 'Burger seul', 0, true, 1),
  ('30000000-0000-0000-0000-000000000007', 'Menu : frites + boisson', 280, false, 2);

-- Demi-poulet : accompagnement + sauce
insert into public.product_option_groups (id, product_id, name, selection_type, is_required, min_select, max_select, sort_order) values
  ('30000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000009', 'Accompagnement', 'SINGLE',   true,  1, 1, 1),
  ('30000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000009', 'Sauces',         'MULTIPLE', false, 0, 3, 2);

insert into public.product_options (group_id, name, price_delta, is_default, sort_order) values
  ('30000000-0000-0000-0000-000000000008', 'Frites',        0, true,  1),
  ('30000000-0000-0000-0000-000000000008', 'Riz pilaf',     0, false, 2),
  ('30000000-0000-0000-0000-000000000008', 'Salade fraîche', 0, false, 3),
  ('30000000-0000-0000-0000-000000000008', 'Fufu',        100, false, 4),

  ('30000000-0000-0000-0000-000000000009', 'BBQ',            0, false, 1),
  ('30000000-0000-0000-0000-000000000009', 'Piquante',       0, false, 2),
  ('30000000-0000-0000-0000-000000000009', 'Miel-moutarde',  0, false, 3);

-- Ailes de poulet : sauce obligatoire
insert into public.product_option_groups (id, product_id, name, selection_type, is_required, min_select, max_select, sort_order) values
  ('30000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'Sauce', 'SINGLE', true, 1, 1, 1);

insert into public.product_options (group_id, name, price_delta, is_default, sort_order) values
  ('30000000-0000-0000-0000-00000000000a', 'BBQ',           0, true,  1),
  ('30000000-0000-0000-0000-00000000000a', 'Piquante',      0, false, 2),
  ('30000000-0000-0000-0000-00000000000a', 'Miel-moutarde', 0, false, 3);

-- Frites : taille
insert into public.product_option_groups (id, product_id, name, selection_type, is_required, min_select, max_select, sort_order) values
  ('30000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-00000000000d', 'Taille', 'SINGLE', true, 1, 1, 1);

insert into public.product_options (group_id, name, price_delta, is_default, sort_order) values
  ('30000000-0000-0000-0000-00000000000b', 'Petite',  0, true,  1),
  ('30000000-0000-0000-0000-00000000000b', 'Moyenne', 75, false, 2),
  ('30000000-0000-0000-0000-00000000000b', 'Grande', 150, false, 3);

-- ===========================================================================
-- Promotions
-- ===========================================================================
insert into public.promotions (
  restaurant_id, code, title, description, type, value,
  max_discount_amount, min_order_amount, first_order_only,
  usage_limit_per_user, image_url, sort_order, ends_at
) values
  ('00000000-0000-0000-0000-000000000001', 'BIENVENUE', 'Bienvenue chez Istanbul',
   '-20 % sur votre première commande', 'PERCENTAGE', 2000, 500, 500, true, 1,
   'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/promotions/bienvenue.webp', 1, null),

  ('00000000-0000-0000-0000-000000000001', 'LIVRAISON0', 'Livraison offerte',
   'Frais de livraison offerts dès 15 $ de commande', 'FREE_DELIVERY', 0, null, 1500, false, 3,
   'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/promotions/livraison.webp', 2, now() + interval '30 days'),

  ('00000000-0000-0000-0000-000000000001', 'ISTANBUL2', 'Duo Shawarma',
   '2 $ de réduction dès 12 $ d''achat', 'FIXED_AMOUNT', 200, null, 1200, false, 5,
   'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/promotions/duo.webp', 3, now() + interval '14 days');

-- Bannière automatique (sans code) affichée sur l'accueil
insert into public.promotions (
  restaurant_id, code, title, description, type, value, image_url, sort_order, ends_at
) values
  ('00000000-0000-0000-0000-000000000001', null, 'Le Mixte XL est arrivé',
   'Double viande, pain XL, sauce maison — 7,50 $', 'FIXED_AMOUNT', 0,
   'https://mvwmbjabiybbzfoejahc.supabase.co/storage/v1/object/public/product-images/seed/promotions/mixte.webp', 0, now() + interval '60 days');

-- ===========================================================================
-- Comptes de démonstration
--
-- Mot de passe commun : Istanbul2026!
-- Uniquement pour le développement local.
-- ===========================================================================
do $$
declare
  v_admin    uuid := 'a0000000-0000-0000-0000-000000000001';
  v_staff    uuid := 'a0000000-0000-0000-0000-000000000002';
  v_driver1  uuid := 'a0000000-0000-0000-0000-000000000003';
  v_driver2  uuid := 'a0000000-0000-0000-0000-000000000004';
  v_martin   uuid := 'a0000000-0000-0000-0000-000000000005';
  v_rec      record;
begin
  for v_rec in
    select * from (values
      (v_admin,   'admin@istanbulfastfood.cd',   'Yasmine Karim',  '+243999000101'),
      (v_staff,   'cuisine@istanbulfastfood.cd', 'Ibrahim Ndaya',  '+243999000102'),
      (v_driver1, 'moussa@istanbulfastfood.cd',  'Moussa Kabeya',  '+243999000103'),
      (v_driver2, 'patrick@istanbulfastfood.cd', 'Patrick Ilunga', '+243999000104'),
      (v_martin,  'martin@example.cd',           'Martin Bitha',   '+243999000105')
    ) as t(id, email, full_name, phone)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_rec.id, 'authenticated', 'authenticated', v_rec.email,
      extensions.crypt('Istanbul2026!', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_rec.full_name, 'phone', v_rec.phone),
      now(), now()
    )
    on conflict (id) do nothing;

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at,
      created_at, updated_at
    ) values (
      gen_random_uuid(), v_rec.id, v_rec.id::text,
      jsonb_build_object('sub', v_rec.id::text, 'email', v_rec.email, 'email_verified', true),
      'email', now(), now(), now()
    )
    on conflict do nothing;
  end loop;

  -- Le trigger fn_handle_new_user a créé les profils ; on affecte les rôles.
  update public.profiles
  set role = 'ADMIN', restaurant_id = '00000000-0000-0000-0000-000000000001'
  where id = v_admin;

  update public.profiles
  set role = 'RESTAURANT_STAFF', restaurant_id = '00000000-0000-0000-0000-000000000001'
  where id = v_staff;

  update public.profiles set role = 'DRIVER' where id in (v_driver1, v_driver2);

  insert into public.drivers (profile_id, restaurant_id, vehicle, plate_number, availability, is_approved)
  values
    (v_driver1, '00000000-0000-0000-0000-000000000001', 'MOTORCYCLE', 'KN 4821 AB', 'AVAILABLE', true),
    (v_driver2, '00000000-0000-0000-0000-000000000001', 'MOTORCYCLE', 'KN 7734 CD', 'OFFLINE',   true)
  on conflict (profile_id) do nothing;

  -- Carnet d'adresses de Martin
  insert into public.addresses (
    profile_id, label, commune, street, details, delivery_notes,
    latitude, longitude, is_default, recipient_name, phone
  ) values
    (v_martin, 'Domicile', 'Delvaux', 'Avenue Kasa-Vubu n°128',
     'Maison bleue, portail noir', 'Klaxonner à l''arrivée',
     -4.3810, 15.2701, true, 'Martin Bitha', '+243999000105'),
    (v_martin, 'Bureau', 'Gombe', 'Boulevard du 30 Juin, Immeuble Kilimandjaro',
     '4e étage, bureau 402', 'Demander Martin à l''accueil',
     -4.3197, 15.3009, false, 'Martin Bitha', '+243999000105')
  on conflict do nothing;
end;
$$;

commit;

-- ---------------------------------------------------------------------------
-- Comptes créés
--   admin@istanbulfastfood.cd    ADMIN             Istanbul2026!
--   cuisine@istanbulfastfood.cd  RESTAURANT_STAFF  Istanbul2026!
--   moussa@istanbulfastfood.cd   DRIVER            Istanbul2026!
--   patrick@istanbulfastfood.cd  DRIVER            Istanbul2026!
--   martin@example.cd            CUSTOMER          Istanbul2026!
-- ---------------------------------------------------------------------------
