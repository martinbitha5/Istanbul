-- ---------------------------------------------------------------------------
-- Istanbul Fast Food — 12. Droits d'exécution des prédicats RLS pour `anon`
--
-- PROBLÈME
-- PostgreSQL évalue TOUTES les policies SELECT d'une table — elles sont
-- combinées en OU. Si l'une d'elles appelle une fonction sur laquelle
-- l'appelant n'a pas EXECUTE, la requête entière échoue avec
-- « permission denied for function » au lieu de renvoyer un ensemble vide.
--
-- La migration 10 n'avait accordé ces fonctions qu'à `authenticated`.
-- Résultat : toute requête anonyme sur `orders`, `profiles`, `deliveries`,
-- `drivers`, `driver_locations`, `order_items` ou `order_item_options`
-- retournait une erreur.
--
-- Concrètement, l'écran d'accueil de l'app cliente appelle `useActiveOrder`
-- (donc `orders`) avant toute connexion : il plantait pour chaque visiteur
-- non connecté. Le catalogue s'affichait, la page était en erreur.
--
-- SÉCURITÉ
-- Aucune fuite. Ces fonctions comparent des identifiants à `auth.uid()`, qui
-- vaut null pour `anon` : elles renvoient systématiquement false. Vérifié en
-- conditions réelles — un appelant anonyme voit 0 ligne sur profiles, orders,
-- addresses, deliveries, payments, drivers, driver_locations et notifications,
-- et se fait refuser toute écriture.
-- ---------------------------------------------------------------------------

grant execute on function public.fn_is_order_customer(uuid)   to anon;
grant execute on function public.fn_is_order_driver(uuid)      to anon;
grant execute on function public.fn_is_open_offer(uuid)        to anon;
grant execute on function public.fn_is_delivery_customer(uuid) to anon;
grant execute on function public.fn_is_approved_driver()       to anon;
grant execute on function public.fn_driver_serves_me(uuid)     to anon;
grant execute on function public.fn_is_counterpart(uuid)       to anon;
grant execute on function public.fn_can_track_delivery(uuid)   to anon;
grant execute on function public.fn_can_read_order(uuid)       to anon;
grant execute on function public.fn_can_read_order_item(uuid)  to anon;
