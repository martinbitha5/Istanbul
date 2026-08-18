import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { Crosshair, MapPin, Plus, Trash } from 'phosphor-react-native';
import {
  toUserMessage,
  useAddresses,
  useCartStore,
  useDeleteAddress,
  useSaveAddress,
} from '@istanbul/core';
import type { Address } from '@istanbul/types';
import {
  Badge,
  BottomBar,
  Button,
  Divider,
  EmptyState,
  ErrorState,
  Header,
  Input,
  ListSkeleton,
  Pressable,
  Screen,
  ScreenScroll,
  Spacer,
  Surface,
  Text,
  useTheme,
} from '@istanbul/ui';

const COMMUNES = [
  'Gombe',
  'Ngaliema',
  'Delvaux',
  'Bandalungwa',
  'Kintambo',
  'Lingwala',
  'Barumbu',
  'Kinshasa',
  'Limete',
  'Matete',
  'Lemba',
  'Ngaba',
  'Kalamu',
  'Kasa-Vubu',
  'Selembao',
  'Bumbu',
  'Makala',
  'Masina',
  'Ndjili',
  'Kimbanseke',
];

/**
 * Carnet d'adresses.
 *
 * Les coordonnées GPS ne sont pas obligatoires pour enregistrer une adresse,
 * mais sans elles le devis de livraison retombe sur la zone la moins chère —
 * on incite donc fortement à utiliser la position actuelle.
 */
