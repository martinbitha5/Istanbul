import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { LockKey } from 'phosphor-react-native';
import { toUserMessage, updatePassword, useSession } from '@istanbul/core';
import {
  Button,
  Header,
  InlineAlert,
  Input,
  Screen,
  ScreenScroll,
  Spacer,
  Text,
  useTheme,
  useToast,
} from '@istanbul/ui';

/**
 * Nouveau mot de passe.
 *
 * Cible du deep link `istanbul://reset-password` envoyé par l'email de
 * réinitialisation : avant cet écran, le lien n'aboutissait nulle part et le
 * parcours « mot de passe oublié » était une impasse. Supabase ouvre une
 * session de récupération en suivant le lien — `updatePassword` s'appuie
 * dessus, et le serveur rejette la demande si elle a expiré.
 */
export default function ResetPassword() {
  const theme = useTheme();
  const toast = useToast();
  const { session } = useSession();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const next: typeof errors = {};
    // 8 caractères : le plancher de Supabase Auth — la règle serveur reste
    // l'autorité, inutile d'être plus strict ici.
    if (password.length < 8) next.password = 'Au moins 8 caractères.';
    if (confirm !== password) next.confirm = 'Les deux mots de passe ne correspondent pas.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await updatePassword(password);
      toast.success('Mot de passe mis à jour.');
      // Session de récupération active : on continue directement dans l'app ;
      // sinon, retour à la connexion avec le nouveau mot de passe.
      router.replace(session ? '/(tabs)' : '/(auth)/sign-in');
    } catch (caught) {
      setFormError(toUserMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      <Header onBack={router.canGoBack() ? () => router.back() : undefined} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScreenScroll>
          <Text variant="display">Nouveau mot de passe</Text>
          <Text variant="body" color="textSecondary" style={{ marginTop: theme.spacing.sm }}>
            Choisissez un nouveau mot de passe pour votre compte.
          </Text>

          <Spacer size="2xl" />

          <Input
            label="Nouveau mot de passe"
            placeholder="8 caractères minimum"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            isPassword
            autoComplete="new-password"
            textContentType="newPassword"
            autoFocus
            icon={<LockKey size={theme.iconSize.sm} color={theme.colors.textMuted} />}
          />

          <Spacer size="base" />

          <Input
            label="Confirmer le mot de passe"
            placeholder="••••••••"
            value={confirm}
            onChangeText={setConfirm}
            error={errors.confirm}
            isPassword
            autoComplete="new-password"
            textContentType="newPassword"
            onSubmitEditing={submit}
            returnKeyType="go"
            icon={<LockKey size={theme.iconSize.sm} color={theme.colors.textMuted} />}
          />

          {formError ? (
            <InlineAlert
              tone="danger"
              message={formError}
              style={{ marginTop: theme.spacing.base }}
            />
          ) : null}

          <Spacer size="xl" />

          <Button
            label="Enregistrer le mot de passe"
            onPress={submit}
            loading={submitting}
            fullWidth
            size="lg"
          />

          {!session ? (
            <Text
              variant="caption"
              color="textMuted"
              align="center"
              style={{ marginTop: theme.spacing.base }}
            >
              Ouvrez cet écran depuis le lien reçu par email pour que la
              réinitialisation soit acceptée.
            </Text>
          ) : null}
        </ScreenScroll>
      </KeyboardAvoidingView>
    </Screen>
  );
}
