import React from 'react';
import { FlatList, StyleSheet, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import {
  BeerBottle,
  BowlFood,
  BowlSteam,
  Bread,
  Cake,
  Carrot,
  Champagne,
  Cheese,
  Coffee,
  Cookie,
  CookingPot,
  Egg,
  Fish,
  ForkKnife,
  Hamburger,
  IceCream,
  Martini,
  Orange,
  Pepper,
  Pizza,
  Popcorn,
  Shrimp,
  Wine,
} from 'phosphor-react-native';
import type { Category } from '@istanbul/types';
import { useTheme } from '../theme/ThemeProvider';
import { Pressable } from './Pressable';
import { Text } from './Text';

/**
 * Résolution de `categories.icon`, qui stocke un nom d'icône Phosphor saisi
 * dans le backoffice (« Wrap », « Hamburger », « Pizza »…).
 *
 * Table explicite plutôt qu'un `import * as Icons` : le baril de Phosphor
 * compte des milliers de modules, et Metro les embarquerait tous dans le
 * bundle pour la vingtaine réellement utilisée ici.
 *
 * La table est le jumeau de celle de la vitrine web
 * (`apps/admin/src/components/store/CategoryIcon.tsx`) : mêmes noms, mêmes
 * alias. Si l'une gagne une entrée, l'autre doit la gagner aussi, sinon une
 * catégorie s'affiche avec son icône sur le web et avec la fourchette par
 * défaut sur mobile.
 */
const ICONS: Record<string, typeof ForkKnife> = {
  BeerBottle,
  BowlFood,
  BowlSteam,
  Bread,
  Cake,
  Carrot,
  Champagne,
  Cheese,
  Coffee,
  Cookie,
  CookingPot,
  Egg,
  Fish,
  ForkKnife,
  Hamburger,
  IceCream,
  Martini,
  Orange,
  Pepper,
  Pizza,
  Popcorn,
  Shrimp,
  Wine,

  // Alias — noms absents de la version installée de Phosphor.
  Wrap: BowlFood,
  Sandwich: Bread,
  FrenchFries: Popcorn,
  Salad: Carrot,
};

export interface CategoryRailProps {
  categories: Category[];
  onSelect: (categoryId: string) => void;
  style?: ViewStyle;
}

/**
 * Rail de catégories — pastille ronde et libellé dessous.
 *
 * C'est la rangée qui ouvre le fil d'accueil de la référence : on y accède
 * d'un coup d'œil à « Pizzas », « Burgers », « Boissons » sans lire une liste.
 * Distinct de `CategoryChips`, qui reste un *filtre* (état sélectionné, aplat
 * noir) sur l'écran du menu — ici il n'y a pas d'état, seulement un raccourci.
 *
 * L'image de la catégorie prime sur son icône quand le gérant en a chargé une :
 * une photo de plat vend mieux qu'un pictogramme, et c'est précisément ce que
 * fait Uber avec ses illustrations.
 */
export function CategoryRail({ categories, onSelect, style }: CategoryRailProps) {
  const theme = useTheme();

  return (
    <FlatList
      horizontal
      data={categories}
      keyExtractor={(item) => item.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        { paddingHorizontal: theme.screenPadding, gap: theme.spacing.lg },
        style,
      ]}
      renderItem={({ item }) => {
        const Icon = (item.icon && ICONS[item.icon]) || ForkKnife;

        return (
          <Pressable
            onPress={() => onSelect(item.id)}
            accessibilityLabel={item.name}
            style={styles.item}
          >
            <View
              style={[
                styles.bubble,
                {
                  backgroundColor: theme.colors.surfaceSunken,
                  borderRadius: theme.radius.pill,
                },
              ]}
            >
              {item.image_url ? (
                <Image
                  source={item.image_url}
                  contentFit="cover"
                  transition={180}
                  cachePolicy="memory-disk"
                  style={StyleSheet.absoluteFill}
                  accessibilityLabel={item.name}
                />
              ) : (
                <Icon size={30} color={theme.colors.text} weight="duotone" />
              )}
            </View>

            <Text
              variant="caption"
              align="center"
              numberOfLines={1}
              style={{ marginTop: theme.spacing.sm, maxWidth: 68 }}
            >
              {item.name}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  item: { alignItems: 'center', width: 68 },
  bubble: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
