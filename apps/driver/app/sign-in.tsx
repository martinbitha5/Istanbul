import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { router } from 'expo-router';
import { Envelope, LockKey, Motorcycle } from 'phosphor-react-native';
import { isValidEmail, signInWithEmail, toUserMessage } from '@istanbul/core';
import {
  Button,
  Input,
  Screen,
  ScreenScroll,
  Spacer,
  Surface,
  Text,
  useTheme,
} from '@istanbul/ui';

/**
 * Connexion livreur.
 *
 * Email + mot de passe uniquement : les comptes livreurs sont créés par le
 * restaurant, pas en libre-service. Pas d'écran d'inscription ici, c'est
 * volontaire.
 */
export default function DriverSignIn() {
  const theme = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!isValidEmail(email)) {
      setError('Cette adresse email est invalide.');
      return;
    }
    if (!password) {
      setError('Entrez votre mot de passe.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await signInWithEmail(email, password);
      router.replace('/');
    } catch (caught) {
      setError(toUserMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScreenScroll>
          <View style={{ alignItems: 'center', paddingTop: theme.spacing['4xl'] }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: theme.colors.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Motorcycle size={40} color={theme.colors.primary} weight="fill" />
            </View>

            <Text variant="brandSmall" color="primary" style={{ marginTop: theme.spacing.base }}>
              Istanbul
            </Text>
            <Text variant="overline" uppercase color="textMuted">
              Espace livreur
            </Text>
          </View>

          <Spacer size="3xl" />

          <Input
            label="Email"
            placeholder="vous@istanbulfastfood.cd"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            icon={<Envelope size={theme.iconSize.sm} color={theme.colors.textMuted} />}
          />

          <Spacer size="base" />

          <Input
            label="Mot de passe"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            isPassword
            autoComplete="current-password"
            onSubmitEditing={submit}
            returnKeyType="go"
            icon={<LockKey size={theme.iconSize.sm} color={theme.colors.textMuted} />}
          />

          {error ? (
            <Surface
              padding="md"
              elevation={0}
              style={{ backgroundColor: theme.colors.dangerSoft, marginTop: theme.spacing.base }}
            >
              <Text variant="label" color="danger" accessibilityLiveRegion="polite">
                {error}
              </Text>
            </Surface>
          ) : null}

          <Spacer size="xl" />

          <Button label="Se connecter" onPress={submit} loading={submitting} fullWidth size="lg" />

          <Text
            variant="caption"
            color="textMuted"
            align="center"
            style={{ marginTop: theme.spacing.xl }}
          >
            Votre compte est créé par le restaurant. Contactez-le si vous n’avez pas encore vos
            identifiants.
          </Text>
        </ScreenScroll>
      </KeyboardAvoidingView>
    </Screen>
  );
}
