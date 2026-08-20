# Architecture technique — Istanbul Fast Food

## 1. Vue d'ensemble

```
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  App CLIENT      │   │  App LIVREUR     │   │ Dashboard ADMIN  │
│  Expo + RN       │   │  Expo + RN       │   │ Next.js (App Rtr)│
└────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘
         │                      │                      │
         │        @istanbul/ui · @istanbul/core · @istanbul/types · @istanbul/tokens
         │                      │                      │
         └──────────────┬───────┴──────────────────────┘
                        │  supabase-js (Auth + PostgREST + Realtime + Storage)
              ┌─────────▼──────────────────────────────────┐
              │              SUPABASE                       │
              │  PostgreSQL  · RLS  · Fonctions PL/pgSQL    │
              │  Auth (email + téléphone OTP)               │
              │  Storage (photos produits, avatars)         │
              │  Realtime (commandes, positions livreurs)   │
              │  Edge Functions (push Expo, assignation)    │
              └────────────────────────────────────────────┘
```

## 2. Pourquoi ce découpage

| Package | Responsabilité | Dépend de |
|---------|----------------|-----------|
| `@istanbul/tokens` | Valeurs brutes du design (couleurs, échelles, motion). Zéro dépendance runtime. | — |
| `@istanbul/types` | Types du domaine, enums, **machine à états des commandes**, types générés Supabase. | — |
| `@istanbul/core` | Client Supabase, requêtes, hooks React Query, **moteur de prix**, formatage, realtime. | types |
| `@istanbul/ui` | Composants React Native + `ThemeProvider`. | tokens |

La règle : **la logique métier ne vit jamais dans un écran**. Un écran compose des hooks
de `core` et des composants de `ui`. Cela permet aux apps client et livreur de partager
authentification, realtime, formatage monétaire et gestion d'erreurs sans duplication.

Le **moteur de prix** (`packages/core/src/pricing`) est volontairement isolé et pur :
il est exécuté côté client pour l'affichage instantané du panier, **et** répliqué en SQL
(`fn_calculate_order_total`) pour que le serveur reste l'autorité sur le montant final.

## 3. Modèle de données

```
auth.users ──1:1── profiles ──┬──< addresses
                              ├──< orders ──┬──< order_items ──< order_item_options
                              │             ├──< order_status_history
                              │             ├──1:1─ deliveries ──< driver_locations
                              │             └──1:1─ payments
                              ├──< notifications
                              └──1:1─ drivers (si rôle DRIVER)

restaurants ──┬──< categories ──< products ──┬──< product_option_groups ──< product_options
              ├──< delivery_zones            └──< product_images
              ├──< promotions ──< promotion_products
              ├──< restaurant_members >──── profiles
              └──< opening_hours
```

### Décisions structurantes

1. **Les montants sont stockés en centimes (`integer`)**, jamais en `float`.
   Devise par défaut : USD (usage courant à Kinshasa), champ `currency` prévu pour le CDF.

2. **Les lignes de commande sont dénormalisées.** `order_items` copie `name`, `unit_price`
   et les options choisies au moment de la commande. Modifier le prix d'un produit ne
   réécrit jamais l'historique.

3. **`order_status_history` est la source de vérité de la chronologie.** Le champ
   `orders.status` n'est qu'un cache maintenu par trigger, pratique pour les index.

4. **Une commande = une livraison au plus.** `deliveries` porte le livreur, le code de
   confirmation, les horodatages de chaque étape et la distance parcourue.

5. **Les transitions de statut passent par des fonctions SQL** (`fn_advance_order_status`,
   `fn_advance_delivery_status`) qui valident la transition contre la machine à états.
   Une transition illégale lève une exception — impossible de passer `NEW → DELIVERED`.

## 4. Machine à états

### Commande (côté restaurant)

```
NEW ──► ACCEPTED ──► PREPARING ──► READY ──► ASSIGNED ──► PICKED_UP ──► DELIVERED
 │          │            │           │           │            │
 └──────────┴────────────┴───────────┴───────────┴────────────┴──► CANCELLED
```

