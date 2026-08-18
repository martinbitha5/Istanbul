import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import type { StatusTone } from '@istanbul/types';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

export interface BadgeProps {
  label: string;
  tone?: StatusTone;
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
 */
export function Badge({ label, tone = 'neutral', dot = false, icon, size = 'md', style }: BadgeProps) {
  const theme = useTheme();

  const tones: Record<StatusTone, { bg: string; fg: string }> = {
    neutral: { bg: theme.colors.surfaceSunken, fg: theme.colors.textSecondary },
    info: { bg: theme.colors.infoSoft, fg: theme.colors.info },
    warning: { bg: theme.colors.warningSoft, fg: theme.colors.warning },
    success: { bg: theme.colors.successSoft, fg: theme.colors.success },
    danger: { bg: theme.colors.dangerSoft, fg: theme.colors.danger },
  };

  const { bg, fg } = tones[tone];

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          borderRadius: theme.radius.pill,
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

/** Pastille de comptage — panier, notifications non lues. */
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
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="overline" tabular style={{ color: theme.colors.textOnPrimary }}>
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
