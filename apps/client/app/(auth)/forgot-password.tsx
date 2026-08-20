import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { CheckCircle, Envelope } from 'phosphor-react-native';
import { isValidEmail, requestPasswordReset, toUserMessage } from '@istanbul/core';
import {
  Button,
  Header,
  IconBubble,
  Input,
  Screen,
  ScreenScroll,
  Spacer,
  Text,
  useTheme,
} from '@istanbul/ui';

export default function ForgotPassword() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!isValidEmail(email)) {
      setError('Cette adresse email est invalide.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await requestPasswordReset(email, 'istanbul://reset-password');
      setSent(true);
    } catch (caught) {
      setError(toUserMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <Screen edges={['top', 'left', 'right']}>
        <Header onBack={() => router.back()} />
        <ScreenScroll>
          <View style={{ alignItems: 'center', paddingTop: theme.spacing['4xl'] }}>
            <IconBubble size={88} tone="success" style={{ marginBottom: theme.spacing.xl }}>
              <CheckCircle size={44} color={theme.colors.success} weight="duotone" />
            </IconBubble>

            <Text variant="h1" align="center">
              Vérifiez votre boîte mail
            </Text>
            <Text
              variant="body"
              color="textSecondary"
              align="center"
              style={{ marginTop: theme.spacing.md, maxWidth: 320 }}
            >
              Si un compte existe pour {email}, vous recevrez un lien de réinitialisation dans
              quelques minutes.
            </Text>

            <Spacer size="2xl" />

            <Button
              label="Retour à la connexion"
              onPress={() => router.replace('/(auth)/sign-in')}
              variant="secondary"
            />
          </View>
        </ScreenScroll>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'left', 'right']}>
      <Header onBack={() => router.back()} />
      <ScreenScroll>
        <Text variant="display">Mot de passe oublié</Text>
        <Text variant="body" color="textSecondary" style={{ marginTop: theme.spacing.sm }}>
          Entrez votre adresse email, nous vous enverrons un lien pour en choisir un nouveau.
        </Text>

        <Spacer size="2xl" />

        <Input
          label="Email"
          placeholder="vous@exemple.cd"
          value={email}
          onChangeText={setEmail}
          error={error}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoFocus
          icon={<Envelope size={theme.iconSize.sm} color={theme.colors.textMuted} />}
        />

        <Spacer size="xl" />

        <Button
          label="Envoyer le lien"
          onPress={submit}
          loading={submitting}
          fullWidth
          size="lg"
        />
      </ScreenScroll>
    </Screen>
  );
}
