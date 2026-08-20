import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Envelope, LockKey, Phone, User } from 'phosphor-react-native';
import { isValidEmail, isValidPhone, signUpWithEmail, toUserMessage } from '@istanbul/core';
import {
  Button,
  Header,
  InlineAlert,
  Input,
  Pressable,
  Screen,
  ScreenScroll,
  Spacer,
  Text,
  useTheme,
} from '@istanbul/ui';

export default function SignUp() {
  const theme = useTheme();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();

  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const validate = () => {
    const next: Record<string, string | undefined> = {};

    if (form.fullName.trim().length < 2) next.fullName = 'Entrez votre nom complet.';
    if (!isValidEmail(form.email)) next.email = 'Cette adresse email est invalide.';
    if (form.phone && !isValidPhone(form.phone)) {
      next.phone = 'Format attendu : 0999 000 105.';
    }
    // 8 caractères : le plancher de Supabase Auth. Inutile d'être plus strict
    // ici, la règle serveur reste l'autorité.
    if (form.password.length < 8) {
      next.password = 'Le mot de passe doit contenir au moins 8 caractères.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;

    setSubmitting(true);
    setErrors({});
    try {
      await signUpWithEmail({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        phone: form.phone || undefined,
      });
      router.replace((redirect as never) ?? '/(tabs)');
    } catch (error) {
      setErrors({ form: toUserMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      <Header onBack={() => router.back()} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScreenScroll>
          <Text variant="display">Créer un compte</Text>
          <Text variant="body" color="textSecondary" style={{ marginTop: theme.spacing.sm }}>
            Quelques secondes suffisent. Vous pourrez commander tout de suite.
          </Text>

          <Spacer size="2xl" />

          <Input
            label="Nom complet"
            placeholder="Martin Bitha"
            value={form.fullName}
            onChangeText={set('fullName')}
            error={errors.fullName}
            required
            autoComplete="name"
            textContentType="name"
            icon={<User size={theme.iconSize.sm} color={theme.colors.textMuted} />}
          />

          <Spacer size="base" />

          <Input
            label="Email"
            placeholder="vous@exemple.cd"
            value={form.email}
            onChangeText={set('email')}
            error={errors.email}
            required
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            icon={<Envelope size={theme.iconSize.sm} color={theme.colors.textMuted} />}
          />

          <Spacer size="base" />

          <Input
            label="Téléphone"
            placeholder="0999 000 105"
            value={form.phone}
            onChangeText={set('phone')}
            error={errors.phone}
            helper="Le livreur vous appellera sur ce numéro."
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            icon={<Phone size={theme.iconSize.sm} color={theme.colors.textMuted} />}
          />

          <Spacer size="base" />

          <Input
            label="Mot de passe"
            placeholder="8 caractères minimum"
            value={form.password}
            onChangeText={set('password')}
            error={errors.password}
            required
            isPassword
            autoComplete="new-password"
            textContentType="newPassword"
            icon={<LockKey size={theme.iconSize.sm} color={theme.colors.textMuted} />}
          />

          {errors.form ? (
            <InlineAlert
              tone="danger"
              message={errors.form}
              style={{ marginTop: theme.spacing.base }}
            />
          ) : null}

          <Spacer size="xl" />

          <Button label="Créer mon compte" onPress={submit} loading={submitting} fullWidth size="lg" />

          <Text
            variant="caption"
            color="textMuted"
            align="center"
            style={{ marginTop: theme.spacing.base }}
          >
            En créant un compte, vous acceptez nos conditions d’utilisation.
          </Text>

          <Spacer size="xl" />

          <View style={styles.footerRow}>
            <Text variant="body" color="textSecondary">
              Déjà inscrit ?{' '}
            </Text>
            <Link href="/(auth)/sign-in" asChild>
              <Pressable hitSlop={8} noScale>
                <Text variant="bodyStrong" color="primary">
                  Se connecter
                </Text>
              </Pressable>
            </Link>
          </View>
        </ScreenScroll>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
