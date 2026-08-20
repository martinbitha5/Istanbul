'use client';

import { useEffect, useState } from 'react';

/**
 * Valeur retardée : ne se met à jour qu'après `delay` ms sans changement.
 *
 * Utilisé pour la recherche de commandes : la clé de requête inclut la
 * chaîne, donc sans debounce chaque frappe déclenchait une requête Supabase.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
