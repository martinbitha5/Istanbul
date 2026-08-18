-- ---------------------------------------------------------------------------
-- Istanbul Fast Food — 02. Tables de base
-- Convention : tous les montants sont en CENTIMES (integer). Jamais de float.
-- ---------------------------------------------------------------------------

-- Fonction utilitaire partagée : maintien de updated_at
create or replace function public.fn_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- restaurants
-- ---------------------------------------------------------------------------
create table public.restaurants (
  id                    uuid primary key default gen_random_uuid(),
  name                  text        not null,
  slug                  text        not null unique,
  tagline               text,
  description           text,
  logo_url              text,
  cover_url             text,
  phone                 text        not null,
  email                 text,
  address_line          text        not null,
  city                  text        not null default 'Kinshasa',
  country_code          char(2)     not null default 'CD',
  latitude              double precision not null,
  longitude             double precision not null,
  currency              char(3)     not null default 'USD',
  -- Paramètres d'exploitation
  is_open               boolean     not null default true,
  is_accepting_orders   boolean     not null default true,
  min_order_amount      integer     not null default 0    check (min_order_amount >= 0),
  avg_prep_minutes      integer     not null default 25   check (avg_prep_minutes between 1 and 240),
  service_fee_bps       integer     not null default 0    check (service_fee_bps between 0 and 5000),
  pickup_enabled        boolean     not null default true,
  delivery_enabled      boolean     not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on column public.restaurants.service_fee_bps is
  'Frais de service en points de base (100 bps = 1%). 0 = désactivé.';

create trigger trg_restaurants_updated_at
  before update on public.restaurants
  for each row execute function public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- opening_hours — 0 = dimanche … 6 = samedi
-- ---------------------------------------------------------------------------
create table public.opening_hours (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid    not null references public.restaurants(id) on delete cascade,
  day_of_week    smallint not null check (day_of_week between 0 and 6),
  opens_at       time    not null,
  closes_at      time    not null,
  is_closed      boolean not null default false,
  unique (restaurant_id, day_of_week)
);

-- ---------------------------------------------------------------------------
-- profiles — miroir applicatif de auth.users
-- ---------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  role            public.user_role not null default 'CUSTOMER',
  restaurant_id   uuid references public.restaurants(id) on delete set null,
  full_name       text        not null default '',
  phone           text,
  email           text,
  avatar_url      text,
  locale          text        not null default 'fr',
  push_tokens     text[]      not null default '{}',
  notif_orders    boolean     not null default true,
  notif_promos    boolean     not null default true,
  is_active       boolean     not null default true,
  last_seen_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint profiles_staff_needs_restaurant
    check (role not in ('RESTAURANT_STAFF') or restaurant_id is not null)
);

create index idx_profiles_role        on public.profiles (role);
create index idx_profiles_restaurant  on public.profiles (restaurant_id) where restaurant_id is not null;
create index idx_profiles_phone       on public.profiles (phone)         where phone is not null;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.fn_set_updated_at();

-- Création automatique du profil à l'inscription
create or replace function public.fn_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    coalesce(new.phone, new.raw_user_meta_data ->> 'phone'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function public.fn_handle_new_user();

-- ---------------------------------------------------------------------------
-- addresses — carnet d'adresses du client
-- ---------------------------------------------------------------------------
create table public.addresses (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid    not null references public.profiles(id) on delete cascade,
  label            text    not null default 'Domicile',
  recipient_name   text,
  phone            text,
  commune          text,                        -- ex. « Delvaux », « Gombe »
  street           text    not null,
  details          text,                        -- « Réf. en face de la pharmacie »
  delivery_notes   text,                        -- instructions pour le livreur
  latitude         double precision,
  longitude        double precision,
  is_default       boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_addresses_profile on public.addresses (profile_id);
-- Une seule adresse par défaut par client
create unique index uq_addresses_one_default
  on public.addresses (profile_id) where is_default;

create trigger trg_addresses_updated_at
  before update on public.addresses
  for each row execute function public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- delivery_zones — tarification par tranche de distance, éditable au dashboard
-- ---------------------------------------------------------------------------
create table public.delivery_zones (
  id               uuid primary key default gen_random_uuid(),
  restaurant_id    uuid    not null references public.restaurants(id) on delete cascade,
  name             text    not null,                     -- « 0–3 km »
  min_distance_km  numeric(5,2) not null default 0       check (min_distance_km >= 0),
  max_distance_km  numeric(5,2) not null                 check (max_distance_km > 0),
  fee_amount       integer not null                      check (fee_amount >= 0),  -- centimes
  eta_minutes      integer not null default 30           check (eta_minutes > 0),
  free_above       integer,                              -- livraison offerte au-delà de ce montant
  is_active        boolean not null default true,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint delivery_zones_range check (max_distance_km > min_distance_km)
);

create index idx_delivery_zones_restaurant
  on public.delivery_zones (restaurant_id, min_distance_km);

create trigger trg_delivery_zones_updated_at
  before update on public.delivery_zones
  for each row execute function public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- drivers — extension du profil pour le rôle DRIVER
-- ---------------------------------------------------------------------------
create table public.drivers (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid    not null unique references public.profiles(id) on delete cascade,
  restaurant_id       uuid    not null references public.restaurants(id) on delete cascade,
  vehicle             public.vehicle_type not null default 'MOTORCYCLE',
  plate_number        text,
  national_id         text,
  availability        public.driver_availability not null default 'OFFLINE',
  is_approved         boolean not null default false,
  -- Dernière position connue (dénormalisée pour l'affichage dashboard)
  last_latitude       double precision,
  last_longitude      double precision,
  last_location_at    timestamptz,
  -- Compteurs entretenus par trigger
  total_deliveries    integer not null default 0,
  total_earnings      integer not null default 0,          -- centimes
  rating_sum          integer not null default 0,
  rating_count        integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_drivers_restaurant  on public.drivers (restaurant_id, availability);
create index idx_drivers_profile     on public.drivers (profile_id);

create trigger trg_drivers_updated_at
  before update on public.drivers
  for each row execute function public.fn_set_updated_at();
