import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import type { StatusTone } from '@istanbul/types';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

export interface BadgeProps {
  label: string;
  tone?: StatusTone;
  /**
   * `soft` — aplat pâle et texte teinté : statuts posés dans une carte.
   * `solid` — aplat saturé et texte blanc : accroches posées sur une photo,
   * où un fond pâle disparaîtrait.
   */
  variant?: 'soft' | 'solid';
  /** Point coloré à gauche — renforce le statut sans dépendre de la couleur seule. */
  dot?: boolean;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

/**
 * Puce de statut.
 *
 * Le libellé est toujours présent : la couleur seule ne porte jamais
 * l'information (règle d'accessibilité, et un daltonien représente environ
 * 8 % des hommes).
 *
 * Rayon 8, jamais la pilule — c'est ce qui distingue un badge (une étiquette
 * posée sur du contenu) d'une puce de filtre (un contrôle qu'on presse). Les
 * confondre est le premier tell d'une copie approximative.
 */
export function Badge({
  label,
  tone = 'neutral',
  variant = 'soft',
  dot = false,
  icon,
  size = 'md',
  style,
}: BadgeProps) {
  const theme = useTheme();

  // Les premiers plans `on*Soft` sont calibrés pour tenir 4.5:1 sur leur fond
  // doux — les tons de base (`info`, `warning`…) ne le garantissent pas.
  const soft: Record<StatusTone, { bg: string; fg: string }> = {
    neutral: { bg: theme.colors.surfaceSunken, fg: theme.colors.textSecondary },
    info: { bg: theme.colors.infoSoft, fg: theme.colors.onInfoSoft },
    warning: { bg: theme.colors.warningSoft, fg: theme.colors.onWarningSoft },
    success: { bg: theme.colors.successSoft, fg: theme.colors.onSuccessSoft },
    danger: { bg: theme.colors.dangerSoft, fg: theme.colors.onDangerSoft },
  };

  // En plein, les fonds sont les tons de base et le texte est blanc. `success`
  // vaut ici le vert assombri, pas le vert de marque : blanc sur #06C167 ne
  // donne que 2.3:1.
  const solid: Record<StatusTone, { bg: string; fg: string }> = {
    neutral: { bg: theme.colors.surfaceInverse, fg: theme.colors.textInverse },
    info: { bg: theme.colors.info, fg: theme.colors.textInverse },
    warning: { bg: theme.colors.warning, fg: theme.colors.textInverse },
    success: { bg: theme.colors.success, fg: theme.colors.textInverse },
    danger: { bg: theme.colors.danger, fg: theme.colors.textInverse },
  };

  const { bg, fg } = (variant === 'solid' ? solid : soft)[tone];

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          borderRadius: theme.radius.sm,
          paddingHorizontal: size === 'sm' ? theme.spacing.sm : theme.spacing.md,
          paddingVertical: size === 'sm' ? 3 : theme.spacing.xs + 1,
        },
        style,
      ]}
    >
      {dot ? (
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: fg,
            marginRight: theme.spacing.xs + 2,
          }}
        />
      ) : null}
      {icon ? <View style={{ marginRight: theme.spacing.xs + 2 }}>{icon}</View> : null}
      <Text variant={size === 'sm' ? 'overline' : 'labelStrong'} style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Pastille de comptage — panier, notifications non lues.
 *
 * Verte, pas noire : c'est le seul endroit où la couleur de marque sert de
 * fond plein, et c'est justement ce qui fait qu'on la repère dans une barre
 * d'onglets entièrement en noir et blanc.
 */
export function CountBadge({ count, max = 99 }: { count: number; max?: number }) {
  const theme = useTheme();
  if (count <= 0) return null;

  return (
    <View
      accessibilityLabel={`${count} élément${count > 1 ? 's' : ''}`}
      style={{
        minWidth: 18,
        height: 18,
        paddingHorizontal: 5,
        borderRadius: 9,
        backgroundColor: theme.colors.success,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="overline" tabular style={{ color: theme.colors.textInverse }}>
        {count > max ? `${max}+` : count}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
});
