import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '@istanbul/core';
import { EmptyState, Header, ListSkeleton, Screen, useTheme } from '@istanbul/ui';

export interface AuthGateProps {
  /** Titre du header de l'écran gardé (« Mes commandes », « Favoris »…). */
  title: string;
  description: string;
  icon?: React.ReactNode;
}

/**
 * Écran « Connectez-vous » partagé.
 *
 * Deux subtilités que chaque copie locale oubliait :
 * 1. tant que la session se restaure (`isLoading`), on montre un squelette —
 *    jamais le CTA de connexion à un utilisateur en réalité déjà connecté ;
 * 2. le header garde le titre de l'écran, pour que l'utilisateur sache
 *    toujours où il est.
 *
 * Usage : `if (isLoading || !session) return <AuthGate title=… />;`
 */
export function AuthGate({ title, description, icon }: AuthGateProps) {
  const theme = useTheme();
  const { isLoading } = useSession();

  return (
    <Screen>
      <Header title={title} large />
      {isLoading ? (
        <View style={{ paddingHorizontal: theme.screenPadding }}>
          <ListSkeleton count={3} />
        </View>
      ) : (
        <EmptyState
          title="Connectez-vous"
          description={description}
          actionLabel="Se connecter"
          onAction={() => router.push('/(auth)/sign-in')}
          icon={icon}
        />
      )}
    </Screen>
  );
}
