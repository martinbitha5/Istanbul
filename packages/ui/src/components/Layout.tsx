import React from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowRight } from 'phosphor-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Pressable } from './Pressable';
import { Text } from './Text';

export interface ScreenProps {
  children: React.ReactNode;
  /** Par défaut : haut et côtés. Le bas est géré par la tab bar ou une barre d'action. */
  edges?: Edge[];
  padded?: boolean;
  sunken?: boolean;
  style?: ViewStyle;
}

export function Screen({
  children,
  edges = ['top', 'left', 'right'],
  padded = false,
  sunken = false,
  style,
}: ScreenProps) {
  const theme = useTheme();

  return (
    <SafeAreaView
      edges={edges}
      style={[
        styles.flex,
        { backgroundColor: sunken ? theme.colors.surfaceSunken : theme.colors.background },
        padded && { paddingHorizontal: theme.screenPadding },
        style,
      ]}
    >
      {children}
    </SafeAreaView>
  );
}

export interface ScreenScrollProps extends ScrollViewProps {
  children: React.ReactNode;
  padded?: boolean;
  /** Espace réservé sous le contenu — barre de panier, CTA flottant. */
  bottomInset?: number;
}

export function ScreenScroll({
  children,
  padded = true,
  bottomInset = 0,
  contentContainerStyle,
  ...rest
}: ScreenScrollProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        padded && { paddingHorizontal: theme.screenPadding },
        // Le contenu ne doit jamais finir sous une barre fixe.
        { paddingBottom: bottomInset + insets.bottom + theme.spacing.xl },
        contentContainerStyle,
      ]}
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

export interface HeaderProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  /** Titre gros et aligné à gauche, à la façon iOS. */
  large?: boolean;
  transparent?: boolean;
  style?: ViewStyle;
}

export function Header({
  title,
  subtitle,
  onBack,
  right,
  large = false,
  transparent = false,
  style,
}: HeaderProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.header,
        {
          paddingHorizontal: theme.screenPadding,
          paddingVertical: theme.spacing.md,
          backgroundColor: transparent ? 'transparent' : theme.colors.background,
        },
        style,
      ]}
    >
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={12}
          accessibilityLabel="Retour"
          style={[
            styles.backButton,
            {
              backgroundColor: transparent ? theme.colors.surface : 'transparent',
              borderRadius: theme.radius.pill,
            },
            transparent && theme.elevation[1],
          ]}
        >
          <ArrowLeft size={theme.iconSize.md} color={theme.colors.text} />
        </Pressable>
      ) : null}

      <View style={[styles.headerCenter, onBack ? { marginLeft: theme.spacing.sm } : null]}>
        {/* `large` monte à h1 (28 pt) : les titres d'écran de la référence sont
            volontairement gros et alignés à gauche — « Paniers », « Commandes »
            occupent le haut de l'écran au lieu de s'excuser dans une barre. */}
        {title ? (
          <Text variant={large ? 'h1' : 'h3'} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {right ? <View style={styles.headerRight}>{right}</View> : null}
    </View>
  );
}

/**
 * Barre d'action ancrée en bas.
 *
 * Un filet, pas une ombre : la référence marque cette séparation par un trait
 * de 1 px et rien d'autre. L'ombre portée qu'il y avait ici faisait flotter
 * la barre au-dessus du contenu, ce qui n'a de sens que pour un élément qu'on
 * peut déplacer — or celle-ci est ancrée.
 */
export function BottomBar({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingHorizontal: theme.screenPadding,
        paddingTop: theme.spacing.md,
        paddingBottom: Math.max(insets.bottom, theme.spacing.md),
        backgroundColor: theme.colors.surface,
        borderTopWidth: theme.borderWidth.hairline,
        borderTopColor: theme.colors.divider,
      }}
    >
      {children}
    </View>
  );
}

/**
 * Titre de section, avec action optionnelle à droite.
 *
 * Deux formes d'action, et la forme dit la portée : un libellé (« Voir le
 * menu ») quand la destination mérite d'être nommée, un simple disque fléché
 * quand elle ne fait que dérouler la section qu'on vient de lire. La référence
 * utilise le disque partout dans son fil d'accueil, et c'est ce qui laisse les
 * titres de section respirer.
 */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
  style,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.sectionHeader, { marginBottom: theme.spacing.md }, style]}>
      <Text variant="h2" style={{ flex: 1 }}>
        {title}
      </Text>

      {onAction ? (
        actionLabel ? (
          <Pressable onPress={onAction} hitSlop={8} noScale>
            <Text variant="labelStrong" style={{ textDecorationLine: 'underline' }}>
              {actionLabel}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={onAction}
            hitSlop={8}
            accessibilityLabel={`Tout voir : ${title}`}
            style={[
              styles.sectionArrow,
              {
                backgroundColor: theme.colors.surfaceSunken,
                borderRadius: theme.radius.pill,
              },
            ]}
          >
            <ArrowRight size={theme.iconSize.sm} color={theme.colors.text} weight="bold" />
          </Pressable>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center' },
  sectionArrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
