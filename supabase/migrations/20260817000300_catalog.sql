-- ---------------------------------------------------------------------------
-- Istanbul Fast Food — 03. Catalogue : catégories, produits, options, promos
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- categories — auto-référencée pour gérer les sous-catégories
-- ---------------------------------------------------------------------------
create table public.categories (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid    not null references public.restaurants(id) on delete cascade,
  parent_id      uuid    references public.categories(id) on delete cascade,
  name           text    not null,
  slug           text    not null,
  description    text,
  image_url      text,
  icon           text,                                  -- nom d'icône Phosphor
  sort_order     integer not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (restaurant_id, slug),
  constraint categories_no_self_parent check (parent_id is null or parent_id <> id)
);

create index idx_categories_restaurant on public.categories (restaurant_id, sort_order);
create index idx_categories_parent     on public.categories (parent_id) where parent_id is not null;

create trigger trg_categories_updated_at
  before update on public.categories
  for each row execute function public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table public.products (
  id                uuid primary key default gen_random_uuid(),
  restaurant_id     uuid    not null references public.restaurants(id) on delete cascade,
  category_id       uuid    references public.categories(id) on delete set null,
  name              text    not null,
  slug              text    not null,
  description       text,
  image_url         text,
  image_blurhash    text,                                -- placeholder expo-image
  base_price        integer not null check (base_price >= 0),   -- centimes
  compare_at_price  integer check (compare_at_price is null or compare_at_price > base_price),
  -- Merchandising
  is_active         boolean not null default true,
  is_available      boolean not null default true,       -- rupture temporaire
  is_popular        boolean not null default false,
  is_recommended    boolean not null default false,
  prep_minutes      integer not null default 10 check (prep_minutes >= 0),
  calories          integer,
  spicy_level       smallint not null default 0 check (spicy_level between 0 and 3),
  tags              text[]  not null default '{}',       -- 'halal', 'nouveau', 'végétarien'
  sort_order        integer not null default 0,
  -- Statistiques entretenues par trigger
  sold_count        integer not null default 0,
  rating_sum        integer not null default 0,
  rating_count      integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (restaurant_id, slug)
);

create index idx_products_restaurant on public.products (restaurant_id) where is_active;
create index idx_products_category   on public.products (category_id, sort_order) where is_active;
create index idx_products_popular    on public.products (restaurant_id, sold_count desc) where is_active and is_available;
-- Recherche plein texte tolérante aux fautes de frappe
create index idx_products_search
  on public.products using gin ((name || ' ' || coalesce(description, '')) extensions.gin_trgm_ops);

create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- product_option_groups — « Taille », « Sauce », « Suppléments », « Accompagnement »
-- ---------------------------------------------------------------------------
create table public.product_option_groups (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid    not null references public.products(id) on delete cascade,
  name            text    not null,
  description     text,
  selection_type  public.option_selection_type not null default 'SINGLE',
  is_required     boolean not null default false,
  min_select      smallint not null default 0 check (min_select >= 0),
  max_select      smallint not null default 1 check (max_select >= 1),
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint option_group_bounds check (max_select >= min_select),
  -- Un groupe SINGLE ne peut pas autoriser plusieurs choix
  constraint option_group_single_max check (selection_type <> 'SINGLE' or max_select = 1)
);

create index idx_option_groups_product on public.product_option_groups (product_id, sort_order);

create trigger trg_option_groups_updated_at
  before update on public.product_option_groups
  for each row execute function public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- product_options — un choix concret, avec son delta de prix
-- ---------------------------------------------------------------------------
create table public.product_options (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid    not null references public.product_option_groups(id) on delete cascade,
  name            text    not null,
  price_delta     integer not null default 0,            -- centimes, peut être négatif
  is_default      boolean not null default false,
  is_available    boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_product_options_group on public.product_options (group_id, sort_order);

create trigger trg_product_options_updated_at
  before update on public.product_options
  for each row execute function public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- favorites
-- ---------------------------------------------------------------------------
create table public.favorites (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (profile_id, product_id)
);

create index idx_favorites_profile on public.favorites (profile_id, created_at desc);

-- ---------------------------------------------------------------------------
-- promotions
-- ---------------------------------------------------------------------------
create table public.promotions (
  id                  uuid primary key default gen_random_uuid(),
  restaurant_id       uuid    not null references public.restaurants(id) on delete cascade,
  code                text,                              -- null = promo automatique (bannière)
  title               text    not null,
  description         text,
  image_url           text,
  type                public.promotion_type not null,
  -- PERCENTAGE : value en points de base (1500 = 15%). Sinon : centimes.
  value               integer not null check (value >= 0),
  max_discount_amount integer,                           -- plafond pour les pourcentages
  min_order_amount    integer not null default 0,
  -- Ciblage
  applies_to_all      boolean not null default true,
  first_order_only    boolean not null default false,
  -- Fenêtre et quotas
  starts_at           timestamptz not null default now(),
  ends_at             timestamptz,
  usage_limit         integer,                           -- null = illimité
  usage_limit_per_user integer not null default 1,
  usage_count         integer not null default 0,
  is_active           boolean not null default true,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint promotions_window check (ends_at is null or ends_at > starts_at),
  constraint promotions_percentage_bounds
    check (type <> 'PERCENTAGE' or value <= 10000)
);

create unique index uq_promotions_code
  on public.promotions (restaurant_id, upper(code)) where code is not null;
create index idx_promotions_active
  on public.promotions (restaurant_id, is_active, starts_at, ends_at);

create trigger trg_promotions_updated_at
  before update on public.promotions
  for each row execute function public.fn_set_updated_at();

-- Produits ciblés quand applies_to_all = false
create table public.promotion_products (
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  product_id   uuid not null references public.products(id)   on delete cascade,
  primary key (promotion_id, product_id)
);

-- Journal d'utilisation : sert à faire respecter usage_limit_per_user
create table public.promotion_redemptions (
  id            uuid primary key default gen_random_uuid(),
  promotion_id  uuid not null references public.promotions(id) on delete cascade,
  profile_id    uuid not null references public.profiles(id)   on delete cascade,
  order_id      uuid,                                    -- FK ajoutée après création de orders
  amount        integer not null default 0,
  created_at    timestamptz not null default now()
);

create index idx_promotion_redemptions_lookup
  on public.promotion_redemptions (promotion_id, profile_id);
