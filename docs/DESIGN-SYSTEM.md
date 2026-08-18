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
| **500** | **`#E5431C`** | **couleur de marque, boutons primaires** |
| 600 | `#C4320F` | état pressé |
| 700 | `#9E260B` | texte sur fond clair braise |

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
| success | `#2F8F49` | `#4FBF6C` |
| warning | `#D08700` | `#F0B429` |
| danger | `#D32F2F` | `#F26B6B` |
| info | `#1B7F9E` | `#4FB6D4` |

### Mode sombre

Le mode sombre n'inverse pas les valeurs : il repose sur des surfaces **encre 950/900/800**
et remonte la braise à `#FF6A45` pour conserver 4.5:1 sur fond sombre. Chaque token a une
valeur propre par thème — aucune couleur n'est calculée à la volée.

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
