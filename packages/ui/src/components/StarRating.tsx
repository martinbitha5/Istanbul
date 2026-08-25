import React from 'react';
import { View } from 'react-native';
import { Star } from 'phosphor-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Pressable } from './Pressable';
import { Text } from './Text';

/**
 * Rangée d'étoiles — saisie (onChange fourni) ou affichage (lecture seule).
 *
 * Cibles tactiles généreuses en saisie : on note souvent d'une main, dans la
 * rue, juste après avoir récupéré son sac.
 */
export function StarRating({
  value,
  onChange,
  size = 32,
  label,
}: {
  value: number | null;
  onChange?: (value: number) => void;
  size?: number;
  label?: string;
}) {
  const theme = useTheme();
  const readonly = !onChange;

  return (
    <View>
      {label ? (
        <Text variant="label" color="textSecondary" style={{ marginBottom: theme.spacing.xs }}>
          {label}
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', gap: readonly ? 2 : theme.spacing.sm }}>
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = value != null && star <= value;
          const icon = (
            // Étoile noire, pas dorée : la référence affiche « 4,2 ★ » en
            // noir plein. Une étoile ambre serait la seule tache de couleur
            // d'une carte par ailleurs entièrement en noir et blanc, et
            // attirerait l'œil plus que le nom du plat.
            <Star
              size={size}
              color={filled ? theme.colors.text : theme.colors.border}
              weight={filled ? 'fill' : 'regular'}
            />
          );

          if (readonly) {
            return <View key={star}>{icon}</View>;
          }

          return (
            <Pressable
              key={star}
              onPress={() => onChange(star)}
              accessibilityLabel={`${star} étoile${star > 1 ? 's' : ''}`}
              accessibilityState={{ selected: filled }}
              hitSlop={6}
            >
              {icon}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Note moyenne compacte : ★ 4,6 (12). */
export function RatingSummary({ sum, count }: { sum: number; count: number }) {
  const theme = useTheme();

  if (count === 0) {
    return (
      <Text variant="caption" color="textMuted">
        Pas encore de note
      </Text>
    );
  }

  const average = (sum / count).toLocaleString('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Star size={theme.iconSize.sm} color={theme.colors.warning} weight="fill" />
      <Text variant="labelStrong" tabular>
        {average}
      </Text>
      <Text variant="caption" color="textMuted" tabular>
        ({count})
      </Text>
    </View>
  );
}
