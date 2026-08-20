# Feuille de route — ordre de construction

Le principe : **une chaîne fonctionnelle complète avant toute fonctionnalité secondaire**.
On ne construit pas 40 écrans à moitié, on construit le parcours
`CLIENT → COMMANDE → RESTAURANT → LIVREUR → LIVRAISON → CONFIRMATION` de bout en bout.

---

## Lot 0 — Socle ✅

- [x] Monorepo pnpm + Turborepo + TypeScript strict
- [x] Design tokens et thème clair/sombre
- [x] Schéma PostgreSQL complet + RLS + seed Kinshasa
- [x] Machine à états commande et livraison (SQL + TypeScript)
- [x] Moteur de prix partagé
- [x] Client Supabase, hooks React Query, gestion realtime
- [x] Bibliothèque de composants React Native

## Lot 1 — Chaîne de commande (cœur du produit)

- [x] Client : splash · onboarding · authentification
- [x] Client : accueil · menu · fiche produit avec options
- [x] Client : panier · checkout (livraison / retrait) · confirmation
- [x] Client : suivi de commande temps réel + code de confirmation
- [x] Admin : file des commandes temps réel + changement de statut + assignation
- [x] Livreur : courses disponibles · course en cours · machine à états · validation par code

**Critère de sortie du lot 1 :** une commande passée sur le téléphone client apparaît en
moins d'une seconde sur le dashboard, peut être acceptée, préparée, assignée à un livreur,
suivie sur la carte par le client, et clôturée par le code à 4 chiffres.

## Lot 2 — Exploitation quotidienne

- [x] Admin : CRUD menu, catégories, groupes d'options
- [x] Admin : KPIs et graphiques (ventes jour/semaine/mois, top produits)
- [x] Admin : gestion des livreurs et des clients
- [x] Admin : promotions et codes promo
- [x] Admin : zones de livraison et tarification
- [x] Client : historique · « Commander à nouveau » · favoris · adresses
- [x] Livreur : historique et revenus

## Lot 3 — Fiabilisation

- [x] Edge Function `notify` (envoi Expo Push + purge des tokens morts) — déployée, JWT vérifié
- [x] Triggers `pg_net` qui appellent `notify` sur les transitions de statut (migration 13 + `app_config`)
- [x] Enregistrement des tokens Expo au démarrage des apps mobiles (`usePushNotifications` + `fn_register_push_token`)
- [x] Mode hors-ligne : cache React Query persistant (AsyncStorage), reprise des mutations, bandeau hors-ligne
- [x] Carte temps réel (position livreur, ETA) — Leaflet/OSM en WebView : zéro clé API, compatible Expo Go
- [x] Upload d'images produit vers Supabase Storage avec compression WebP côté navigateur
- [x] Tests : moteur de prix + machines à états (33 tests vitest), policies RLS (pgTAP, 19 assertions)
- [x] Sentry + journalisation structurée (`log` + sink ; actifs seulement si DSN fourni)

**Bonus — mode démo (migration 15) :** un tick pg_cron (10 s) joue le restaurant
et un livreur fantôme : toute commande passée est acceptée, préparée, assignée,
le GPS avance sur la carte jusqu'à l'adresse, puis la commande est livrée
(~4 min de bout en bout). Couper : `update app_config set value='' where key='demo_mode';`

**Au passage :** les tests RLS ont révélé que `confirmation_code` était redevenu
lisible par tout utilisateur connecté (un `grant` de table entière avait annulé le
`revoke` par colonne de la migration 09). Corrigé par la migration 14 —
revoke table + re-grant colonne par colonne.

## Lot 4 — Croissance

- [ ] Paiements mobile money (M-Pesa, Orange Money, Airtel Money)
- [x] Notation de la commande et du livreur (écran post-livraison, moyenne livreur par trigger)
- [x] Programme de fidélité (1 pt/$ livré, 1 pt = 5 ¢ au checkout — taux dans app_config)
- [x] Assignation automatique du livreur le plus proche (trigger READY, toggle app_config.auto_assign)
- [x] Multi-restaurants côté client (sélecteur auto-visible dès 2 restaurants, panier vidé au changement)
- [x] **Multi-restaurants réel côté dashboard (migration 21)** — `restaurant_members`
      (OWNER/MANAGER/STAFF), toutes les policies re-scopées par établissement,
      garde-fous ajoutés aux fonctions SECURITY DEFINER, sélecteur
      d'établissement, pages Équipe / Établissement / Partenaires,
      commission et publication par partenaire. 21 assertions pgTAP dédiées.
- [x] Revenus de la plateforme par partenaire (`fn_platform_revenue`, migration 23) —
      commission due sur le sous-total des commandes livrées, par mois / trimestre / année.
- [x] Mise en route guidée du partenaire (bannière de progression sur le dashboard
      d'un établissement non publié, publication en un geste une fois les 4 étapes faites).
- [x] Optimisation d'itinéraire (OSRM : itinéraire sur les cartes client ET livreur, distance/ETA vivants)

---

**Au passage :** l'écriture des tests de cloisonnement a mis au jour trois trous
qui n'étaient pas du multi-restaurants mais de la sécurité tout court —
`fn_advance_order_status` sans aucun contrôle d'appelant (tout compte connecté
pouvait faire avancer toute commande), `fn_dashboard_stats` / `fn_sales_series` /
`fn_top_products` servant le chiffre d'affaires de n'importe quel restaurant, et
`profiles_read_staff` ouvrant l'annuaire complet de la plateforme au premier
membre du staff venu.

## Dette assumée à ce stade

| Sujet | Décision | À reprendre quand |
|-------|----------|-------------------|
| Distance à vol d'oiseau × 1.35 | suffisant pour tarifer 0–10 km à Kinshasa | > 200 commandes/jour |
| Assignation manuelle du livreur | le gérant connaît ses livreurs | > 5 livreurs simultanés |
| Pas de chat client ↔ livreur | le téléphone suffit et coûte moins cher | retours terrain |
| Images non redimensionnées côté serveur | Storage + `expo-image` gèrent le cache | > 100 produits |
| Commission calculée à la volée, jamais figée | une renégociation doit se répercuter sur l'historique tant qu'aucune facture n'est émise | émission de la première facture |
| Pas de reversement automatisé | la plateforme facture hors application | premier reversement mensuel |
| Ajout d'un membre par e-mail d'un compte existant | créer le compte exigerait `service_role` côté navigateur | invitations Supabase Auth via Edge Function |
