'use client';

import { useEffect, useMemo, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@istanbul/core';
import { getBrowserClient } from '@/lib/supabase/client';

export function Providers({ children }: { children: React.ReactNode }) {
  // Une seule instance par montage : recréer le client à chaque rendu viderait
  // le cache et relancerait toutes les requêtes.
  const queryClient = useMemo(() => createQueryClient(), []);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Enregistre le client Supabase dans @istanbul/core avant que le moindre
    // hook partagé ne s'exécute.
    getBrowserClient();
    setReady(true);
  }, []);

  if (!ready) return null;

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
