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

- [x] Edge Function `notify` (envoi Expo Push + purge des tokens morts)
- [ ] Triggers `pg_net` qui appellent `notify` sur les transitions de statut
- [ ] Enregistrement des tokens Expo au démarrage des apps mobiles
- [ ] Mode hors-ligne : cache React Query persistant, file d'attente d'actions
- [ ] Carte temps réel Mapbox (position livreur, ETA)
- [ ] Upload d'images produit vers Supabase Storage avec compression
- [ ] Tests : moteur de prix, machine à états, policies RLS (pgTAP)
- [ ] Sentry + journalisation structurée

## Lot 4 — Croissance

- [ ] Paiements mobile money (M-Pesa, Orange Money, Airtel Money)
- [ ] Notation de la commande et du livreur
- [ ] Programme de fidélité
- [ ] Assignation automatique du livreur le plus proche
- [ ] Multi-restaurants (le schéma est déjà prêt)
- [ ] Optimisation d'itinéraire (Mapbox Directions)

---

## Dette assumée à ce stade

| Sujet | Décision | À reprendre quand |
|-------|----------|-------------------|
| Distance à vol d'oiseau × 1.35 | suffisant pour tarifer 0–10 km à Kinshasa | > 200 commandes/jour |
| Assignation manuelle du livreur | le gérant connaît ses livreurs | > 5 livreurs simultanés |
| Pas de chat client ↔ livreur | le téléphone suffit et coûte moins cher | retours terrain |
| Images non redimensionnées côté serveur | Storage + `expo-image` gèrent le cache | > 100 produits |
