import React, { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import {
  CheckCircle,
  CloudSlash,
  Info,
  MagnifyingGlass,
  Warning,
  WarningOctagon,
} from 'phosphor-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';
import { Pressable } from './Pressable';
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
      {/* 16:9, comme l'image réelle de la carte produit : un squelette qui
          réserve la mauvaise hauteur fait sauter la liste au chargement. */}
      <Skeleton height={106} radius={theme.radius.md} />
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
      {/* Icône nue, sans pastille grise autour : les états vides de la
          référence posent une illustration à même le fond blanc. Le cercle
          gris ajoutait une forme à regarder avant le message, alors que le
          message est tout ce qui compte ici. */}
      {icon ? <View style={{ marginBottom: theme.spacing.lg }}>{icon}</View> : null}

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

      {/* En pilule noire : c'est la seule action de l'écran, elle n'a personne
          avec qui rivaliser et rien ne justifie de la sous-pondérer. */}
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant="primary"
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
      icon={<WarningOctagon size={48} color={theme.colors.danger} weight="duotone" />}
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
      icon={<MagnifyingGlass size={48} color={theme.colors.textMuted} weight="duotone" />}
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
 *
 * `safeAreaTop` : à activer quand le bandeau est rendu en haut de la fenêtre,
 * hors de tout SafeAreaView (cas du layout racine en edge-to-edge).
 */
export function OfflineBanner({
  visible,
  onRetry,
  safeAreaTop = false,
}: {
  visible: boolean;
  onRetry?: () => void;
  safeAreaTop?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(theme.duration.base)}
      exiting={FadeOutUp.duration(theme.duration.exit)}
      accessibilityLiveRegion="polite"
      style={[
        styles.banner,
        {
          backgroundColor: theme.colors.warningSoft,
          paddingTop: (safeAreaTop ? insets.top : 0) + theme.spacing.md,
          paddingBottom: theme.spacing.md,
          paddingHorizontal: theme.screenPadding,
        },
      ]}
    >
      <CloudSlash size={theme.iconSize.sm} color={theme.colors.onWarningSoft} weight="fill" />
      <Text
        variant="label"
        color="onWarningSoft"
        style={{ flex: 1, marginLeft: theme.spacing.sm }}
      >
        Vous êtes hors ligne. Certaines actions sont indisponibles.
      </Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          hitSlop={theme.spacing.md}
          accessibilityLabel="Réessayer la connexion"
        >
          <Text variant="labelStrong" color="onWarningSoft">
            Réessayer
          </Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Alerte en ligne
// ---------------------------------------------------------------------------

export type InlineAlertTone = 'info' | 'warning' | 'danger' | 'success';

export interface InlineAlertProps {
  message: string;
  tone?: InlineAlertTone;
  /** Action secondaire alignée à droite — « Réessayer », « Passer au retrait »… */
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

/**
 * Bandeau d'information contextuel — erreurs de formulaire, avertissements
 * métier (« commande minimum non atteinte », « adresse hors zone »).
 * Réécrit à la main dans une dizaine d'écrans avant d'exister ici.
 */
export function InlineAlert({ message, tone = 'info', actionLabel, onAction, style }: InlineAlertProps) {
  const theme = useTheme();

  const palettes: Record<InlineAlertTone, { bg: string; fg: string; icon: React.ReactNode }> = {
    info: {
      bg: theme.colors.infoSoft,
      fg: theme.colors.onInfoSoft,
      icon: <Info size={theme.iconSize.sm} color={theme.colors.onInfoSoft} weight="fill" />,
    },
    warning: {
      bg: theme.colors.warningSoft,
      fg: theme.colors.onWarningSoft,
      icon: <Warning size={theme.iconSize.sm} color={theme.colors.onWarningSoft} weight="fill" />,
    },
    danger: {
      bg: theme.colors.dangerSoft,
      fg: theme.colors.onDangerSoft,
      icon: (
        <WarningOctagon size={theme.iconSize.sm} color={theme.colors.onDangerSoft} weight="fill" />
      ),
    },
    success: {
      bg: theme.colors.successSoft,
      fg: theme.colors.onSuccessSoft,
      icon: (
        <CheckCircle size={theme.iconSize.sm} color={theme.colors.onSuccessSoft} weight="fill" />
      ),
    },
  };

  const palette = palettes[tone];

  return (
    <View
      accessibilityRole={tone === 'danger' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      style={[
        styles.alert,
        {
          backgroundColor: palette.bg,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
        },
        style,
      ]}
    >
      {palette.icon}
      <Text variant="label" style={{ color: palette.fg, flex: 1 }}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={theme.spacing.md} accessibilityRole="button">
          <Text variant="labelStrong" style={{ color: palette.fg, textDecorationLine: 'underline' }}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  state: { alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  banner: { flexDirection: 'row', alignItems: 'center' },
  alert: { flexDirection: 'row', alignItems: 'center' },
});
