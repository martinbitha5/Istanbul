# 🥙 Istanbul Fast Food

Plateforme de commande et de livraison de repas — **Kinshasa, RDC**.

Monorepo contenant **2 applications mobiles** (client + livreur), **1 dashboard web**
(restaurant / admin) et **1 backend Supabase** (PostgreSQL + Auth + Storage + Realtime).

---

## 📦 Structure

```
istanbul-fast-food/
├── apps/
│   ├── client/          # Expo — application CLIENT (commande, suivi, profil)
│   ├── driver/          # Expo — application LIVREUR (courses, statuts, revenus)
│   └── admin/           # Next.js — dashboard RESTAURANT / ADMIN
├── packages/
│   ├── tokens/          # Design tokens (couleurs, typo, espacements, motion)
│   ├── types/           # Types du domaine + machine à états des commandes
│   ├── core/            # Client Supabase, hooks React Query, moteur de prix
│   └── ui/              # Bibliothèque de composants React Native
├── supabase/
│   ├── migrations/      # Schéma SQL versionné (tables, RLS, fonctions, triggers)
│   ├── functions/       # Edge Functions (notifications push, assignation)
│   └── seed.sql         # Données de démonstration (menu Istanbul, zones Kinshasa)
└── docs/
    ├── ARCHITECTURE.md  # Architecture technique détaillée
    ├── DESIGN-SYSTEM.md # Identité visuelle et règles UI
    └── ROADMAP.md       # Ordre de construction des modules
```

---

## 🚀 Démarrage

### 1. Prérequis

| Outil | Version |
|-------|---------|
| Node.js | ≥ 20.19 |
| pnpm | ≥ 10 |
| Supabase CLI | ≥ 2.x |
| Docker Desktop | pour `supabase start` en local |
| Expo Go / Dev Client | sur un téléphone Android ou iOS |

### 2. Installation

```bash
pnpm install
```

### 3. Base de données

```bash
supabase start
supabase db reset
```

`db reset` applique toutes les migrations de `supabase/migrations/` puis charge `supabase/seed.sql`
(menu Istanbul complet, zones de livraison Kinshasa, comptes de démo).

Générer les types TypeScript à partir du schéma :

```bash
pnpm db:types
```

### 4. Variables d'environnement

```bash
cp .env.example .env
```

Renseigner l'URL et la clé `anon` affichées par `supabase start`, puis créer
`apps/client/.env`, `apps/driver/.env` et `apps/admin/.env.local` sur le même modèle.

### 5. Lancer

```bash
pnpm client   # Expo — application client
pnpm driver   # Expo — application livreur
pnpm admin    # Next.js — http://localhost:3000
```

---

## 🎯 Le parcours de bout en bout

```
CLIENT                RESTAURANT              LIVREUR
──────                ──────────              ───────
Panier
Checkout ──────────►  NEW
                      ACCEPTED  ──────────►
                      PREPARING
                      READY
                      ASSIGNED  ──────────►  Course proposée
                                             ACCEPTÉE
                                             EN ROUTE VERS LE RESTO
                      PICKED_UP ◄──────────  COMMANDE RÉCUPÉRÉE
Suivi temps réel                             EN ROUTE VERS LE CLIENT
                                             ARRIVÉ
Code : 4831 ─────────────────────────────►   Vérification du code
                      DELIVERED ◄─────────   LIVRÉE
```

Chaque transition est écrite dans `order_status_history`, diffusée par **Supabase Realtime**
et déclenche une **notification push** aux acteurs concernés.

---

## 🔐 Rôles

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

## 📚 Documentation

- [Architecture technique](docs/ARCHITECTURE.md)
- [Design system](docs/DESIGN-SYSTEM.md)
- [Feuille de route](docs/ROADMAP.md)
