-- ---------------------------------------------------------------------------
-- Istanbul Fast Food — 18. Croissance : notation, auto-assignation, fidélité
--
-- Trois briques serveur du lot 4 :
--   A. Notation — garde-fous sur `reviews` + agrégation de la note livreur.
--   B. Auto-assignation — au passage READY, la course part toute seule vers
--      le livreur disponible le plus proche (toggle app_config.auto_assign).
--   C. Fidélité — 1 point par dollar livré, 1 point = 5 ¢ au checkout
--      (taux modifiables dans app_config sans migration).
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- A. NOTATION
-- ===========================================================================

-- Un client ne note que SA commande, une fois LIVRÉE. La policy RLS vérifie
-- déjà profile_id = auth.uid() ; ce trigger vérifie le reste.
create or replace function public.fn_review_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = new.order_id;

  if not found or v_order.customer_id <> new.profile_id then
    raise exception 'Vous ne pouvez noter que vos propres commandes.'
      using errcode = '42501';
  end if;

  if v_order.status <> 'DELIVERED' then
    raise exception 'La commande doit être livrée avant d''être notée.'
      using errcode = 'check_violation';
  end if;

  if new.food_rating is null and new.driver_rating is null then
    raise exception 'Donnez au moins une note.' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reviews_guard on public.reviews;
create trigger trg_reviews_guard
  before insert on public.reviews
  for each row execute function public.fn_review_guard();

-- La note livreur alimente sa moyenne (rating_sum / rating_count).
create or replace function public.fn_review_apply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver uuid;
begin
  if new.driver_rating is not null then
    select d.driver_id into v_driver
    from public.deliveries d
    where d.order_id = new.order_id;

    if v_driver is not null then
      update public.drivers
      set rating_sum = rating_sum + new.driver_rating,
          rating_count = rating_count + 1
      where id = v_driver;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reviews_apply on public.reviews;
create trigger trg_reviews_apply
  after insert on public.reviews
  for each row execute function public.fn_review_apply();

-- ===========================================================================
-- B. AUTO-ASSIGNATION
-- ===========================================================================
insert into public.app_config (key, value) values ('auto_assign', 'on')
on conflict (key) do nothing;

