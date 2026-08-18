import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Fire, Heart, Plus } from 'phosphor-react-native';
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
 * L'image occupe la moitié de la surface : c'est elle qui déclenche l'achat.
 * Le bouton « + » ouvre la fiche si le produit a des options obligatoires,
 * sinon il ajoute directement au panier — l'écran appelant décide, la carte
 * ne fait qu'émettre l'intention.
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

  const image = (
    <View style={layout === 'grid' ? styles.gridImageWrap : styles.rowImageWrap}>
      <Image
        source={product.image_url}
        placeholder={product.image_blurhash ?? BLUR_PLACEHOLDER}
        contentFit="cover"
        transition={220}
        cachePolicy="memory-disk"
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: theme.radius.lg, opacity: unavailable ? 0.4 : 1 },
        ]}
        accessibilityLabel={product.name}
      />

      {/* Badges en surimpression — au maximum un par coin. */}
      {product.is_popular && !unavailable ? (
        <View style={[styles.topLeft, { margin: theme.spacing.sm }]}>
          <Badge
            label="Populaire"
            tone="warning"
            size="sm"
            icon={<Fire size={11} color={theme.colors.warning} weight="fill" />}
          />
        </View>
      ) : null}

      {hasDiscount && !unavailable ? (
        <View style={[styles.topLeft, { margin: theme.spacing.sm }]}>
          <Badge label="Promo" tone="danger" size="sm" />
        </View>
      ) : null}

      {unavailable ? (
        <View
          style={[
            styles.unavailable,
            { backgroundColor: theme.colors.scrim, borderRadius: theme.radius.lg },
          ]}
        >
          <Badge label="Rupture" tone="neutral" size="sm" />
        </View>
      ) : null}

      {onToggleFavorite ? (
        <Pressable
          onPress={onToggleFavorite}
          hitSlop={10}
          noScale
          accessibilityLabel={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          style={[
            styles.topRight,
            {
              margin: theme.spacing.sm,
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.pill,
              padding: 6,
            },
          ]}
        >
          <Heart
            size={theme.iconSize.xs}
            color={isFavorite ? theme.colors.primary : theme.colors.textMuted}
            weight={isFavorite ? 'fill' : 'regular'}
          />
        </Pressable>
      ) : null}
    </View>
  );

  const content = (
    <View style={{ flex: 1 }}>
      <Text variant="h3" numberOfLines={layout === 'grid' ? 1 : 2}>
        {product.name}
      </Text>

      {product.description ? (
        <Text
          variant="bodySmall"
          color="textSecondary"
          numberOfLines={layout === 'grid' ? 1 : 2}
          style={{ marginTop: 2 }}
        >
          {product.description}
        </Text>
      ) : null}

      <View style={[styles.priceRow, { marginTop: theme.spacing.sm }]}>
        <View style={styles.priceGroup}>
          <Price color={unavailable ? 'textMuted' : 'text'}>
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

        {onAdd && !unavailable ? (
          <Pressable
            onPress={onAdd}
            hitSlop={8}
            accessibilityLabel={`Ajouter ${product.name} au panier`}
            style={[
              styles.addButton,
              { backgroundColor: theme.colors.primary, borderRadius: theme.radius.md },
            ]}
          >
            <Plus size={theme.iconSize.sm} color={theme.colors.textOnPrimary} weight="bold" />
          </Pressable>
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
        layout === 'grid' ? styles.gridCard : styles.rowCard,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.sm,
        },
        theme.elevation[1],
        style,
      ]}
    >
      {image}
      <View style={layout === 'grid' ? { marginTop: theme.spacing.md } : { flex: 1, marginLeft: theme.spacing.md }}>
        {content}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gridCard: { flex: 1 },
  rowCard: { flexDirection: 'row', alignItems: 'center' },
  // 4:3 en grille : le ratio qui met le mieux en valeur une assiette.
  gridImageWrap: { width: '100%', aspectRatio: 4 / 3 },
  rowImageWrap: { width: 96, height: 96 },
  topLeft: { position: 'absolute', top: 0, left: 0 },
  topRight: { position: 'absolute', top: 0, right: 0 },
  unavailable: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceGroup: { flexDirection: 'row', alignItems: 'baseline', flex: 1 },
  strike: { textDecorationLine: 'line-through' },
  addButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
