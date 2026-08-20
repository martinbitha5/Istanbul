'use client';

import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@istanbul/core';
import { getBrowserClient } from '@/lib/supabase/client';
import { ToastProvider, toastRef } from '@/components/Toaster';

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
