'use client';

import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { configureCartStorage, createQueryClient } from '@istanbul/core';
import { setMapboxToken } from '@istanbul/map';
import { getBrowserClient } from '@/lib/supabase/client';
import { ToastProvider, toastRef } from '@/components/Toaster';

// Enregistré au chargement du module, avant tout rendu : `@istanbul/map` ne lit
// pas l'environnement lui-même (Next ne substitue `NEXT_PUBLIC_*` que dans le
// code de l'app, pas dans un package partagé). Vide = cartes OpenStreetMap.
setMapboxToken(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);

export function Providers({ children }: { children: React.ReactNode }) {
  // useState(initializer) : une seule instance par montage, créée de façon
  // synchrone — les enfants sont rendus immédiatement (l'ancien
  // `if (!ready) return null` affichait une page blanche avant hydratation).
  const [queryClient] = useState(() => {
    // Enregistre le client Supabase dans @istanbul/core avant que le moindre
    // hook partagé ne s'exécute. Uniquement côté navigateur : au rendu
    // serveur, aucune requête ne part de toute façon.
    if (typeof window !== 'undefined') {
      getBrowserClient();

      // Le panier de @istanbul/core est persistant, mais son stockage est
      // injecté par l'application : AsyncStorage sur mobile, localStorage
      // ici. Sans cet appel, il retomberait sur le stockage mémoire et le
      // panier serait vide à chaque rechargement — précisément ce que le
      // parcours « je remplis mon panier avant de me connecter » interdit.
      configureCartStorage(window.localStorage);
    }

    return createQueryClient({
      // Filet global : toute mutation qui échoue affiche un toast, même si la
      // page a oublié son propre try/catch. toastRef est alimenté par le
      // ToastProvider rendu plus bas.
      onMutationError: (message) => toastRef.current?.error(message),
    });
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
