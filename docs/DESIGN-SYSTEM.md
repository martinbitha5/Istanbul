# Design System — Istanbul Fast Food

## 1. Intention

Une identité **chaleureuse, épicée et premium**, qui évoque le charbon du grill, le safran,
et le cuivre des bazars d'Istanbul — sans tomber dans le pastiche folklorique.

L'écran doit donner faim en une seconde. Cela impose trois règles non négociables :

1. **La photo prime.** Aucun produit sans image plein cadre. Ratio 4:3 en liste, 3:2 en détail.
2. **Un seul CTA par écran.** Braise pleine, jamais deux boutons de même poids.
3. **Le prix est toujours lisible sans effort** — chiffres tabulaires, contraste ≥ 4.5:1.

## 2. Couleurs

### Braise — primaire (actions, marque, prix)

| Ton | Hex | Usage |
|-----|-----|-------|
| 50 | `#FFF3EF` | fond de badge, surface teintée |
| 100 | `#FFE1D6` | fond de puce sélectionnée |
| 300 | `#FF9877` | illustrations, dégradés |
| 500 | `#E5431C` | illustrations, dégradés, marque éditoriale |
| **600** | **`#C4320F`** | **boutons primaires (blanc dessus = 5.5:1 — le 500 ne tenait que 4.08:1)** |
| 700 | `#9E260B` | état pressé, texte sur fond clair braise |

### Safran — accent (promotions, notes, badges)

| Ton | Hex | Usage |
|-----|-----|-------|
| 100 | `#FDECC4` | fond de bandeau promo |
| **400** | **`#EBB43A`** | **étoiles, badge « Populaire »** |
| 600 | `#B27714` | texte sur safran clair |

### Neutres chauds (« encre »)

`#FFFFFF` · `#FFFBF7` · `#FBF6F1` · `#F3ECE5` · `#E6DCD3` · `#CFC3B8` · `#A2958A` ·
`#7A6E64` · `#5B5149` · `#403933` · `#292420` · `#1A1613` · `#100D0B`

Les gris sont **désaturés vers le chaud**, jamais bleutés : un gris froid à côté d'une photo
de nourriture donne un rendu clinique.

### Sémantiques

| Rôle | Clair | Sombre |
|------|-------|--------|
| success | `#24713A` | `#8ED49E` |
| warning | `#B27714` | `#F4C95D` |
| danger | `#D32F2F` | `#EE9A9A` |
| info | `#14657E` | `#79C8DE` |

Chaque ton possède un fond doux `*Soft` **et** un premier plan dédié `on*Soft`
(`onSuccessSoft`, `onWarningSoft`, `onDangerSoft`, `onInfoSoft`) calibré pour tenir
4.5:1 sur ce fond. **Un texte sur fond doux utilise toujours `on*Soft`, jamais le ton
de base** — c'est la règle qui a corrigé tous les badges de statut.

### Mode sombre

Le mode sombre n'inverse pas les valeurs : il repose sur des surfaces **encre 950/900/800**
et remonte la braise à `#F76B45` (ember 400). Sur cette braise claire, le blanc ne tient
que 2.9:1 : **`textOnPrimary` devient encre 950 en sombre** — les CTA sombres portent du
texte foncé, comme les boutons orange d'iOS. Chaque token a une valeur propre par thème —
aucune couleur n'est calculée à la volée. Les ombres prennent la couleur `shadow` du thème
(brun chaud en clair, noir en sombre).

## 3. Typographie

| Rôle | Police | Usage |
|------|--------|-------|
| Marque | **Playfair Display SC** | logo, splash, titres de section éditoriaux uniquement |
| Titres | **Sora** | 600/700 — titres d'écran, noms de produits, prix |
| Texte | **Inter** | 400/500 — descriptions, labels, formulaires |

Échelle (mobile) : `11 · 12 · 13 · 15 · 17 · 20 · 24 · 30 · 38`
Interlignage corps : 1.5 · Titres : 1.2