`CANCELLED` est possible jusqu'à `PICKED_UP` inclus (au-delà, il faut un remboursement,
géré comme un flux séparé). Pour le retrait sur place, `ASSIGNED`/`PICKED_UP` sont sautés :
`READY ──► DELIVERED` (encaissement au comptoir).

### Livraison (côté livreur)

```
OFFERED ──► ACCEPTED ──► HEADING_TO_RESTAURANT ──► PICKED_UP
        └──► REJECTED               │
                                    ▼
                    HEADING_TO_CUSTOMER ──► ARRIVED ──► DELIVERED
```

`DELIVERED` exige le **code de confirmation à 4 chiffres** affiché au client dans son
écran de suivi. Le code est vérifié par la fonction SQL `fn_confirm_delivery`, jamais
par comparaison côté application.

**Le code n'est pas lisible par le livreur.** La RLS filtre des lignes, pas des colonnes :
le livreur a légitimement accès à la ligne `deliveries` de sa course, donc un `select *`
lui livrerait le code et viderait le mécanisme de son sens. On révoque donc le privilège
`SELECT` sur la colonne pour le rôle `authenticated` (migration 09) et on n'expose le code
que par `fn_order_confirmation_code(order_id)`, qui vérifie que l'appelant est le client
de la commande ou un membre du staff. Conséquence pratique : toutes les requêtes sur
`deliveries` énumèrent leurs colonnes explicitement — un `select *` échouerait.

## 5. Temps réel

| Canal | Émetteur | Abonnés |
|-------|----------|---------|
| `orders:restaurant_id=eq.X` | INSERT/UPDATE `orders` | Dashboard admin |
| `orders:id=eq.X` | UPDATE `orders` | Client (suivi) |
| `order_status_history:order_id=eq.X` | INSERT | Client (timeline) |
| `deliveries:driver_id=eq.X` | INSERT/UPDATE | App livreur |
| `driver_locations:delivery_id=eq.X` | INSERT | Client (carte) |

Les positions livreur sont écrites au maximum toutes les 15 s et purgées après 7 jours
par une tâche `pg_cron` — sinon la table devient le point chaud de la base.

## 6. Notifications push

Une seule Edge Function `notify` centralise l'envoi vers l'API Expo Push.
Elle est appelée par des triggers PostgreSQL via `pg_net` sur :

- `order_status_history` INSERT → notifie le client
- `orders` INSERT → notifie le restaurant
- `deliveries` INSERT/UPDATE(driver_id) → notifie le livreur

Les tokens Expo sont stockés dans `profiles.push_tokens` (tableau, un par appareil).
Les envois sont journalisés dans `notifications` pour l'historique in-app.

## 7. Sécurité

- **RLS activée sur toutes les tables**, sans exception.
- Le rôle est lu depuis `profiles.role` via la fonction `SECURITY DEFINER`
  `fn_current_role()`, mise en cache par requête (`STABLE`) pour éviter la récursion RLS.
- **Aucune policy n'interroge directement une autre table.** Une policy sur `orders` qui
  lirait `deliveries` déclencherait les policies de `deliveries`, dont l'une lit `orders` :
  PostgreSQL lève alors `infinite recursion detected in policy`. Tous les prédicats
  inter-tables passent donc par des fonctions `SECURITY DEFINER`
  (`fn_is_order_customer`, `fn_is_order_driver`, `fn_is_counterpart`…) qui, exécutées avec
  les droits du propriétaire, ne redéclenchent pas la RLS. Migration 10.
- Les colonnes sensibles que la RLS ne sait pas protéger (elle filtre des lignes, pas des
  colonnes) sont couvertes par une révocation de privilège au niveau colonne — voir le code
  de confirmation, section 4.
- La clé `service_role` n'existe que dans les Edge Functions et les scripts serveur.
- Les Storage buckets : `product-images` (lecture publique, écriture staff),
  `avatars` (lecture publique, écriture propriétaire),
  `delivery-proofs` (privé, lecture client + livreur concernés).

## 8. Paiements — prévu pour l'extension

`payments` est une table générique :

```
provider  : 'CASH' | 'MPESA' | 'ORANGE_MONEY' | 'AIRTEL_MONEY' | 'CARD'
status    : PENDING | AUTHORIZED | PAID | FAILED | REFUNDED
external_id, raw_payload jsonb
```