create or replace function public.fn_auto_assign_nearest(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order   public.orders%rowtype;
  v_rest    public.restaurants%rowtype;
  v_driver  public.drivers%rowtype;
  v_payment public.payments%rowtype;
  v_cash    integer := 0;
begin
  if coalesce((select value from public.app_config where key = 'auto_assign'), '') <> 'on' then
    return;
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.fulfillment <> 'DELIVERY' or v_order.status <> 'READY' then
    return;
  end if;

  if exists (select 1 from public.deliveries where order_id = p_order_id) then
    return; -- déjà assignée (manuellement ou par un tick précédent)
  end if;

  select * into v_rest from public.restaurants where id = v_order.restaurant_id;

  -- Le plus proche du RESTAURANT (c'est là qu'il doit d'abord aller),
  -- position fraîche exigée : un GPS d'hier ne dit rien d'utile.
  select d.* into v_driver
  from public.drivers d
  where d.restaurant_id = v_order.restaurant_id
    and d.availability = 'AVAILABLE'
    and d.is_approved
    and d.last_latitude is not null
    and d.last_location_at > now() - interval '30 minutes'
  order by public.fn_distance_km(
    d.last_latitude, d.last_longitude, v_rest.latitude, v_rest.longitude
  )
  limit 1;

  if not found then
    return; -- personne de disponible : le gérant assignera à la main
  end if;

  perform set_config('app.bypass_guards', 'on', true);

  select * into v_payment from public.payments where order_id = p_order_id limit 1;
  if v_payment.provider = 'CASH' and v_payment.status <> 'PAID' then
    v_cash := v_order.total;
  end if;

  insert into public.deliveries (
    order_id, driver_id, status, payout_amount, cash_to_collect,
    distance_km, eta_minutes
  ) values (
    p_order_id, v_driver.id, 'OFFERED',
    coalesce(v_order.delivery_fee, 0), v_cash,
    v_order.distance_km, v_order.eta_minutes
  )
  on conflict (order_id) do nothing;

  perform public.fn_advance_order_status(p_order_id, 'ASSIGNED');
  update public.drivers set availability = 'BUSY' where id = v_driver.id;
exception when others then
  -- Une auto-assignation qui échoue ne doit jamais bloquer le passage READY :
  -- la commande reste READY et le dashboard prend le relais.
  raise warning 'fn_auto_assign_nearest: %', sqlerrm;
end;
$$;

create or replace function public.fn_trg_auto_assign()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.fn_auto_assign_nearest(new.id);
  return new;
end;
$$;

drop trigger if exists trg_orders_auto_assign on public.orders;
create trigger trg_orders_auto_assign
  after update of status on public.orders
  for each row
  when (new.status = 'READY')
  execute function public.fn_trg_auto_assign();

-- ===========================================================================
-- C. FIDÉLITÉ
-- ===========================================================================
alter table public.profiles
  add column if not exists loyalty_points integer not null default 0
  check (loyalty_points >= 0);

create table if not exists public.loyalty_transactions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  order_id    uuid references public.orders(id) on delete set null,
  points      integer not null,          -- positif = gagné, négatif = dépensé
  kind        text not null check (kind in ('EARN', 'REDEEM', 'ADJUST')),
  created_at  timestamptz not null default now()
);

-- Idempotence : une commande ne crédite/débite qu'une fois par type.
create unique index if not exists uq_loyalty_once
  on public.loyalty_transactions (order_id, kind) where order_id is not null;
create index if not exists idx_loyalty_profile
  on public.loyalty_transactions (profile_id, created_at desc);

alter table public.loyalty_transactions enable row level security;

create policy "loyalty_read_own" on public.loyalty_transactions
  for select using (profile_id = auth.uid() or public.fn_is_staff());
-- Aucune policy d'écriture : seules les fonctions SECURITY DEFINER écrivent.

revoke all on public.loyalty_transactions from anon;

insert into public.app_config (key, value) values
  ('loyalty_earn_per_dollar', '1'),
  ('loyalty_point_value_cents', '5')
on conflict (key) do nothing;

create or replace function public.fn_loyalty_point_value()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(1, coalesce(nullif((
    select value from public.app_config where key = 'loyalty_point_value_cents'
  ), '')::integer, 5));
$$;

create or replace function public.fn_loyalty_earn_rate()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0, coalesce(nullif((
    select value from public.app_config where key = 'loyalty_earn_per_dollar'
  ), '')::integer, 1));
$$;

-- Gain à la livraison ; remboursement des points si la commande est annulée.
create or replace function public.fn_loyalty_on_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points integer;
  v_tx     uuid;
  v_spent  integer;
begin
  if new.status = 'DELIVERED' and old.status is distinct from new.status then
    v_points := floor(new.total / 100.0)::integer * public.fn_loyalty_earn_rate();
    if v_points > 0 then
      insert into public.loyalty_transactions (profile_id, order_id, points, kind)
      values (new.customer_id, new.id, v_points, 'EARN')
      on conflict (order_id, kind) where order_id is not null do nothing
      returning id into v_tx;

      if v_tx is not null then
        update public.profiles
        set loyalty_points = loyalty_points + v_points
        where id = new.customer_id;

        perform public.fn_notify(
          new.customer_id, 'PROMOTION', new.id,
          'Points fidélité',
          format('+%s points sur votre commande %s. Total à dépenser au prochain passage !',
                 v_points, new.order_number),
          jsonb_build_object('points', v_points)
        );
      end if;
    end if;
  end if;

  -- Annulation : les points dépensés au checkout reviennent au client.
  if new.status = 'CANCELLED' and old.status is distinct from new.status then
    select -points into v_spent
    from public.loyalty_transactions
    where order_id = new.id and kind = 'REDEEM';

    if v_spent is not null and v_spent > 0 then
      insert into public.loyalty_transactions (profile_id, order_id, points, kind)
      values (new.customer_id, new.id, v_spent, 'ADJUST')
      on conflict (order_id, kind) where order_id is not null do nothing
      returning id into v_tx;

      if v_tx is not null then
        update public.profiles
        set loyalty_points = loyalty_points + v_spent
        where id = new.customer_id;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_orders_loyalty on public.orders;
create trigger trg_orders_loyalty
  after update of status on public.orders
  for each row execute function public.fn_loyalty_on_order_status();
