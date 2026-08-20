-- ---------------------------------------------------------------------------
-- Istanbul Fast Food — 14. Confidentialité du code : la vraie correction
--
-- RÉGRESSION ATTRAPÉE PAR LES TESTS RLS (supabase/tests/rls.test.sql) :
-- `select confirmation_code from deliveries` réussissait pour tout utilisateur
-- connecté — y compris le livreur assigné, qui pouvait clôturer une course
-- sans jamais demander le code au client.
--
-- CAUSE : en PostgreSQL, `revoke select (colonne)` ne retire que les
-- privilèges accordés COLONNE PAR COLONNE. Or Supabase accorde SELECT au
-- niveau de la TABLE entière (grants par défaut) : la migration 09 était donc
-- un no-op silencieux. Le seul motif sûr est :
--   1. revoke <privilège> sur la table entière ;
--   2. grant <privilège> (liste explicite de colonnes) en retour.
-- ---------------------------------------------------------------------------

-- Personne d'anonyme n'a affaire aux livraisons.
revoke all on public.deliveries from anon;

-- Lecture : tout sauf le code et le compteur de tentatives.
revoke select, insert, update on public.deliveries from authenticated;

grant select (
  id, order_id, driver_id, status,
  payout_amount, cash_to_collect, distance_km, eta_minutes,
  offered_at, accepted_at, rejected_at, heading_to_restaurant_at,
  picked_up_at, heading_to_customer_at, arrived_at, delivered_at, cancelled_at,
  proof_photo_url, driver_note, created_at, updated_at
) on public.deliveries to authenticated;

-- Écriture directe : uniquement ce que l'app fait vraiment par PostgREST —
-- `claimDelivery` (prise d'une course libre) et les notes/preuves du livreur.
-- Tout le reste (assignation, transitions, clôture) passe par les fonctions
-- SECURITY DEFINER, qui ne sont pas concernées par ces privilèges.
grant update (driver_id, proof_photo_url, driver_note)
  on public.deliveries to authenticated;
