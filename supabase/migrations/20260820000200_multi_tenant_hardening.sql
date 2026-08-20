-- ---------------------------------------------------------------------------
-- Istanbul Fast Food — 22. Finitions de la migration 21
--
-- Trois avertissements relevés par les advisors Supabase après application de
-- la migration 21. Aucun n'est exploitable en l'état, mais un rapport
-- d'advisors propre est ce qui permet de voir arriver le prochain qui, lui,
-- le sera.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Les fonctions de trigger ne sont pas des RPC.
--
-- Supabase expose TOUTE fonction exécutable par `anon`/`authenticated` sur
-- `/rest/v1/rpc/<nom>`. `fn_sync_member_profile` et `fn_guard_last_owner` sont
-- des triggers : appelées directement elles échouent (« trigger functions can
-- only be called as triggers »), donc rien ne fuit — mais une fonction
-- SECURITY DEFINER joignable depuis Internet n'a rien à faire dans la surface
-- d'attaque. Même traitement que `fn_guards_bypassed` en migration 07b.
-- ---------------------------------------------------------------------------
revoke all on function public.fn_sync_member_profile from public, anon, authenticated;
revoke all on function public.fn_guard_last_owner    from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. search_path figé sur `unaccent_fallback`.
--
-- La fonction n'appelle que `translate`, un builtin de pg_catalog, et n'est
-- pas SECURITY DEFINER : le risque de détournement est nul. On la ferme quand
-- même, parce que « nul aujourd'hui » n'est pas « nul après la prochaine
-- modification ».
-- ---------------------------------------------------------------------------
create or replace function public.unaccent_fallback(p_text text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select translate(
    p_text,
    'àáâãäåçèéêëìíîïñòóôõöùúûüýÿÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ',
    'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY'
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Les prédicats d'autorisation restent joignables par `anon` — c'est voulu.
--
-- Les advisors les signalent, et on assume : les policies de lecture publique
-- (`products_read_all`, `categories_read_all`, `delivery_zones_read_all`,
-- `promotions_read_public`) les évaluent pour un visiteur non connecté. Sans
-- le privilège EXECUTE, la vitrine de l'app client renverrait « permission
-- denied for function » avant même l'écran de connexion.
--
-- Ils ne renvoient qu'un booléen sur le périmètre de l'appelant lui-même :
-- interrogés par `anon`, où `auth.uid()` est null, ils répondent toujours
-- false. Il n'y a rien à en extraire.
-- ---------------------------------------------------------------------------
comment on function public.fn_can_view_restaurant is
  'Prédicat d''autorisation. Exécutable par anon À DESSEIN : les policies de '
  'lecture publique du catalogue l''évaluent avant connexion. Renvoie toujours '
  'false quand auth.uid() est null.';
