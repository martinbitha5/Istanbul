-- ---------------------------------------------------------------------------
-- Istanbul Fast Food — 11. Durcissement des fonctions
--
-- Répond à l'advisory Supabase 0011 (`function_search_path_mutable`).
-- Aucune des fonctions concernées n'est SECURITY DEFINER, le risque réel est
-- faible — mais un search_path figé coûte zéro et supprime toute ambiguïté de
-- résolution de nom.
-- ---------------------------------------------------------------------------

alter function public.fn_set_updated_at()
  set search_path = public;

alter function public.fn_distance_km(
  double precision, double precision, double precision, double precision
) set search_path = public;

alter function public.fn_road_distance_km(
  double precision, double precision, double precision, double precision
) set search_path = public;

alter function public.fn_order_can_transition(
  public.order_status, public.order_status, public.fulfillment_type
) set search_path = public;

alter function public.fn_delivery_can_transition(
  public.delivery_status, public.delivery_status
) set search_path = public;

-- ---------------------------------------------------------------------------
-- Droits d'exécution des helpers d'identité
--
-- ATTENTION — ces fonctions DOIVENT rester exécutables par `anon`.
--
-- Une policy est évaluée avec les privilèges de l'appelant. Or les policies
-- de lecture publique du catalogue les appellent :
--
--   products_read_all       : is_active or fn_is_staff()
--   categories_read_all     : is_active or fn_is_staff()
--   delivery_zones_read_all : is_active or fn_is_staff()
--   promotions_read_public  : fn_is_staff() or (...)
--
-- Les révoquer à `anon` fait échouer la lecture du menu avec
-- « permission denied for function fn_is_staff » — c'est-à-dire une vitrine
-- vide pour tout visiteur non connecté.
--
-- Le risque de les exposer est nul : elles ne renvoient que l'état de
-- l'appelant lui-même, et null pour un visiteur anonyme.
-- ---------------------------------------------------------------------------

revoke all on function public.fn_current_role()       from public;
revoke all on function public.fn_current_restaurant() from public;
revoke all on function public.fn_current_driver_id()  from public;
revoke all on function public.fn_is_staff()           from public;
revoke all on function public.fn_is_admin()           from public;

grant execute on function public.fn_current_role()       to anon, authenticated;
grant execute on function public.fn_current_restaurant() to anon, authenticated;
grant execute on function public.fn_current_driver_id()  to anon, authenticated;
grant execute on function public.fn_is_staff()           to anon, authenticated;
grant execute on function public.fn_is_admin()           to anon, authenticated;
