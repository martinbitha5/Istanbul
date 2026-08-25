import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Phone as PhoneIcon } from 'phosphor-react-native';
import {
  formatPhone,
  isValidPhone,
  requestPhoneOtp,
  toUserMessage,
  verifyPhoneOtp,
} from '@istanbul/core';
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
 * Connexion par téléphone.
 *
 * Voie principale à Kinshasa : beaucoup de clients n'ont pas d'email actif,
 * mais tout le monde a un numéro. Deux étapes dans un seul écran plutôt que
 * deux routes — le retour arrière du système reste ainsi prévisible.
 */
export default function PhoneAuth() {
  const theme = useTheme();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Décompte avant de pouvoir redemander un code : sans lui, l'utilisateur
  // martèle le bouton et se fait limiter par le fournisseur SMS.
  useEffect(() => {
    if (cooldown <= 0) return;
    timer.current = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [cooldown]);

  const sendCode = async () => {
    if (!isValidPhone(phone)) {
      setError('Numéro invalide. Format attendu : 0999 000 105.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await requestPhoneOtp(phone);
      setStep('code');
      setCooldown(45);
    } catch (caught) {
      setError(toUserMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  const verify = async () => {
    if (code.trim().length < 6) {
      setError('Entrez les 6 chiffres reçus par SMS.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await verifyPhoneOtp(phone, code);
      router.replace((redirect as never) ?? '/(tabs)');
    } catch (caught) {
      setError(toUserMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      <Header onBack={() => (step === 'code' ? setStep('phone') : router.back())} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScreenScroll>
          {step === 'phone' ? (
            <>
              <Text variant="display">Votre numéro</Text>
              <Text variant="body" color="textSecondary" style={{ marginTop: theme.spacing.sm }}>
                Nous vous enverrons un code à 6 chiffres pour vous identifier.
              </Text>

              <Spacer size="2xl" />

              <Input
                label="Numéro de téléphone"
                placeholder="0999 000 105"
                value={phone}
                onChangeText={setPhone}
                error={error}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                autoFocus
                icon={<PhoneIcon size={theme.iconSize.sm} color={theme.colors.textMuted} />}
              />

              <Spacer size="xl" />

              <Button
                label="Recevoir le code"
                onPress={sendCode}
                loading={submitting}
                fullWidth
                size="lg"
              />
            </>
          ) : (
            <>
              <Text variant="display">Code de vérification</Text>
              <Text variant="body" color="textSecondary" style={{ marginTop: theme.spacing.sm }}>
                Envoyé au {formatPhone(phone)}.
              </Text>

              <Spacer size="2xl" />

              <Input
                label="Code à 6 chiffres"
                placeholder="000000"
                value={code}
                onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                error={error}
                keyboardType="number-pad"
                autoComplete="sms-otp"
                textContentType="oneTimeCode"
                maxLength={6}
                autoFocus
              />

              <Spacer size="xl" />

              <Button label="Vérifier" onPress={verify} loading={submitting} fullWidth size="lg" />

              <View style={{ alignItems: 'center', marginTop: theme.spacing.lg }}>
                {cooldown > 0 ? (
                  <Text variant="label" color="textMuted" tabular>
                    Nouveau code dans {cooldown} s
                  </Text>
                ) : (
                  <Pressable onPress={sendCode} hitSlop={10} noScale>
                    <Text variant="labelStrong" color="primary" style={{ textDecorationLine: 'underline' }}>
                      Renvoyer le code
                    </Text>
                  </Pressable>
                )}
              </View>
            </>
          )}
        </ScreenScroll>
      </KeyboardAvoidingView>
    </Screen>
  );
}
