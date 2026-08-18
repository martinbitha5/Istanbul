-- ---------------------------------------------------------------------------
-- Istanbul Fast Food — 09. Confidentialité du code de confirmation
--
-- PROBLÈME
-- La RLS filtre des LIGNES, jamais des COLONNES. Le livreur a légitimement
-- accès à la ligne `deliveries` de sa course : un simple `select *` lui
-- renverrait donc le code à 4 chiffres, et il pourrait clôturer une livraison
-- sans jamais l'avoir demandé au client. Le mécanisme entier perdrait son
-- sens.
--
-- SOLUTION
-- Retirer le privilège de lecture SUR LA COLONNE au rôle `authenticated`, et
-- n'exposer le code que par une fonction SECURITY DEFINER qui vérifie que
-- l'appelant est bien le client de la commande (ou le staff).
--
-- Conséquence : `select *` sur `deliveries` échoue désormais pour un
-- utilisateur connecté. Les requêtes de @istanbul/core énumèrent donc leurs
-- colonnes explicitement.
-- ---------------------------------------------------------------------------

revoke select (confirmation_code, confirmation_attempts)
  on public.deliveries
  from authenticated, anon;

-- ---------------------------------------------------------------------------
-- Lecture contrôlée : le client de la commande, ou le staff du restaurant.
-- ---------------------------------------------------------------------------
create or replace function public.fn_order_confirmation_code(p_order_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_code     text;
  v_customer uuid;
begin
  select o.customer_id, d.confirmation_code
  into v_customer, v_code
  from public.orders o
  join public.deliveries d on d.order_id = o.id
  where o.id = p_order_id;

  if not found then
    return null;
  end if;

  if v_customer = auth.uid() or public.fn_is_staff() then
    return v_code;
  end if;

  -- Un livreur qui appelle cette fonction obtient null, pas une erreur :
  -- inutile de lui indiquer qu'il y a quelque chose à forcer.
  return null;
end;
$$;

revoke all on function public.fn_order_confirmation_code from public, anon;
grant execute on function public.fn_order_confirmation_code to authenticated;

comment on function public.fn_order_confirmation_code is
  'Renvoie le code de confirmation d''une commande au client concerné ou au '
  'staff. Renvoie null pour tout autre appelant, y compris le livreur assigné.';
