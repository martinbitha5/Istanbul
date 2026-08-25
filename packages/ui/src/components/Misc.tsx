import React from 'react';
import { StyleSheet, TextInput, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { MagnifyingGlass, X } from 'phosphor-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Pressable } from './Pressable';
import { Text } from './Text';

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

export interface AvatarProps {
  uri?: string | null;
  /** Initiales affichées en secours. */
  fallback: string;
  size?: number;
  style?: ViewStyle;
}

export function Avatar({ uri, fallback, size = 44, style }: AvatarProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {uri ? (
        <Image
          source={uri}
          contentFit="cover"
          transition={180}
          cachePolicy="memory-disk"
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Photo de profil"
        />
      ) : (
        <Text
          variant="labelStrong"
          style={{ color: theme.colors.onPrimarySoft, fontSize: size * 0.36 }}
        >
          {fallback}
        </Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Barre de recherche
// ---------------------------------------------------------------------------

export interface SearchBarProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  autoFocus?: boolean;
  style?: ViewStyle;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Rechercher un plat…',
  onSubmit,
  autoFocus = false,
  style,
}: SearchBarProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.search,
        {
          // Pilule grise sans bordure : la forme qu'a la recherche partout
          // dans la référence, y compris dans la barre d'onglets flottante.
          // Garder les deux formes (rectangle ici, pilule là) donnerait deux
          // champs de recherche différents dans la même application.
          backgroundColor: theme.colors.surfaceSunken,
          borderRadius: theme.radius.pill,
          paddingHorizontal: theme.spacing.base,
        },
        style,
      ]}
    >
      <MagnifyingGlass size={theme.iconSize.sm} color={theme.colors.textMuted} weight="bold" />

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        autoFocus={autoFocus}
        autoCorrect={false}
        accessibilityLabel="Recherche"
        maxFontSizeMultiplier={1.3}
        style={[theme.text.body, styles.searchInput, { color: theme.colors.text }]}
      />

      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          hitSlop={12}
          noScale
          accessibilityLabel="Effacer la recherche"
        >
          <X size={theme.iconSize.xs} color={theme.colors.textMuted} weight="bold" />
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Ligne de réglage / d'information
// ---------------------------------------------------------------------------

export interface ListRowProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  style?: ViewStyle;
}

export function ListRow({
  title,
  subtitle,
  icon,
  right,
  onPress,
  destructive = false,
  style,
}: ListRowProps) {
  const theme = useTheme();

  const content = (
    <View style={[styles.row, { paddingVertical: theme.spacing.base }, style]}>
      {/* Icône posée nue, sans pastille : les listes de réglages de la
          référence alignent des icônes en trait fin sur un fond blanc. La
          pastille grise transformait chaque ligne en carte et faisait d'un
          menu de dix entrées un empilement de dix blocs. */}
      {icon ? <View style={{ width: 32, marginRight: theme.spacing.md }}>{icon}</View> : null}

      <View style={{ flex: 1 }}>
        <Text variant="body" color={destructive ? 'danger' : 'text'} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textSecondary" numberOfLines={2} style={{ marginTop: 1 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {right ? <View style={{ marginLeft: theme.spacing.sm }}>{right}</View> : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} noScale accessibilityLabel={title} style={{ minHeight: 44 }}>
      {content}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Code de confirmation
// ---------------------------------------------------------------------------

/**
 * Code à 4 chiffres, affiché au client dans son suivi et saisi par le livreur.
 * Chiffres largement espacés : il sera lu à voix haute dans la rue, parfois
 * sous la pluie.
 */
export function ConfirmationCode({ code, label }: { code: string; label?: string }) {
  const theme = useTheme();

  return (
    <View style={{ alignItems: 'center' }}>
      {label ? (
        <Text variant="label" color="textSecondary" style={{ marginBottom: theme.spacing.sm }}>
          {label}
        </Text>
      ) : null}

      <View style={styles.codeRow}>
        {code.split('').map((digit, index) => (
          <View
            key={index}
            style={[
              styles.codeCell,
              {
                backgroundColor: theme.colors.primarySoft,
                borderRadius: theme.radius.md,
                marginHorizontal: theme.spacing.xs,
              },
            ]}
          >
            <Text variant="display" tabular style={{ color: theme.colors.onPrimarySoft }}>
              {digit}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', height: 48 },
  searchInput: { flex: 1, marginLeft: 10, paddingVertical: 0 },
  row: { flexDirection: 'row', alignItems: 'center' },
  codeRow: { flexDirection: 'row' },
  codeCell: { width: 54, height: 66, alignItems: 'center', justifyContent: 'center' },
});