Les prix et compteurs utilisent `fontVariant: ['tabular-nums']` pour ne jamais faire sauter
la mise en page quand un chiffre change.

## 4. Espacements et rayons

Rythme 4 pt : `2 · 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64`
Marge horizontale standard des écrans : **20 pt**.

| Rayon | Valeur | Usage |
|-------|--------|-------|
| sm | 8 | puces, badges |
| md | 12 | inputs, petits boutons |
| lg | 16 | cartes produit |
| xl | 24 | feuilles modales, grandes cartes |
| pill | 999 | filtres, chips, CTA arrondis |

## 5. Élévation

Quatre niveaux seulement, ombres **chaudes** (base `#3A1E12`), jamais noir pur :

| Niveau | Usage |
|--------|-------|
| 0 | fond d'écran |
| 1 | cartes dans une liste |
| 2 | barre de panier flottante, chips actives |
| 3 | feuilles modales, popovers |

## 6. Mouvement

| Token | Durée | Courbe | Usage |
|-------|-------|--------|-------|
| `instant` | 100 ms | ease-out | feedback de pression |
| `fast` | 180 ms | ease-out | apparition de chips, toasts |
| `base` | 260 ms | spring(damping 18) | transitions d'écran, feuilles |
| `slow` | 420 ms | spring(damping 22) | splash, hero produit |

Règles : pression = `scale 0.97` (jamais de déplacement de layout) · entrée de liste en
cascade 40 ms par élément, plafonnée à 8 éléments · `prefers-reduced-motion` coupe toute
translation et ne garde que l'opacité.

## 7. Composants clés

| Composant | Points de vigilance |
|-----------|--------------------|
| `ProductCard` | image 4:3 avec `expo-image` + placeholder blurhash, badge promo en surimpression, bouton « + » 44×44 minimum |
| `CategoryChips` | scroll horizontal, état actif = braise pleine + texte blanc, `snapToInterval` |
| `CartBar` | barre flottante au-dessus de la tab bar, respecte `safe-area-inset-bottom`, masquée si panier vide |
| `OrderTimeline` | 5 nœuds, l'état courant pulse, les états passés sont pleins, les futurs en contour |
| `QuantityStepper` | zone tactile 44×44 par bouton, `hitSlop` si l'icône est plus petite |
| `PriceBreakdown` | chiffres tabulaires, total en Sora 700, réduction en vert avec signe `−` |
| `Toast` (`ToastProvider` + `useToast`) | un seul toast à la fois, en haut sous la safe area, auto-dismiss 3.5 s (5 s pour les erreurs), `accessibilityLiveRegion` — branché en filet global sur `createQueryClient({ onMutationError })` : aucune mutation n'échoue en silence |
| `InlineAlert` | bandeau contextuel `info/warning/danger/success`, texte en `on*Soft`, action optionnelle — remplace tous les bandeaux faits main |
| `IconBubble` | icône dans un rond de couleur douce, diamètre paramétrable — le motif n'est plus réécrit à la main |
| `OfflineBanner` | persistant, animé, `safeAreaTop` quand il est rendu en haut de fenêtre, bouton « Réessayer » réellement pressable |

## 8. États obligatoires

Chaque écran de données implémente **six** états — un écran sans eux est considéré incomplet :

`loading` (skeleton, jamais de spinner plein écran) · `empty` (illustration + action) ·
`error` (cause + bouton Réessayer) · `success` · `offline` (bandeau persistant) ·
`no-results` (recherche : suggestion de réinitialiser les filtres).

## 9. Icônes

`@expo/vector-icons` → jeu **Phosphor** uniquement, trait 1.5, taille tokenisée
(`16 · 20 · 24 · 28`). Aucun emoji utilisé comme icône structurelle. Les emojis sont
autorisés uniquement dans du contenu rédactionnel (« Bonjour Martin 👋 »).