Au lancement, seul `CASH` (paiement à la livraison) est actif. Ajouter M-Pesa consiste à
créer une Edge Function `payments/mpesa` qui écrit dans cette table — aucune migration
de schéma, aucun changement dans l'application client hormis l'affichage du moyen.

## 9. Rôles dans l'équipe — cloisonnement

Istanbul Fast Food est le **seul** établissement de l'application. Les
migrations 21 à 23 avaient construit une place de marché (plusieurs partenaires,
commission négociée par partenaire, onboarding, agrégat de revenus) ; la
**migration 24** la retire. Ce qui reste de ce travail n'est pas un reliquat :
c'est la séparation des rôles au sein d'une même équipe.

`restaurant_id` reste sur toutes les tables. La colonne porte les jointures
existantes et ne coûte rien ; la retirer imposait de réécrire chaque policy,
chaque fonction SQL et chaque requête des trois applications pour un gain nul
côté utilisateur.

### `restaurant_members` — l'appartenance porte les droits

```
restaurant_members (restaurant_id, profile_id) → role : OWNER | MANAGER | STAFF
```

`profiles.restaurant_id` est conservé : c'est le rattachement principal, celui
que lit l'app livreur et que contrôle la contrainte
`profiles_staff_needs_restaurant`. Les deux modèles sont tenus synchronisés par
`trg_restaurant_members_sync` — supprimer l'un aurait cassé l'existant pour un
gain nul. **La source de vérité des droits, c'est la table d'appartenance.**

### Quatre prédicats, quatre niveaux

| Prédicat | Rôles | Couvre |
|----------|-------|--------|
| `fn_can_view_restaurant` | tout membre + ADMIN | tableau de bord, commandes, clients |
| `fn_can_serve_restaurant` | tout membre + ADMIN | statuts de commande, assignation livreur, rupture de stock |
| `fn_can_manage_restaurant` | OWNER, MANAGER + ADMIN | menu, prix, promotions, zones, agrément des livreurs |
| `fn_can_admin_restaurant` | OWNER + ADMIN | équipe, identité et paramètres de l'établissement |

« + ADMIN » désigne `fn_is_admin()` : un compte `ADMIN` / `SUPER_ADMIN` passe
partout sans ligne dans `restaurant_members`, c'est le compte du patron. La
migration 21 en avait créé un doublon exact sous le nom `fn_is_platform_admin` ;
la 24 le supprime.

`view` et `serve` couvrent aujourd'hui le même ensemble. Ils restent distincts
parce qu'ils répondent à des questions différentes : un futur rôle en lecture
seule (comptable) les séparera sans réécrire une policy.

Tous sont `SECURITY DEFINER` et `STABLE` — même motif qu'en section 7 : ils
lisent `restaurant_members` sans redéclencher la RLS de cette table.

### Ce que la RLS ne pouvait pas faire

La RLS filtre des lignes, jamais des colonnes. Deux cas s'en accommodent mal et
passent donc par une fonction dont la **signature est la restriction** :

- `fn_set_product_availability(product_id, is_available)` — la personne à la
  caisse (rôle STAFF) doit pouvoir signaler une rupture de stock sans avoir
  accès aux prix. Une policy ne sait pas exprimer « cette colonne oui, celle-là
  non ».
