import React, { useRef } from 'react';
import { FlatList, StyleSheet, View, type ViewStyle } from 'react-native';
import type { Category } from '@istanbul/types';
import { useTheme } from '../theme/ThemeProvider';
import { Pressable } from './Pressable';
import { Text } from './Text';

export interface CategoryChipsProps {
  categories: Category[];
  selectedId: string | null;
  onSelect: (categoryId: string | null) => void;
  /** Ajoute une puce « Tout » en tête. */
  showAll?: boolean;
  style?: ViewStyle;
}

/**
 * Puces de catégories.
 *
 * Scroll horizontal simple : pas de gestes exotiques sur un élément qui doit
 * rester utilisable d'une main, dans un taxi, avec un pouce.
 *
 * Au repos, aplat gris sans bordure ; sélectionnée, aplat noir et texte blanc.
 * Le contraste entre les deux états est total, ce qui permet de se passer de
 * l'ombre et de la bordure que portait l'ancienne version : dans une interface
 * en noir et blanc, une puce noire ne peut pas passer pour inactive.
 */
export function CategoryChips({
  categories,
  selectedId,
  onSelect,
  showAll = true,
  style,
}: CategoryChipsProps) {
  const theme = useTheme();
  const listRef = useRef<FlatList<Category | null>>(null);

  const data: (Category | null)[] = showAll ? [null, ...categories] : categories;

  return (
    <FlatList
      ref={listRef}
      horizontal
      data={data}
      keyExtractor={(item, index) => item?.id ?? `all-${index}`}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        { paddingHorizontal: theme.screenPadding, gap: theme.spacing.sm },
        style,
      ]}
      renderItem={({ item }) => {
        const id = item?.id ?? null;
        const active = selectedId === id;

        return (
          <Pressable
            onPress={() => onSelect(id)}
            // Hauteur visuelle 40 : le hitSlop porte la cible tactile à 44.
            hitSlop={{ top: (theme.hitTarget - 40) / 2, bottom: (theme.hitTarget - 40) / 2 }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item?.name ?? 'Toutes les catégories'}
            style={[
              styles.chip,
              {
                backgroundColor: active ? theme.colors.primary : theme.colors.surfaceSunken,
                borderRadius: theme.radius.pill,
                paddingHorizontal: theme.spacing.base,
              },
            ]}
          >
            <Text
              variant="labelStrong"
              style={{ color: active ? theme.colors.textOnPrimary : theme.colors.text }}
              numberOfLines={1}
            >
              {item?.name ?? 'Tout'}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

/**
 * Bascule segmentée — « Livraison / À emporter », filtres de statut.
 *
 * Rail gris, cavalier blanc : c'est le seul endroit de l'interface où une
 * ombre porte encore du sens, parce qu'elle est ce qui fait lire le segment
 * actif comme posé *sur* le rail plutôt que découpé dedans.
 */
export interface FilterTabsProps<T extends string> {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  style?: ViewStyle;
}

export function FilterTabs<T extends string>({
  options,
  value,
  onChange,
  style,
}: FilterTabsProps<T>) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.tabs,
        {
          backgroundColor: theme.colors.surfaceSunken,
          borderRadius: theme.radius.pill,
          padding: 3,
        },
        style,
      ]}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            noScale
            hitSlop={{ top: (theme.hitTarget - 38) / 2, bottom: (theme.hitTarget - 38) / 2 }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[
              styles.tab,
              {
                backgroundColor: active ? theme.colors.surface : 'transparent',
                borderRadius: theme.radius.pill,
              },
              active && theme.elevation[1],
            ]}
          >
            <Text
              variant={active ? 'labelStrong' : 'label'}
              numberOfLines={1}
              style={{ color: active ? theme.colors.text : theme.colors.textSecondary }}
            >
              {option.label}
              {option.count != null ? ` (${option.count})` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { height: 40, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row' },
  tab: { flex: 1, height: 38, alignItems: 'center', justifyContent: 'center' },
});
