import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Heart, Plus } from 'phosphor-react-native';
import type { Product } from '@istanbul/types';
import { useTheme } from '../theme/ThemeProvider';
import { Badge } from './Badge';
import { Pressable } from './Pressable';
import { Price, Text } from './Text';

export interface ProductCardProps {
  product: Product;
  onPress: () => void;
  onAdd?: () => void;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
  /** `grid` pour deux colonnes, `row` pour une liste pleine largeur. */
  layout?: 'grid' | 'row';
  formatPrice: (cents: number) => string;
  style?: ViewStyle;
}

const BLUR_PLACEHOLDER = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

/**
 * Carte produit.
 *
 * En grille, il n'y a pas de carte : une image en 16:9, un nom, un prix, posés
 * à même le fond blanc. Ni cadre, ni ombre, ni fond gris. C'est le contre-pied
 * de l'ancienne version, et c'est ce qui donne à la page son calme — vingt
 * cartes ombrées à la suite créent un bruit visuel que la photo du plat devrait
 * être seule à produire.
 *
 * Le bouton « + » est un disque blanc posé en bas à droite de l'image, jamais
 * une case dans une barre de prix : il tombe sous le pouce et ne pousse aucun
 * texte. Il ouvre la fiche si le produit a des options obligatoires, sinon il
 * ajoute au panier — l'écran appelant décide, la carte ne fait qu'émettre
 * l'intention.
 */
export function ProductCard({
  product,
  onPress,
  onAdd,
  onToggleFavorite,
  isFavorite = false,
  layout = 'grid',
  formatPrice,
  style,
}: ProductCardProps) {
  const theme = useTheme();
  const unavailable = !product.is_available;
  const hasDiscount = product.compare_at_price != null;
  const isGrid = layout === 'grid';

  /** Disque blanc — bouton d'ajout et cœur partagent la même pastille. */
  const disc = (content: React.ReactNode, onPressDisc: () => void, label: string) => (
    <Pressable
      onPress={onPressDisc}
      hitSlop={8}
      accessibilityLabel={label}
      style={[
        styles.disc,
        { backgroundColor: theme.colors.surface, borderRadius: theme.radius.pill },
        theme.elevation[2],
      ]}
    >
      {content}
    </Pressable>
  );

  const image = (
    <View style={isGrid ? styles.gridImageWrap : styles.rowImageWrap}>
      <Image
        source={product.image_url}
        placeholder={product.image_blurhash ?? BLUR_PLACEHOLDER}
        contentFit="cover"
        transition={220}
        cachePolicy="memory-disk"
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: theme.radius.md, opacity: unavailable ? 0.4 : 1 },
        ]}
        accessibilityLabel={product.name}
      />

      {/* Accroches en surimpression : en plein, pas en pâle — un badge doux
          posé sur une photo disparaît dès que la photo est claire. */}
      {!unavailable && (hasDiscount || product.is_popular) ? (
        <View style={[styles.topLeft, { margin: theme.spacing.sm, gap: theme.spacing.xs }]}>
          {hasDiscount ? <Badge label="Promo" tone="danger" variant="solid" size="sm" /> : null}
          {product.is_popular ? (
            <Badge label="Le plus aimé" tone="success" variant="solid" size="sm" />
          ) : null}
        </View>
      ) : null}

      {unavailable ? (
        <View
          style={[
            styles.unavailable,
            { backgroundColor: theme.colors.scrim, borderRadius: theme.radius.md },
          ]}
        >
          <Badge label="Rupture" tone="neutral" variant="solid" size="sm" />
        </View>
      ) : null}

      {onToggleFavorite ? (
        <View style={[styles.topRight, { margin: theme.spacing.sm }]}>
          {disc(
            <Heart
              size={theme.iconSize.xs}
              color={isFavorite ? theme.colors.danger : theme.colors.text}
              weight={isFavorite ? 'fill' : 'regular'}
            />,
            onToggleFavorite,
            isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris',
          )}
        </View>
      ) : null}

      {onAdd && !unavailable ? (
        <View style={[styles.bottomRight, { margin: theme.spacing.sm }]}>
          {disc(
            <Plus size={theme.iconSize.sm} color={theme.colors.text} weight="bold" />,
            onAdd,
            `Ajouter ${product.name} au panier`,
          )}
        </View>
      ) : null}
    </View>
  );

  const content = (
    <View style={{ flex: 1 }}>
      <Text variant="h3" numberOfLines={2}>
        {product.name}
      </Text>

      {product.description ? (
        <Text
          variant="bodySmall"
          color="textSecondary"
          numberOfLines={isGrid ? 1 : 2}
          style={{ marginTop: 2 }}
        >
          {product.description}
        </Text>
      ) : null}

      <View style={[styles.priceGroup, { marginTop: theme.spacing.xs }]}>
        <Price variant="priceSmall" color={unavailable ? 'textMuted' : 'text'}>
          {formatPrice(product.base_price)}
        </Price>
        {hasDiscount ? (
          <Text
            variant="caption"
            color="textMuted"
            tabular
            style={[styles.strike, { marginLeft: theme.spacing.sm }]}
          >
            {formatPrice(product.compare_at_price!)}
          </Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`${product.name}, ${formatPrice(product.base_price)}`}
      accessibilityHint="Ouvre la fiche du produit"
      style={[
        isGrid
          ? styles.gridCard
          : [
              styles.rowCard,
              {
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.md,
                borderWidth: theme.borderWidth.hairline,
                borderColor: theme.colors.border,
                padding: theme.spacing.md,
              },
            ],
        style,
      ]}
    >
      {/* En ligne, le texte passe devant et l'image ferme la carte : c'est le
          sens de lecture de « Commandez de nouveau » chez Uber, et il met le
          nom du plat au bord gauche où l'œil le cherche. */}
      {isGrid ? (
        <>
          {image}
          <View style={{ marginTop: theme.spacing.sm }}>{content}</View>
        </>
      ) : (
        <>
          {content}
          <View style={{ marginLeft: theme.spacing.md }}>{image}</View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gridCard: { flex: 1 },
  rowCard: { flexDirection: 'row', alignItems: 'center' },
  // 16:9 en grille : le format des vignettes de plat de la référence, et
  // celui qui laisse le plus de plats visibles dans un carrousel.
  gridImageWrap: { width: '100%', aspectRatio: 16 / 9 },
  rowImageWrap: { width: 96, height: 96 },
  topLeft: { position: 'absolute', top: 0, left: 0 },
  topRight: { position: 'absolute', top: 0, right: 0 },
  bottomRight: { position: 'absolute', bottom: 0, right: 0 },
  unavailable: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  priceGroup: { flexDirection: 'row', alignItems: 'baseline' },
  strike: { textDecorationLine: 'line-through' },
  disc: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
