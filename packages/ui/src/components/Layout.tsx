import React from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { ArrowLeft } from 'phosphor-react-native';
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
        {title ? (
          <Text variant={large ? 'h1' : 'h2'} numberOfLines={1}>
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
 * Se place au-dessus de l'indicateur de geste, avec une ombre vers le haut
 * pour marquer qu'elle flotte au-dessus du contenu qui défile dessous.
 */
export function BottomBar({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        {
          paddingHorizontal: theme.screenPadding,
          paddingTop: theme.spacing.base,
          paddingBottom: Math.max(insets.bottom, theme.spacing.base),
          backgroundColor: theme.colors.surface,
          borderTopWidth: theme.borderWidth.hairline,
          borderTopColor: theme.colors.border,
        },
        theme.elevation[3],
      ]}
    >
      {children}
    </View>
  );
}

/** Titre de section avec action optionnelle à droite (« Voir tout »). */
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
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} noScale>
          <Text variant="labelStrong" color="primary">
            {actionLabel}
          </Text>
        </Pressable>
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
});
