import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Eye, EyeSlash, WarningCircle } from 'phosphor-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Pressable } from './Pressable';
import { Text } from './Text';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string | null;
  helper?: string;
  required?: boolean;
  icon?: React.ReactNode;
  /** Affiche l'œil de révélation du mot de passe. */
  isPassword?: boolean;
  containerStyle?: ViewStyle;
}

/**
 * Champ de saisie.
 *
 * Le label est toujours visible : un placeholder qui disparaît à la frappe
 * laisse l'utilisateur sans repère dans un formulaire long. L'erreur s'affiche
 * sous le champ concerné, pas en haut de l'écran.
 *
 * Le champ est un aplat gris sans bordure au repos — la forme qu'ont tous les
 * champs de la référence, du numéro de téléphone à la barre de recherche. La
 * bordure n'apparaît qu'au focus et sur erreur, là où elle porte une
 * information ; posée en permanence, elle ajouterait un trait à chaque ligne
 * d'un formulaire qui n'en a pas besoin.
 */
export function Input({
  label,
  error,
  helper,
  required = false,
  icon,
  isPassword = false,
  containerStyle,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const outlined = Boolean(focused || error);
  const borderColor = error ? theme.colors.danger : theme.colors.primary;

  return (
    <View style={containerStyle}>
      <View style={styles.labelRow}>
        <Text variant="label" color="textSecondary">
          {label}
        </Text>
        {required ? (
          <Text variant="label" color="danger" style={{ marginLeft: 2 }}>
            *
          </Text>
        ) : null}
      </View>

      <View
        style={[
          styles.field,
          {
            backgroundColor: theme.colors.surfaceSunken,
            borderColor: outlined ? borderColor : 'transparent',
            borderWidth: theme.borderWidth.thick,
            borderRadius: theme.radius.md,
            paddingHorizontal: theme.spacing.base,
            marginTop: theme.spacing.xs + 2,
          },
        ]}
      >
        {icon ? <View style={{ marginRight: theme.spacing.sm }}>{icon}</View> : null}

        <TextInput
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry={isPassword && !revealed}
          accessibilityLabel={label}
          maxFontSizeMultiplier={1.3}
          style={[
            theme.text.body,
            styles.input,
            { color: theme.colors.text },
          ]}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...rest}
        />

        {isPassword ? (
          <Pressable
            onPress={() => setRevealed((value) => !value)}
            hitSlop={12}
            noScale
            accessibilityLabel={revealed ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            style={{ paddingLeft: theme.spacing.sm }}
          >
            {revealed ? (
              <EyeSlash size={theme.iconSize.sm} color={theme.colors.textMuted} />
            ) : (
              <Eye size={theme.iconSize.sm} color={theme.colors.textMuted} />
            )}
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <View
          accessibilityLiveRegion="polite"
          style={[styles.messageRow, { marginTop: theme.spacing.xs + 2 }]}
        >
          <WarningCircle size={14} color={theme.colors.danger} weight="fill" />
          <Text variant="caption" color="danger" style={{ marginLeft: 4, flex: 1 }}>
            {error}
          </Text>
        </View>
      ) : helper ? (
        <Text variant="caption" color="textMuted" style={{ marginTop: theme.spacing.xs + 2 }}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    // 52 pt : au-dessus du plancher tactile de 44, confortable au pouce.
    minHeight: 52,
  },
  input: { flex: 1, paddingVertical: 14 },
  messageRow: { flexDirection: 'row', alignItems: 'center' },
});