## 10. Accessibilité — plancher

- Cible tactile ≥ 44×44 pt, espacement ≥ 8 pt
- `accessibilityLabel` sur tout bouton icône
- Contraste texte principal ≥ 4.5:1, secondaire ≥ 3:1, **vérifié dans les deux thèmes**
- Support du Dynamic Type sans troncature des prix ni des CTA
- L'information n'est jamais portée par la couleur seule (statut = icône + texte)

## 11. Le dashboard admin est un outil, pas une vitrine

Les sections 1 à 10 décrivent le système commun aux trois applications. Le
dashboard s'en écarte sur un seul axe — la **densité** — et c'est délibéré : les
apps client et livreur sont tenues à bout de bras, le dashboard est ouvert huit
heures par jour sur un écran, souvent avec dix commandes visibles à la fois.

| Axe | Apps mobiles | Dashboard |
|-----|--------------|-----------|
| Densité | aérée (16 → 64 px) | dense (8 → 32 px), tableaux à survol de ligne |
| Mouvement | transitions d'écran, gestes | micro-interactions 150 ms, rien d'autre |
| Typographie | hiérarchie forte | corps 14 px, chiffres tabulaires partout |
| Cible tactile | 44 pt strict | 44 pt maintenu (le gérant consulte au téléphone) |

Ce qui **ne change pas** : les tokens de couleur, les six états obligatoires
(§8), le jeu d'icônes (§9) et le plancher d'accessibilité (§10). Le dashboard
n'a pas de palette à lui.

### Chiffres tabulaires

Tout nombre qui change en place — KPI, montant de tableau, compteur, heure —
porte la classe `.tabular`. Sans elle, passer de `9` à `10` décale la colonne
entière, et un tableau de commandes qui se rafraîchit toutes les secondes
devient illisible.

### Règles propres au dashboard

- **Le contexte avant le contenu.** En haut de la sidebar, au-dessus de la
  navigation, la pastille d'état du service répond à la question qu'on se pose
  vingt fois par service : « est-ce qu'on prend encore des commandes ? » Elle
  informe et ne bascule pas — l'interrupteur reste sur la vue d'ensemble, pour
  qu'un clic distrait dans la barre latérale ne coupe pas les ventes. À la place
  vivait un sélecteur d'établissement, retiré avec le multi-restaurants.
- **La navigation se filtre par rôle.** Une entrée invisible n'est pas une
  sécurité (la RLS s'en charge) : elle évite d'ouvrir une page qui n'afficherait
  que des refus.
- **Jamais d'écran d'attente plein cadre au démarrage.** Ce que le serveur peut
  résoudre avant le premier rendu (l'établissement, le profil, le rôle) arrive
  avec le HTML. Ce qui se charge ensuite se signale par un squelette *à sa
  place* dans la page, pas par un voile sur toute l'application.
- **Deux rythmes d'écriture.** Ce qu'on touche en plein service (ouvert /
  ferme / rupture de stock) s'enregistre au clic. Ce qui a des conséquences
  tarifaires passe par un brouillon et une barre « modifications non
  enregistrées ».

## 12. Outillage

Le skill **`ui-ux-pro-max`** est versionné dans le dépôt
(`.claude/skills/ui-ux-pro-max/`) : chaque personne qui ouvre le projet dispose
de la même base — 67 styles, 161 palettes, 57 appariements typographiques, 99
règles UX, et une checklist d'accessibilité.

```bash
python .claude/skills/ui-ux-pro-max/scripts/search.py "restaurant admin dashboard" --design-system --density 8
```

Ses recommandations de palette sont **écartées au profit des tokens du §2** :
les couleurs d'Istanbul ont été validées au contraste dans les deux thèmes
(`packages/tokens/src/contrast.test.ts`, 24 assertions), ce qu'une palette
générique ne garantit pas. On lui emprunte le système de densité, les règles
d'interaction et la checklist de livraison, pas les couleurs.