export default function Addresses() {
  const theme = useTheme();
  const { data: addresses, isLoading, isError, refetch } = useAddresses();
  const saveAddress = useSaveAddress();
  const deleteAddress = useDeleteAddress();
  const setAddressId = useCartStore((state) => state.setAddressId);

  const [editing, setEditing] = useState<Partial<Address> | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useCurrentLocation = async () => {
    setLocating(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError(
          'Autorisation refusée. Vous pouvez saisir l’adresse manuellement, mais les frais de ' +
            'livraison seront estimés au minimum.',
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setEditing((current) => ({
        ...current,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }));
    } catch (caught) {
      setError(toUserMessage(caught));
    } finally {
      setLocating(false);
    }
  };

  const submit = async () => {
    if (!editing?.street?.trim()) {
      setError('Indiquez au moins la rue et le numéro.');
      return;
    }

    setError(null);
    try {
      const saved = await saveAddress.mutateAsync({
        id: editing.id,
        label: editing.label?.trim() || 'Domicile',
        recipient_name: editing.recipient_name ?? null,
        phone: editing.phone ?? null,
        commune: editing.commune ?? null,
        street: editing.street.trim(),
        details: editing.details ?? null,
        delivery_notes: editing.delivery_notes ?? null,
        latitude: editing.latitude ?? null,
        longitude: editing.longitude ?? null,
        is_default: editing.is_default ?? (addresses?.length ?? 0) === 0,
      });

      setAddressId(saved.id);
      setEditing(null);
    } catch (caught) {
      setError(toUserMessage(caught));
    }
  };

  const confirmDelete = (address: Address) => {
    Alert.alert('Supprimer cette adresse ?', `${address.label} — ${address.street}`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => deleteAddress.mutate(address.id),
      },
    ]);
  };

  // --- Formulaire ----------------------------------------------------------
  if (editing) {
    return (
      <Screen edges={['top', 'left', 'right']}>
        <Header
          title={editing.id ? 'Modifier l’adresse' : 'Nouvelle adresse'}
          onBack={() => setEditing(null)}
        />

        <ScreenScroll bottomInset={100}>
          <Input
            label="Nom de l’adresse"
            placeholder="Domicile, Bureau…"
            value={editing.label ?? ''}
            onChangeText={(value) => setEditing({ ...editing, label: value })}
          />

          <Spacer size="base" />

          <Text variant="label" color="textSecondary">
            Commune
          </Text>
          <View style={[styles.communeGrid, { marginTop: theme.spacing.sm }]}>
            {COMMUNES.map((commune) => {
              const active = editing.commune === commune;
              return (
                <Pressable
                  key={commune}
                  onPress={() => setEditing({ ...editing, commune })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.communeChip,
                    {
                      borderRadius: theme.radius.pill,
                      backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                      borderWidth: theme.borderWidth.hairline,
                      borderColor: active ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    variant="label"
                    style={{ color: active ? theme.colors.textOnPrimary : theme.colors.textSecondary }}
                  >
                    {commune}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Spacer size="base" />

          <Input
            label="Rue et numéro"
            placeholder="Avenue Kasa-Vubu n°128"
            value={editing.street ?? ''}
            onChangeText={(value) => setEditing({ ...editing, street: value })}
            required
          />

          <Spacer size="base" />

          <Input
            label="Repère"
            placeholder="Maison bleue, portail noir"
            value={editing.details ?? ''}
            onChangeText={(value) => setEditing({ ...editing, details: value })}
            helper="Un repère visible aide le livreur à vous trouver vite."
          />

          <Spacer size="base" />

          <Input
            label="Instructions pour le livreur"
            placeholder="Klaxonner à l’arrivée"
            value={editing.delivery_notes ?? ''}
            onChangeText={(value) => setEditing({ ...editing, delivery_notes: value })}
          />

          <Spacer size="lg" />

          <Surface padding="base" elevation={1}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">Position GPS</Text>
                <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
                  {editing.latitude
                    ? 'Position enregistrée — frais de livraison exacts.'
                    : 'Sans position, les frais sont estimés au minimum.'}
                </Text>
              </View>

              {editing.latitude ? (
                <Badge label="Enregistrée" tone="success" size="sm" />
              ) : null}
            </View>

            <Spacer size="md" />

            <Button
              label={editing.latitude ? 'Actualiser ma position' : 'Utiliser ma position'}
              variant="secondary"
              icon={<Crosshair size={theme.iconSize.sm} color={theme.colors.text} />}
              onPress={useCurrentLocation}
              loading={locating}
              fullWidth
            />
          </Surface>

          {error ? (
            <Surface
              padding="md"
              elevation={0}
              style={{ backgroundColor: theme.colors.dangerSoft, marginTop: theme.spacing.base }}
            >
              <Text variant="label" color="danger">
                {error}
              </Text>
            </Surface>
          ) : null}
        </ScreenScroll>

        <BottomBar>
          <Button
            label="Enregistrer"
            onPress={submit}
            loading={saveAddress.isPending}
            fullWidth
            size="lg"
          />
        </BottomBar>
      </Screen>
    );
  }

  // --- Liste ---------------------------------------------------------------
  return (
    <Screen edges={['top', 'left', 'right']}>
      <Header title="Mes adresses" onBack={() => router.back()} />

      {isLoading ? (
        <View style={{ paddingHorizontal: theme.screenPadding }}>
          <ListSkeleton count={2} />
        </View>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (addresses?.length ?? 0) === 0 ? (
        <EmptyState
          title="Aucune adresse enregistrée"
          description="Ajoutez votre adresse pour être livré en quelques minutes."
          actionLabel="Ajouter une adresse"
          onAction={() => setEditing({})}
          icon={<MapPin size={32} color={theme.colors.textMuted} weight="duotone" />}
        />
      ) : (
        <ScreenScroll bottomInset={90}>
          <Surface padding="base" elevation={1}>
            {addresses!.map((address, index) => (
              <View key={address.id}>
                {index > 0 ? <Divider spacing="md" /> : null}

                <Pressable
                  onPress={() => {
                    setAddressId(address.id);
                    router.back();
                  }}
                  noScale
                  accessibilityLabel={`Choisir l’adresse ${address.label}`}
                >
                  <View style={styles.addressRow}>
                    <MapPin
                      size={theme.iconSize.sm}
                      color={address.is_default ? theme.colors.primary : theme.colors.textMuted}
                      weight={address.is_default ? 'fill' : 'regular'}
                    />

                    <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                      <View style={styles.labelRow}>
                        <Text variant="bodyStrong">{address.label}</Text>
                        {address.is_default ? (
                          <Badge label="Par défaut" tone="info" size="sm" style={{ marginLeft: 8 }} />
                        ) : null}
                      </View>

                      <Text variant="bodySmall" color="textSecondary" style={{ marginTop: 2 }}>
                        {address.street}
                        {address.commune ? `, ${address.commune}` : ''}
                      </Text>

                      {address.details ? (
                        <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>
                          {address.details}
                        </Text>
                      ) : null}

                      <View style={[styles.actions, { marginTop: theme.spacing.sm }]}>
                        <Button
                          label="Modifier"
                          variant="ghost"
                          size="sm"
                          onPress={() => setEditing(address)}
                        />
                        <Button
                          label="Supprimer"
                          variant="ghost"
                          size="sm"
                          icon={<Trash size={14} color={theme.colors.danger} />}
                          onPress={() => confirmDelete(address)}
                        />
                      </View>
                    </View>
                  </View>
                </Pressable>
              </View>
            ))}
          </Surface>
        </ScreenScroll>
      )}

      {(addresses?.length ?? 0) > 0 ? (
        <BottomBar>
          <Button
            label="Ajouter une adresse"
            icon={<Plus size={theme.iconSize.sm} color={theme.colors.textOnPrimary} weight="bold" />}
            onPress={() => setEditing({})}
            fullWidth
            size="lg"
          />
        </BottomBar>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start' },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  actions: { flexDirection: 'row', marginLeft: -16 },
  communeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  communeChip: { paddingHorizontal: 14, height: 36, alignItems: 'center', justifyContent: 'center' },
});
