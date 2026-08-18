-- ---------------------------------------------------------------------------
-- Istanbul Fast Food — 05. Livraisons, positions, notifications
-- ---------------------------------------------------------------------------

create table public.deliveries (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid    not null unique references public.orders(id) on delete cascade,
  driver_id           uuid    references public.drivers(id) on delete set null,
  status              public.delivery_status not null default 'OFFERED',

  -- Code à 4 chiffres remis au client, exigé pour clôturer la course
  confirmation_code   char(4) not null default lpad((floor(random() * 10000))::int::text, 4, '0'),
  confirmation_attempts smallint not null default 0,

  -- Rémunération du livreur (centimes)
  payout_amount       integer not null default 0 check (payout_amount >= 0),
  cash_to_collect     integer not null default 0 check (cash_to_collect >= 0),

  distance_km         numeric(6,2),
  eta_minutes         integer,

  -- Horodatage de chaque étape
  offered_at              timestamptz not null default now(),
  accepted_at             timestamptz,
  rejected_at             timestamptz,
  heading_to_restaurant_at timestamptz,
  picked_up_at            timestamptz,
  heading_to_customer_at  timestamptz,
  arrived_at              timestamptz,
  delivered_at            timestamptz,
  cancelled_at            timestamptz,

  proof_photo_url     text,
  driver_note         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_deliveries_driver
  on public.deliveries (driver_id, status, created_at desc);
create index idx_deliveries_open
  on public.deliveries (status, created_at)
  where status in ('OFFERED', 'ACCEPTED', 'HEADING_TO_RESTAURANT',
                   'PICKED_UP', 'HEADING_TO_CUSTOMER', 'ARRIVED');

create trigger trg_deliveries_updated_at
  before update on public.deliveries
  for each row execute function public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- driver_locations — trace GPS pendant une course
--
-- Table à forte cardinalité : une ligne toutes les 15 s par course active.
-- Purgée à 7 jours (voir fn_purge_driver_locations + pg_cron).
-- ---------------------------------------------------------------------------
create table public.driver_locations (
  id            bigint generated always as identity primary key,
  driver_id     uuid    not null references public.drivers(id) on delete cascade,
  delivery_id   uuid    references public.deliveries(id) on delete cascade,
  latitude      double precision not null,
  longitude     double precision not null,
  heading       real,
  speed_kmh     real,
  accuracy_m    real,
  recorded_at   timestamptz not null default now()
);

create index idx_driver_locations_delivery
  on public.driver_locations (delivery_id, recorded_at desc);
create index idx_driver_locations_recorded
  on public.driver_locations (recorded_at);

-- ---------------------------------------------------------------------------
-- notifications — historique in-app ; l'envoi push est fait par l'Edge Function
-- ---------------------------------------------------------------------------
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid    not null references public.profiles(id) on delete cascade,
  topic        public.notification_topic not null,
  title        text    not null,
  body         text    not null,
  data         jsonb   not null default '{}'::jsonb,
  order_id     uuid    references public.orders(id) on delete cascade,
  read_at      timestamptz,
  sent_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index idx_notifications_profile
  on public.notifications (profile_id, created_at desc);
create index idx_notifications_unread
  on public.notifications (profile_id) where read_at is null;
