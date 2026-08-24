'use client';

import { useSyncExternalStore } from 'react';

/**
 * Préférences de livraison du visiteur : adresse, créneau, mode.
 *
 * Elles vivent **avant** le compte. Le client saisit son adresse sur
 * l'accueil, elle est retenue, et il peut parcourir la carte et remplir son
 * panier sans jamais s'être connecté — la connexion n'arrive qu'au moment de
 * commander. C'est le parcours d'Uber Eats, et c'est celui demandé ici.
 *
 * Petit magasin maison plutôt qu'un contexte React : l'entête, le feed, la
 * modale de livraison et le panier lisent tous la même adresse, à des endroits
 * très différents de l'arbre. Un contexte imposerait d'envelopper la vitrine
 * dans un composant client et de faire redescendre l'état ; `useSyncExternalStore`
 * donne le même partage sans toucher à la structure des pages, et sans
 * ajouter de dépendance.
 */

export interface DeliveryPrefs {
  address: string | null;
  /** `null` = « livrer maintenant ». Sinon un libellé de créneau déjà formaté. */
  slot: string | null;
  mode: 'delivery' | 'pickup';
}

const STORAGE_KEY = 'istanbul.store.delivery';

const EMPTY: DeliveryPrefs = { address: null, slot: null, mode: 'delivery' };

/**
 * Instantané serveur — et instantané initial du client.
 *
 * Il **doit** être la même référence à chaque appel : `useSyncExternalStore`
 * compare par identité, et un objet neuf à chaque rendu boucle à l'infini.
 */
let snapshot: DeliveryPrefs = EMPTY;
let hydrated = false;

const listeners = new Set<() => void>();

function readStorage(): DeliveryPrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;

    const parsed = JSON.parse(raw) as Partial<DeliveryPrefs>;
    return {
      address: typeof parsed.address === 'string' ? parsed.address : null,
      slot: typeof parsed.slot === 'string' ? parsed.slot : null,
      mode: parsed.mode === 'pickup' ? 'pickup' : 'delivery',
    };
  } catch {
    // Navigation privée, JSON corrompu : on repart d'une adresse vide plutôt
    // que de faire échouer le rendu de la vitrine.
    return EMPTY;
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/**
 * Lecture paresseuse : le premier `getSnapshot` côté navigateur relit le
 * stockage. Le faire à l'import casserait le rendu serveur, et le faire dans
 * un `useEffect` provoquerait un flash « aucune adresse » à chaque chargement.
 */
function getSnapshot(): DeliveryPrefs {
  if (!hydrated && typeof window !== 'undefined') {
    hydrated = true;
    const stored = readStorage();
    if (stored !== EMPTY) snapshot = stored;
  }
  return snapshot;
}

function getServerSnapshot(): DeliveryPrefs {
  return EMPTY;
}

export function setDeliveryPrefs(patch: Partial<DeliveryPrefs>): void {
  const next = { ...getSnapshot(), ...patch };
  if (
    next.address === snapshot.address &&
    next.slot === snapshot.slot &&
    next.mode === snapshot.mode
  ) {
    return;
  }

  snapshot = next;
  hydrated = true;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // L'adresse reste en mémoire pour la session en cours : la vitrine
    // fonctionne, elle sera simplement redemandée au prochain chargement.
  }

  emit();
}

export function useDeliveryPrefs(): DeliveryPrefs {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
