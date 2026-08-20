-- ---------------------------------------------------------------------------
-- Istanbul Fast Food — 13. Notifications push : triggers pg_net → Edge `notify`
--
-- Chaîne complète :
--   transition de statut (SQL) → fn_notify() → net.http_post → Edge Function
--   `notify` → Expo Push + insertion dans `notifications`.
--
-- Le trigger ne fait qu'émettre une requête HTTP asynchrone (pg_net) : la
-- transaction métier n'attend jamais Expo, et un échec d'envoi ne casse
-- jamais une commande.
-- ---------------------------------------------------------------------------

create extension if not exists pg_net;

-- ===========================================================================
-- app_config — la seule chose que le SQL ne peut pas deviner : l'URL du
-- projet. Renseignée une fois après déploiement :
--   update public.app_config set value = 'https://<ref>.supabase.co'
--    where key = 'edge_base_url';
-- Tant que la valeur est vide, fn_notify est un no-op silencieux (dev local).
-- ===========================================================================
create table if not exists public.app_config (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

-- Seuls les admins voient/éditent la config depuis le dashboard.
create policy "app_config_admin_read" on public.app_config
  for select using (public.fn_is_admin());
create policy "app_config_admin_write" on public.app_config
  for all using (public.fn_is_admin()) with check (public.fn_is_admin());

revoke all on public.app_config from anon;

insert into public.app_config (key, value) values
  ('edge_base_url', ''),
  ('edge_notify_key', '')
on conflict (key) do nothing;

comment on table public.app_config is
  'Configuration runtime. edge_base_url = https://<ref>.supabase.co ; '
  'edge_notify_key = clé anon (optionnelle, si notify est déployée avec JWT).';

-- ===========================================================================
-- fn_notify — émission d'une notification vers un profil.
-- Ne lève jamais : le push est un confort, la commande est un contrat.
-- ===========================================================================
create or replace function public.fn_notify(
  p_profile_id uuid,
  p_topic      public.notification_topic,
  p_order_id   uuid  default null,
  p_title      text  default null,
  p_body       text  default null,
  p_data       jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text;
  v_key  text;
  v_headers jsonb := jsonb_build_object('Content-Type', 'application/json');
begin
  select value into v_base from public.app_config where key = 'edge_base_url';
  if v_base is null or v_base = '' then
    return; -- environnement local ou pas encore configuré
  end if;

  select value into v_key from public.app_config where key = 'edge_notify_key';
  if v_key is not null and v_key <> '' then
    v_headers := v_headers || jsonb_build_object('Authorization', 'Bearer ' || v_key);
  end if;

  perform net.http_post(
    url     := rtrim(v_base, '/') || '/functions/v1/notify',
    headers := v_headers,
    body    := jsonb_build_object(
      'profile_id', p_profile_id,
      'topic',      p_topic,
      'order_id',   p_order_id,
      'title',      p_title,
      'body',       p_body,
      'data',       p_data
    ),
    timeout_milliseconds := 5000
  );
exception when others then
  -- pg_net indisponible ou mal configuré : on trace, on ne bloque pas.
  raise warning 'fn_notify: envoi impossible (%)', sqlerrm;
end;
$$;

revoke execute on function public.fn_notify from public, anon, authenticated;

-- ===========================================================================
-- Commandes : chaque transition notifie la bonne personne.
-- ===========================================================================
create or replace function public.fn_notify_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff uuid;
begin
  -- Nouvelle commande → tout le personnel actif du restaurant.
  if tg_op = 'INSERT' then
    for v_staff in
      select id from public.profiles
      where restaurant_id = new.restaurant_id
        and role in ('RESTAURANT_STAFF', 'ADMIN', 'SUPER_ADMIN')
        and is_active
    loop
      perform public.fn_notify(
        v_staff, 'ORDER_PLACED', new.id,
        'Nouvelle commande ' || new.order_number,
        null,
        jsonb_build_object('order_number', new.order_number)
      );
    end loop;
    return new;
  end if;

  if old.status is not distinct from new.status then
    return new;
  end if;

  -- Changements de statut → le client.
  perform public.fn_notify(
    new.customer_id,
    case new.status
      when 'ACCEPTED'  then 'ORDER_ACCEPTED'
      when 'PREPARING' then 'ORDER_PREPARING'
      when 'READY'     then 'ORDER_READY'
      when 'ASSIGNED'  then 'DRIVER_ASSIGNED'
      when 'PICKED_UP' then 'DRIVER_ON_THE_WAY'
      when 'DELIVERED' then 'ORDER_DELIVERED'
      when 'CANCELLED' then 'ORDER_CANCELLED'
    end::public.notification_topic,
    new.id,
    null,
    case
      when new.status = 'CANCELLED' and new.cancellation_reason is not null
        then 'Commande ' || new.order_number || ' annulée : ' || new.cancellation_reason
      when new.status = 'READY' and new.fulfillment = 'PICKUP'
        then 'Votre commande ' || new.order_number || ' vous attend au comptoir.'
      else null
    end,
    jsonb_build_object('order_number', new.order_number, 'status', new.status)
  );

  return new;
end;
$$;

drop trigger if exists trg_orders_notify on public.orders;
create trigger trg_orders_notify
  after insert or update of status on public.orders
  for each row execute function public.fn_notify_order_status();

-- ===========================================================================
-- Livraisons : offre → le livreur ; arrivée → le client.
-- ===========================================================================
create or replace function public.fn_notify_delivery_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_profile uuid;
  v_customer       uuid;
  v_order_number   text;
begin
  -- Une course proposée (création ou ré-assignation) → le livreur.
  if new.driver_id is not null
     and new.status = 'OFFERED'
     and (tg_op = 'INSERT'
          or old.status is distinct from new.status
          or old.driver_id is distinct from new.driver_id)
  then
    select profile_id into v_driver_profile
    from public.drivers where id = new.driver_id;

    select o.order_number into v_order_number
    from public.orders o where o.id = new.order_id;

    if v_driver_profile is not null then
      perform public.fn_notify(
        v_driver_profile, 'DELIVERY_OFFERED', new.order_id,
        'Nouvelle course',
        'Commande ' || coalesce(v_order_number, '') || ' — gain '
          || to_char(new.payout_amount / 100.0, 'FM999990.00') || ' $.',
        jsonb_build_object('delivery_id', new.id)
      );
    end if;
    return new;
  end if;

  -- Le livreur est arrivé → le client sort son code.
  if tg_op = 'UPDATE' and old.status is distinct from new.status
     and new.status = 'ARRIVED'
  then
    select o.customer_id, o.order_number into v_customer, v_order_number
    from public.orders o where o.id = new.order_id;

    perform public.fn_notify(
      v_customer, 'DRIVER_ON_THE_WAY', new.order_id,
      'Votre livreur est arrivé',
      'Il vous attend. Préparez votre code de confirmation.',
      jsonb_build_object('delivery_id', new.id, 'status', new.status)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_deliveries_notify on public.deliveries;
create trigger trg_deliveries_notify
  after insert or update of status, driver_id on public.deliveries
  for each row execute function public.fn_notify_delivery_status();

-- Les fonctions trigger n'ont rien à faire dans l'API REST.
revoke execute on function public.fn_notify_order_status    from public, anon, authenticated;
revoke execute on function public.fn_notify_delivery_status from public, anon, authenticated;

-- ===========================================================================
-- Enregistrement des tokens Expo — appelé par les apps mobiles au démarrage.
-- Un update direct de push_tokens par le client écraserait la liste entière
-- (course entre deux appareils) : l'append est donc fait côté serveur.
-- ===========================================================================
create or replace function public.fn_register_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentification requise.' using errcode = '42501';
  end if;

  if p_token is null or p_token !~ '^ExponentPushToken\[[A-Za-z0-9_-]+\]$' then
    raise exception 'Token Expo invalide.' using errcode = 'check_violation';
  end if;

  update public.profiles
  set push_tokens = (
        -- Dédoublonne et plafonne à 5 appareils (les plus récents en dernier).
        select coalesce(array_agg(t order by ord), '{}')
        from (
          select u.t, u.ord
          from unnest(array_append(array_remove(push_tokens, p_token), p_token))
               with ordinality as u(t, ord)
          order by u.ord desc
          limit 5
        ) latest
      ),
      last_seen_at = now()
  where id = auth.uid();
end;
$$;

create or replace function public.fn_unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set push_tokens = array_remove(push_tokens, p_token)
  where id = auth.uid();
$$;

revoke execute on function public.fn_register_push_token   from public, anon;
revoke execute on function public.fn_unregister_push_token from public, anon;
grant  execute on function public.fn_register_push_token   to authenticated;
grant  execute on function public.fn_unregister_push_token to authenticated;