- `fn_order_confirmation_code(order_id)` — même principe, déjà en place depuis
  la migration 09 ; la migration 21 corrige seulement son périmètre
  (`fn_is_staff()` l'ouvrait à tout compte marqué staff).

### Les fonctions métier ont un garde-fou

`fn_advance_order_status` n'en avait **aucun** : n'importe quel compte connecté
pouvait faire avancer n'importe quelle commande. Elle vérifie désormais que
l'appelant est le restaurant qui prépare, le livreur qui porte, ou le client qui
annule avant la cuisine. `fn_assign_driver` exige en plus que le livreur
appartienne au restaurant de la commande. `fn_dashboard_stats`, `fn_sales_series`
et `fn_top_products` refusent un restaurant hors périmètre.

`auth.uid() is null` reste autorisé partout : c'est le contexte serveur
(pg_cron du mode démo, `service_role`, Edge Functions), déjà de confiance.

### Un seul établissement, verrouillé

`fn_guard_single_restaurant` (migration 24) refuse toute deuxième ligne dans
`restaurants`. Ce n'est pas de la coquetterie : les trois applications résolvent
l'établissement par « la seule ligne de la table », et une seconde ligne les
casserait en silence plutôt que bruyamment. Seul `app.bypass_guards` — le
drapeau *local à la transaction* de la migration 07b — passe outre, pour les
fixtures pgTAP qui montent leur propre restaurant de test.

`restaurants.is_published` reste : il masque l'établissement dans l'app client
tant que la carte n'est pas prête. C'est la bannière de mise en route du
dashboard qui s'appuie dessus.

Ce que la migration 24 retire : `restaurant_billing` (la commission n'a de sens
qu'entre une plateforme et un partenaire tiers — Istanbul ne se facture pas
lui-même), `fn_platform_revenue`, `fn_create_restaurant`, `fn_my_restaurants`,
`fn_my_restaurant_ids` et `unaccent_fallback`, qui n'existait que pour calculer
le slug d'un nouveau partenaire.

### Amorçage du dashboard

`fn_dashboard_bootstrap()` renvoie en un aller-retour tout ce que la coquille du
dashboard doit savoir : le profil de l'appelant, la fiche de l'établissement et
son rôle dans l'équipe. Le layout Next.js l'appelle côté serveur et passe le
résultat au `RestaurantProvider`, qui amorce le cache React Query — voir la
section 11.

Les tests `supabase/tests/roles.test.sql` (24 assertions) couvrent chaque brèche
listée ci-dessus, la séparation des trois rôles, et la disparition effective de
la couche plateforme.

## 10. Ce qui reste hors périmètre v1

- Calcul d'itinéraire optimisé côté serveur (l'app utilise OSRM, la tarification
  reste sur la distance à vol d'oiseau × 1.35)
- Chat client ↔ livreur (téléphone uniquement)
- Deuxième point de vente. Le schéma le supporterait (`restaurant_id` est
  partout, les prédicats sont paramétrés par restaurant), mais la base le refuse
  aujourd'hui et aucun écran n'expose de choix d'établissement. Rouvrir cette
  porte, ce serait retirer `fn_guard_single_restaurant`, rétablir un sélecteur
  dans le dashboard et repasser `RESTAURANT_ID` des apps mobiles en sélection
  utilisateur.

## 11. Le dashboard, et pourquoi il démarre vite

Le chemin critique du dashboard tenait en quatre allers-retours **en série** —
et le dernier n'était même pas lancé avant que le JavaScript ne soit chargé et
hydraté :

1. le middleware validait la session (`auth.getUser()`, appel réseau) ;
2. le layout la revalidait, puis lisait `profiles` ;
3. une fois hydraté, le navigateur appelait `fn_my_restaurants` — pendant ce
   temps l'écran affichait « Chargement de vos établissements… », plein cadre ;
4. la page, enfin montée, partait chercher ses propres données.

Sur un réseau mobile kinois à 300 ms de latence, cela fait plus d'une seconde
d'écran inutile avant le premier chiffre. Quatre changements l'ont supprimée :

| Changement | Effet |
|------------|-------|
| `fn_dashboard_bootstrap()` appelé dans le layout | 1 requête au lieu de 3, et plus rien à attendre après hydratation |
| `RestaurantProvider` amorce le cache React Query | `useRestaurant` / `useProfile` trouvent la donnée déjà là |
| `auth.getClaims()` dans le middleware | vérification locale du jeton en signature asymétrique, au lieu d'un aller-retour par navigation |
| `optimizePackageImports` sur `@phosphor-icons/react` | le baril de ~10 000 modules ne traverse plus le compilateur |

Le provider ne fait **aucune** requête : tout ce qu'il expose vient du serveur.
La checklist de mise en route, elle, est chargée en `dynamic()` et seulement si
`is_published` est faux — ses quatre requêtes ne partent plus à chaque ouverture
de la vue d'ensemble.
