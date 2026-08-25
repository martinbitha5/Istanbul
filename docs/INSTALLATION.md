# Installation, configuration et déploiement

Ce document rassemble tout ce qui est technique : prérequis, base de données,
variables d'environnement, lancement local et mise en ligne du dashboard.
Le [README](../README.md) présente le produit ; ce fichier s'adresse aux
développeurs.

---

## Structure du dépôt

```
istanbul-fast-food/
├── apps/
│   ├── client/          # Expo — application CLIENT (commande, suivi, profil)
│   ├── driver/          # Expo — application LIVREUR (courses, statuts, revenus)
│   └── admin/           # Next.js — vitrine publique (/) + dashboard (/admin)
├── packages/
│   ├── tokens/          # Design tokens (couleurs, typo, espacements, motion)
│   ├── types/           # Types du domaine + machine à états des commandes
│   ├── core/            # Client Supabase, hooks React Query, moteur de prix
│   ├── map/             # Page de carte partagée (Mapbox / Leaflet)
│   └── ui/              # Bibliothèque de composants React Native
├── supabase/
│   ├── migrations/      # Schéma SQL versionné (tables, RLS, fonctions, triggers)
│   ├── functions/       # Edge Functions (notifications push, assignation)
│   └── seed.sql         # Données de démonstration (menu Istanbul, zones Kinshasa)
└── docs/
    ├── ARCHITECTURE.md  # Architecture technique détaillée
    ├── DESIGN-SYSTEM.md # Identité visuelle et règles UI
    ├── INSTALLATION.md  # Ce document
    └── ROADMAP.md       # Ordre de construction des modules
```

---

## 1. Prérequis

| Outil | Version |
|-------|---------|
| Node.js | ≥ 20.19 |
| pnpm | ≥ 10 |
| Supabase CLI | ≥ 2.x |
| Docker Desktop | pour `supabase start` en local |
| Expo Go / Dev Client | sur un téléphone Android ou iOS |

## 2. Installation

```bash
pnpm install
```

## 3. Base de données

```bash
supabase start
supabase db reset
```

`db reset` applique toutes les migrations de `supabase/migrations/` puis charge
`supabase/seed.sql` (menu Istanbul complet, zones de livraison Kinshasa, comptes
de démo).

Générer les types TypeScript à partir du schéma :

```bash
pnpm db:types
```

## 4. Variables d'environnement

```bash
cp .env.example .env
```

Renseigner l'URL et la clé `anon` affichées par `supabase start`, puis créer
`apps/client/.env`, `apps/driver/.env` et `apps/admin/.env.local` sur le même
modèle.

**Cartes (facultatif).** Sans jeton, les trois applications affichent des cartes
OpenStreetMap : aucune clé, aucune facture, tout fonctionne. Pour passer au
rendu Mapbox — style navigation, itinéraire au trafic, puck orienté — créez un
jeton **public** (`pk.…`) sur [account.mapbox.com](https://account.mapbox.com/)
et renseignez-le dans les trois fichiers :

| Fichier | Variable |
|---------|----------|
| `apps/client/.env` | `EXPO_PUBLIC_MAPBOX_TOKEN` |
| `apps/driver/.env` | `EXPO_PUBLIC_MAPBOX_TOKEN` |
| `apps/admin/.env.local` (et `.env.production`) | `NEXT_PUBLIC_MAPBOX_TOKEN` |

Un `pk.` est public par conception : il part dans le bundle, c'est son usage
prévu. Si vous le restreignez par URL, autorisez le domaine du dashboard **et**
`https://istanbul.local` — l'origine des WebViews mobiles, sans quoi la carte
reste blanche sur téléphone.

## 5. Lancer

```bash
pnpm client   # Expo — application client
pnpm driver   # Expo — application livreur
pnpm admin    # Next.js — http://localhost:3000
```

---

## Déploiement du dashboard (Vercel)

Seul `apps/admin` est déployé. Le projet Vercel doit être configuré ainsi :

| Réglage | Valeur |
|---------|--------|
| Root Directory | `apps/admin` |
| Include files outside root directory | activé (le monorepo pnpm en dépend) |
| Framework | Next.js (détecté) |

Le reste vit dans `apps/admin/vercel.json`, notamment l'`installCommand`. Sans le
filtre `--filter @istanbul/admin...`, Vercel installerait tout le workspace —
dont les deux applications Expo et leurs dépendances natives, inutiles ici et
longues à télécharger. Le filtre ne retient que le dashboard et les packages
dont il dépend (`types`, `core`, `map`).

⚠️ `vercel.json` est validé contre un schéma strict : **aucune clé hors schéma**,
pas même un `"//"` de commentaire — le build échoue avant de compiler.

Les deux variables `NEXT_PUBLIC_*` sont versionnées dans
`apps/admin/.env.production` (elles sont publiques par conception, la sécurité
repose sur la RLS) : rien à renseigner côté Vercel.

---

## Rôles et permissions

Deux niveaux se superposent. `UserRole` dit ce qu'une personne est vis-à-vis de
l'application :

| Rôle | Accès |
|------|-------|
| `CUSTOMER` | Ses commandes, ses adresses, son profil |
| `DRIVER` | Les courses qui lui sont assignées + les courses disponibles |
| `RESTAURANT_STAFF` | Le dashboard, dans la limite de son rôle d'équipe |
| `ADMIN` / `SUPER_ADMIN` | Tout, sans passer par l'équipe |

`RestaurantRole` dit jusqu'où elle va dans le dashboard — parce que « accès au
dashboard » n'est pas une permission unique :

| Rôle d'équipe | Peut |
|---------------|------|
| `OWNER` | Tout, y compris l'équipe et les paramètres |
| `MANAGER` | Menu, prix, promotions, zones, livreurs, commandes |
| `STAFF` | Commandes du jour et ruptures de stock — ni les prix, ni l'équipe |

Les permissions sont appliquées par **Row Level Security** au niveau PostgreSQL —
aucune règle métier de sécurité ne vit uniquement côté client.

---

## Pour aller plus loin

- [Architecture technique](ARCHITECTURE.md)
- [Design system](DESIGN-SYSTEM.md)
- [Feuille de route](ROADMAP.md)
