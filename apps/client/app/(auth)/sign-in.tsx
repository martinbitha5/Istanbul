import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Envelope, LockKey } from 'phosphor-react-native';
import { isValidEmail, signInWithEmail, toUserMessage } from '@istanbul/core';
import {
  Button,
  Header,
  Input,
  Pressable,
  Screen,
  ScreenScroll,
  Spacer,
  Text,
  useTheme,
} from '@istanbul/ui';

/**
 * Connexion par email.
 *
 * `redirect` permet de revenir exactement là où l'utilisateur a été
 * interrompu — typiquement le checkout, où l'on demande enfin le compte.
 */
export default function SignIn() {
  const theme = useTheme();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const next: typeof errors = {};
    if (!email.trim()) next.email = 'Entrez votre adresse email.';
    else if (!isValidEmail(email)) next.email = 'Cette adresse email est invalide.';
    if (!password) next.password = 'Entrez votre mot de passe.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;

    setSubmitting(true);
    setErrors({});
    try {
      await signInWithEmail(email, password);
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
          <Text variant="brandSmall" color="primary">
            Istanbul
          </Text>
          <Text variant="display" style={{ marginTop: theme.spacing.sm }}>
            Content de vous revoir
          </Text>
          <Text variant="body" color="textSecondary" style={{ marginTop: theme.spacing.sm }}>
            Connectez-vous pour retrouver vos adresses et votre historique.
          </Text>

          <Spacer size="2xl" />

          <Input
            label="Email"
            placeholder="vous@exemple.cd"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            icon={<Envelope size={theme.iconSize.sm} color={theme.colors.textMuted} />}
          />

          <Spacer size="base" />

          <Input
            label="Mot de passe"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            isPassword
            autoComplete="current-password"
            textContentType="password"
            onSubmitEditing={submit}
            returnKeyType="go"
            icon={<LockKey size={theme.iconSize.sm} color={theme.colors.textMuted} />}
          />

          <View style={styles.forgotRow}>
            <Link href="/(auth)/forgot-password" asChild>
              <Pressable hitSlop={10} noScale>
                <Text variant="label" color="primary">
                  Mot de passe oublié ?
                </Text>
              </Pressable>
            </Link>
          </View>

          {errors.form ? (
            <View
              accessibilityLiveRegion="polite"
              style={[
                styles.formError,
                {
                  backgroundColor: theme.colors.dangerSoft,
                  borderRadius: theme.radius.md,
                  padding: theme.spacing.md,
                  marginTop: theme.spacing.base,
                },
              ]}
            >
              <Text variant="label" color="danger">
                {errors.form}
              </Text>
            </View>
          ) : null}

          <Spacer size="xl" />

          <Button
            label="Se connecter"
            onPress={submit}
            loading={submitting}
            fullWidth
            size="lg"
          />

          <Spacer size="lg" />

          <Button
            label="Continuer avec mon numéro"
            onPress={() => router.push('/(auth)/phone')}
            variant="secondary"
            fullWidth
            size="lg"
          />

          <Spacer size="2xl" />

          <View style={styles.footerRow}>
            <Text variant="body" color="textSecondary">
              Pas encore de compte ?{' '}
            </Text>
            <Link href="/(auth)/sign-up" asChild>
              <Pressable hitSlop={8} noScale>
                <Text variant="bodyStrong" color="primary">
                  Créer un compte
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
  forgotRow: { alignItems: 'flex-end', marginTop: 12 },
  formError: {},
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
