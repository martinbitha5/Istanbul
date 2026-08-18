import React, { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import {
  ArrowClockwise,
  CloudSlash,
  MagnifyingGlass,
  WarningOctagon,
} from 'phosphor-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';
import { Text } from './Text';

/**
 * Les six états obligatoires.
 *
 * Un écran de données qui n'en implémente pas au moins loading / empty / error
 * est considéré comme incomplet dans ce projet. Ces composants sont là pour
 * qu'il n'y ait aucune excuse.
 */

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

export interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, radius, style }: SkeletonProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0.4);

  useEffect(() => {
    if (reducedMotion) return;
    progress.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, [progress, reducedMotion]);

  const animated = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: radius ?? theme.radius.sm,
          backgroundColor: theme.colors.skeleton,
        },
        animated,
        style,
      ]}
    />
  );
}

/** Squelette d'une carte produit — réserve exactement la place du contenu réel. */
export function ProductCardSkeleton() {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: theme.spacing.base }}>
      <Skeleton height={140} radius={theme.radius.lg} />
      <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.sm }}>
        <Skeleton width="70%" height={16} />
        <Skeleton width="45%" height={13} />
        <Skeleton width="30%" height={18} />
      </View>
    </View>
  );
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// États vides / erreur
// ---------------------------------------------------------------------------

export interface StateViewProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

function StateView({ title, description, actionLabel, onAction, icon, style }: StateViewProps) {
  const theme = useTheme();

  return (
    <View style={[styles.state, { padding: theme.spacing['2xl'] }, style]}>
      {icon ? (
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: theme.colors.surfaceSunken,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: theme.spacing.lg,
          }}
        >
          {icon}
        </View>
      ) : null}

      <Text variant="h2" align="center">
        {title}
      </Text>

      {description ? (
        <Text
          variant="body"
          color="textSecondary"
          align="center"
          style={{ marginTop: theme.spacing.sm, maxWidth: 300 }}
        >
          {description}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant="secondary"
          style={{ marginTop: theme.spacing.xl }}
        />
      ) : null}
    </View>
  );
}

export function EmptyState(props: StateViewProps) {
  return <StateView {...props} />;
}

export function ErrorState({
  title = 'Impossible de charger',
  description = 'Vérifiez votre connexion et réessayez.',
  onRetry,
  ...rest
}: Partial<StateViewProps> & { onRetry?: () => void }) {
  const theme = useTheme();
  return (
    <StateView
      title={title}
      description={description}
      actionLabel={onRetry ? 'Réessayer' : undefined}
      onAction={onRetry}
      icon={<WarningOctagon size={32} color={theme.colors.danger} weight="duotone" />}
      {...rest}
    />
  );
}

export function NoResultsState({ query, onReset }: { query: string; onReset?: () => void }) {
  const theme = useTheme();
  return (
    <StateView
      title="Aucun résultat"
      description={`Rien ne correspond à « ${query} ». Essayez un autre mot ou réinitialisez les filtres.`}
      actionLabel={onReset ? 'Réinitialiser' : undefined}
      onAction={onReset}
      icon={<MagnifyingGlass size={32} color={theme.colors.textMuted} weight="duotone" />}
    />
  );
}

// ---------------------------------------------------------------------------
// Hors ligne
// ---------------------------------------------------------------------------

/**
 * Bandeau hors ligne persistant.
 *
 * Persistant, pas un toast : tant que la connexion est absente, l'utilisateur
 * doit pouvoir comprendre à tout moment pourquoi ses actions échouent.
 */
export function OfflineBanner({ visible, onRetry }: { visible: boolean; onRetry?: () => void }) {
  const theme = useTheme();
  if (!visible) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.banner,
        {
          backgroundColor: theme.colors.warningSoft,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.screenPadding,
        },
      ]}
    >
      <CloudSlash size={theme.iconSize.sm} color={theme.colors.warning} weight="fill" />
      <Text variant="label" style={{ color: theme.colors.warning, flex: 1, marginLeft: 8 }}>
        Vous êtes hors ligne. Certaines actions sont indisponibles.
      </Text>
      {onRetry ? (
        <ArrowClockwise size={theme.iconSize.xs} color={theme.colors.warning} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  state: { alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  banner: { flexDirection: 'row', alignItems: 'center' },
});
