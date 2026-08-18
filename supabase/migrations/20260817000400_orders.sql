-- ---------------------------------------------------------------------------
-- Istanbul Fast Food — 04. Commandes
--
-- Principe : order_items est DÉNORMALISÉ. On y recopie le nom et le prix au
-- moment de la commande. Changer le prix d'un produit ne réécrit jamais
-- l'historique de facturation.
-- ---------------------------------------------------------------------------

-- Numérotation lisible : IST-1024
create sequence public.order_number_seq start with 1024;

create table public.orders (
  id                    uuid primary key default gen_random_uuid(),
  order_number          text        not null unique
                          default 'IST-' || nextval('public.order_number_seq'),
  restaurant_id         uuid        not null references public.restaurants(id) on delete restrict,
  customer_id           uuid        not null references public.profiles(id)    on delete restrict,

  status                public.order_status     not null default 'NEW',
  fulfillment           public.fulfillment_type not null default 'DELIVERY',

  -- Instantané de l'adresse : l'adresse peut être modifiée ou supprimée ensuite
  address_id            uuid        references public.addresses(id) on delete set null,
  delivery_address      text,
  delivery_commune      text,
  delivery_details      text,
  delivery_notes        text,
  delivery_latitude     double precision,
  delivery_longitude    double precision,
  contact_phone         text        not null,
  contact_name          text        not null,

  -- Montants, tous en centimes
  currency              char(3)     not null default 'USD',
  subtotal              integer     not null default 0 check (subtotal >= 0),
  delivery_fee          integer     not null default 0 check (delivery_fee >= 0),
  service_fee           integer     not null default 0 check (service_fee >= 0),
  discount_amount       integer     not null default 0 check (discount_amount >= 0),
  total                 integer     not null default 0 check (total >= 0),

  promotion_id          uuid        references public.promotions(id) on delete set null,
  promotion_code        text,

  distance_km           numeric(6,2),
  delivery_zone_id      uuid        references public.delivery_zones(id) on delete set null,

  -- Chronologie
  eta_minutes           integer,
  scheduled_for         timestamptz,                     -- null = dès que possible
  accepted_at           timestamptz,
  ready_at              timestamptz,
  picked_up_at          timestamptz,
  delivered_at          timestamptz,
  cancelled_at          timestamptz,
  cancellation_reason   text,
  cancelled_by          uuid references public.profiles(id) on delete set null,

  customer_note         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- Une livraison exige une adresse ; un retrait n'en veut pas
  constraint orders_delivery_needs_address
    check (fulfillment <> 'DELIVERY' or delivery_address is not null),
  constraint orders_total_consistent
    check (total = subtotal + delivery_fee + service_fee - discount_amount)
);

create index idx_orders_restaurant_status
  on public.orders (restaurant_id, status, created_at desc);
create index idx_orders_customer
  on public.orders (customer_id, created_at desc);
create index idx_orders_active
  on public.orders (restaurant_id, created_at desc)
  where status not in ('DELIVERED', 'CANCELLED');
create index idx_orders_created_at on public.orders (created_at desc);

create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.fn_set_updated_at();

-- La FK différée de promotion_redemptions
alter table public.promotion_redemptions
  add constraint promotion_redemptions_order_fk
  foreign key (order_id) references public.orders(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- order_items
-- ---------------------------------------------------------------------------
create table public.order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid    not null references public.orders(id) on delete cascade,
  product_id      uuid    references public.products(id) on delete set null,
  -- Instantané au moment de la commande
  product_name    text    not null,
  product_image   text,
  unit_price      integer not null check (unit_price >= 0),   -- prix de base seul
  options_price   integer not null default 0,                 -- somme des deltas d'options
  quantity        smallint not null check (quantity between 1 and 99),
  line_total      integer not null check (line_total >= 0),   -- (unit_price + options_price) * quantity
  note            text,                                       -- « sans oignons »
  created_at      timestamptz not null default now()
);

create index idx_order_items_order on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- order_item_options — instantané des options choisies
-- ---------------------------------------------------------------------------
create table public.order_item_options (
  id             uuid primary key default gen_random_uuid(),
  order_item_id  uuid    not null references public.order_items(id) on delete cascade,
  option_id      uuid    references public.product_options(id) on delete set null,
  group_name     text    not null,                            -- « Taille »
  option_name    text    not null,                            -- « Grande »
  price_delta    integer not null default 0
);

create index idx_order_item_options_item on public.order_item_options (order_item_id);

-- ---------------------------------------------------------------------------
-- order_status_history — source de vérité de la chronologie
-- ---------------------------------------------------------------------------
create table public.order_status_history (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid    not null references public.orders(id) on delete cascade,
  from_status  public.order_status,
  to_status    public.order_status not null,
  changed_by   uuid    references public.profiles(id) on delete set null,
  actor_role   public.user_role,
  note         text,
  created_at   timestamptz not null default now()
);

create index idx_order_status_history_order
  on public.order_status_history (order_id, created_at);

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
create table public.payments (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid    not null references public.orders(id) on delete cascade,
  provider      public.payment_provider not null default 'CASH',
  status        public.payment_status   not null default 'PENDING',
  amount        integer not null check (amount >= 0),
  currency      char(3) not null default 'USD',
  -- Champs génériques pour brancher un PSP sans migration
  external_id   text,
  phone_number  text,                                    -- mobile money
  raw_payload   jsonb   not null default '{}'::jsonb,
  paid_at       timestamptz,
  failed_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_payments_order on public.payments (order_id);
create unique index uq_payments_external
  on public.payments (provider, external_id) where external_id is not null;

create trigger trg_payments_updated_at
  before update on public.payments
  for each row execute function public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- reviews — notation de la commande et du livreur
-- ---------------------------------------------------------------------------
create table public.reviews (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid    not null unique references public.orders(id) on delete cascade,
  profile_id    uuid    not null references public.profiles(id) on delete cascade,
  food_rating   smallint check (food_rating between 1 and 5),
  driver_rating smallint check (driver_rating between 1 and 5),
  comment       text,
  created_at    timestamptz not null default now()
);
