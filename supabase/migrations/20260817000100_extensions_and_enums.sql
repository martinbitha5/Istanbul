-- ---------------------------------------------------------------------------
-- Istanbul Fast Food — 01. Extensions et types énumérés
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto"  with schema extensions;
create extension if not exists "citext"    with schema extensions;
create extension if not exists "pg_trgm"   with schema extensions;

-- ---------------------------------------------------------------------------
-- Rôles applicatifs
-- ---------------------------------------------------------------------------
create type public.user_role as enum (
  'CUSTOMER',
  'DRIVER',
  'RESTAURANT_STAFF',
  'ADMIN',
  'SUPER_ADMIN'
);

-- ---------------------------------------------------------------------------
-- Commandes
-- ---------------------------------------------------------------------------
create type public.fulfillment_type as enum ('DELIVERY', 'PICKUP');

create type public.order_status as enum (
  'NEW',        -- reçue, en attente de validation du restaurant
  'ACCEPTED',   -- validée par le restaurant
  'PREPARING',  -- en cuisine
  'READY',      -- prête (au comptoir ou pour le livreur)
  'ASSIGNED',   -- un livreur a été assigné
  'PICKED_UP',  -- récupérée par le livreur
  'DELIVERED',  -- remise au client
  'CANCELLED'
);

-- ---------------------------------------------------------------------------
-- Livraison
-- ---------------------------------------------------------------------------
create type public.delivery_status as enum (
  'OFFERED',
  'ACCEPTED',
  'REJECTED',
  'HEADING_TO_RESTAURANT',
  'PICKED_UP',
  'HEADING_TO_CUSTOMER',
  'ARRIVED',
  'DELIVERED',
  'CANCELLED'
);

create type public.driver_availability as enum ('OFFLINE', 'AVAILABLE', 'BUSY');

create type public.vehicle_type as enum ('MOTORCYCLE', 'BICYCLE', 'CAR', 'ON_FOOT');

-- ---------------------------------------------------------------------------
-- Paiements — l'énum contient déjà les fournisseurs à venir afin qu'aucune
-- migration de schéma ne soit nécessaire pour brancher le mobile money.
-- ---------------------------------------------------------------------------
create type public.payment_provider as enum (
  'CASH',
  'MPESA',
  'ORANGE_MONEY',
  'AIRTEL_MONEY',
  'CARD'
);

create type public.payment_status as enum (
  'PENDING',
  'AUTHORIZED',
  'PAID',
  'FAILED',
  'REFUNDED'
);

-- ---------------------------------------------------------------------------
-- Catalogue et promotions
-- ---------------------------------------------------------------------------
create type public.option_selection_type as enum ('SINGLE', 'MULTIPLE');

create type public.promotion_type as enum (
  'PERCENTAGE',
  'FIXED_AMOUNT',
  'FREE_DELIVERY'
);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create type public.notification_topic as enum (
  'ORDER_PLACED',
  'ORDER_ACCEPTED',
  'ORDER_PREPARING',
  'ORDER_READY',
  'DRIVER_ASSIGNED',
  'DRIVER_ON_THE_WAY',
  'ORDER_DELIVERED',
  'ORDER_CANCELLED',
  'DELIVERY_OFFERED',
  'PROMOTION'
);
