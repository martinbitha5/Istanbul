-- ---------------------------------------------------------------------------
-- Istanbul Fast Food — 07b. Triggers de garde
--
-- Ces triggers protègent les colonnes sensibles que les policies RLS ne
-- peuvent pas figer sans provoquer de récursion (sous-requête sur la table
-- elle-même dans un WITH CHECK).
--
-- Ils s'exécutent APRÈS la policy et restaurent silencieusement la valeur
-- précédente au lieu de lever une erreur : un client mal codé qui renvoie
-- l'objet entier en PATCH ne doit pas échouer, il doit simplement ne rien
-- pouvoir changer d'interdit.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Contournement pour les fonctions métier
--
-- fn_place_order, fn_advance_*, fn_confirm_delivery s'exécutent en
-- SECURITY DEFINER mais auth.uid() reste celui de l'appelant : sans ce
-- drapeau, les gardes annuleraient leurs propres écritures de montants et de
-- statuts. Le drapeau est posé avec is_local = true : il meurt avec la
-- transaction et ne peut donc pas fuir d'une requête à l'autre.
-- ---------------------------------------------------------------------------
create or replace function public.fn_guards_bypassed()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('app.bypass_guards', true), '') = 'on';
$$;

revoke all on function public.fn_guards_bypassed from public, anon, authenticated;

-- ===========================================================================
-- profiles — personne ne se promeut soi-même
-- ===========================================================================
create or replace function public.fn_guard_profiles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Les admins et le service_role passent (auth.uid() est null hors session).
  if auth.uid() is null or public.fn_guards_bypassed() or public.fn_is_admin() then
    return new;
  end if;

  new.role          := old.role;
  new.restaurant_id := old.restaurant_id;
  new.is_active     := old.is_active;
  return new;
end;
$$;

create trigger trg_profiles_guard
  before update on public.profiles
  for each row execute function public.fn_guard_profiles();

-- ===========================================================================
-- drivers — le livreur ne s'approuve pas et ne s'auto-paie pas
-- ===========================================================================
create or replace function public.fn_guard_drivers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.fn_guards_bypassed() or public.fn_is_staff() then
    return new;
  end if;

  new.is_approved      := old.is_approved;
  new.restaurant_id    := old.restaurant_id;
  new.profile_id       := old.profile_id;
  new.total_deliveries := old.total_deliveries;
  new.total_earnings   := old.total_earnings;
  new.rating_sum       := old.rating_sum;
  new.rating_count     := old.rating_count;
  return new;
end;
$$;

create trigger trg_drivers_guard
  before update on public.drivers
  for each row execute function public.fn_guard_drivers();

-- ===========================================================================
-- deliveries — le code de confirmation et la rémunération sont intouchables
-- côté livreur ; le statut ne bouge que par les fonctions dédiées.
-- ===========================================================================
create or replace function public.fn_guard_deliveries()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.fn_guards_bypassed() or public.fn_is_staff() then
    return new;
  end if;

  new.confirmation_code     := old.confirmation_code;
  new.confirmation_attempts := old.confirmation_attempts;
  new.payout_amount         := old.payout_amount;
  new.cash_to_collect       := old.cash_to_collect;
  new.order_id              := old.order_id;
  new.status                := old.status;
  new.delivered_at          := old.delivered_at;
  return new;
end;
$$;

create trigger trg_deliveries_guard
  before update on public.deliveries
  for each row execute function public.fn_guard_deliveries();

-- ===========================================================================
-- orders — un client ne modifie que le statut CANCELLED, jamais les montants
-- ===========================================================================
create or replace function public.fn_guard_orders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or public.fn_guards_bypassed()
     or public.fn_is_staff()
     or auth.uid() <> old.customer_id then
    return new;
  end if;

  -- Le client ne peut toucher qu'au statut (annulation) et à sa note.
  new.subtotal        := old.subtotal;
  new.delivery_fee    := old.delivery_fee;
  new.service_fee     := old.service_fee;
  new.discount_amount := old.discount_amount;
  new.total           := old.total;
  new.restaurant_id   := old.restaurant_id;
  new.customer_id     := old.customer_id;
  new.order_number    := old.order_number;
  new.promotion_id    := old.promotion_id;

  if new.status is distinct from old.status and new.status <> 'CANCELLED' then
    new.status := old.status;
  end if;

  return new;
end;
$$;

create trigger trg_orders_guard
  before update on public.orders
  for each row execute function public.fn_guard_orders();

-- ===========================================================================
-- order_items — une ligne n'est ajoutée que sur une commande encore NEW
-- ===========================================================================
create or replace function public.fn_guard_order_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.order_status;
begin
  if auth.uid() is null or public.fn_guards_bypassed() or public.fn_is_staff() then
    return new;
  end if;

  select status into v_status from public.orders where id = new.order_id;

  if v_status is distinct from 'NEW' then
    raise exception 'La commande n''est plus modifiable.' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger trg_order_items_guard
  before insert on public.order_items
  for each row execute function public.fn_guard_order_items();
