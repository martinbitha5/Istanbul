-- ---------------------------------------------------------------------------
-- Istanbul Fast Food — 23. Revenus de la plateforme
--
-- La migration 21 a introduit `restaurant_billing.commission_bps` : le taux
-- est stocké, mais rien ne l'applique. Cette migration ajoute la seule chose
-- qui manquait — l'agrégat qui répond à « combien me doit chaque partenaire
-- sur la période ? ».
--
-- Choix de conception : on **calcule** au lieu de **stocker**.
--
-- Écrire la commission sur chaque `orders` au moment de la commande aurait été
-- plus rapide à lire, mais aurait figé le taux d'une manière qu'on ne veut
-- pas : une renégociation rétroactive (« on te repasse à 8 % depuis janvier »)
-- imposerait alors une migration de données. Tant qu'on est sous quelques
-- dizaines de milliers de commandes par mois, l'agrégat à la volée coûte
-- moins cher qu'une colonne dénormalisée à réconcilier.
--
-- Assiette : le **sous-total**, hors frais de livraison et hors frais de
-- service. La livraison est reversée au livreur, pas au restaurant ; la
-- prélever reviendrait à facturer le partenaire sur une somme qu'il n'a
-- jamais encaissée. Seules les commandes DELIVERED comptent.
-- ---------------------------------------------------------------------------

create or replace function public.fn_platform_revenue(
  p_from timestamptz default date_trunc('month', now()),
  p_to   timestamptz default now()
)
returns table (
  restaurant_id    uuid,
  restaurant_name  text,
  is_published     boolean,
  orders_delivered bigint,
  gross_sales      bigint,   -- sous-total encaissé, en centimes
  delivery_fees    bigint,   -- reversé aux livreurs, hors assiette
  commission_bps   integer,
  commission_due   bigint,   -- ce que le partenaire doit à la plateforme
  net_to_partner   bigint    -- ce qui lui reste sur la période
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.fn_is_platform_admin() then
    raise exception 'Réservé à l''administration de la plateforme.' using errcode = '42501';
  end if;

  return query
  select
    r.id,
    r.name,
    r.is_published,
    count(o.id)::bigint,
    coalesce(sum(o.subtotal), 0)::bigint,
    coalesce(sum(o.delivery_fee), 0)::bigint,
    coalesce(b.commission_bps, 0),
    -- Arrondi au centime, une fois sur le total de la période et non commande
    -- par commande : arrondir 400 fois introduit un écart visible sur la
    -- facture, et c'est le total qui est facturé.
    round(coalesce(sum(o.subtotal), 0) * coalesce(b.commission_bps, 0) / 10000.0)::bigint,
    (coalesce(sum(o.subtotal), 0)
      - round(coalesce(sum(o.subtotal), 0) * coalesce(b.commission_bps, 0) / 10000.0))::bigint
  from public.restaurants r
  left join public.restaurant_billing b on b.restaurant_id = r.id
  left join public.orders o
    on o.restaurant_id = r.id
   and o.status = 'DELIVERED'
   and o.created_at >= p_from
   and o.created_at <= p_to
  group by r.id, r.name, r.is_published, b.commission_bps
  order by 5 desc, r.name;
end;
$$;

comment on function public.fn_platform_revenue is
  'Commission due par partenaire sur une période. Assiette = sous-total des '
  'commandes livrées, hors livraison et hors frais de service. Calculé à la '
  'volée : une renégociation de taux se répercute sur l''historique, ce qui '
  'est le comportement voulu tant que la facturation n''est pas émise.';

revoke all on function public.fn_platform_revenue from public, anon;
grant execute on function public.fn_platform_revenue to authenticated;
