'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { EffectiveRestaurantRole, ManagedRestaurant, UUID } from '@istanbul/types';
import { useMyRestaurants } from '@istanbul/core';

/**
 * Établissement courant du dashboard.
 *
 * C'est la pièce qui fait exister le multi-restaurants côté interface. Avant,
 * `useRestaurantId` lisait `profile.restaurant_id` et retombait sur un UUID en
 * dur : un gérant de deux établissements n'en voyait qu'un, et un ADMIN de la
 * plateforme voyait un restaurant qui n'existait peut-être pas.
 *
 * Le choix est mémorisé dans `localStorage` — pas dans l'URL. C'était tentant
 * (`?restaurant=…` est partageable), mais toutes les pages du dashboard
 * auraient dû propager le paramètre à chaque `<Link>`, et un lien partagé
 * entre deux gérants d'établissements différents aurait ouvert une page vide.
 */

export interface RestaurantAccess {
  /** Lire le tableau de bord, les commandes, les clients. */
  view: boolean;
  /** Menu, promotions, zones, livreurs, statuts de commande. */
  manage: boolean;
  /** Équipe et paramètres de l'établissement. */
  admin: boolean;
  /** Administration de la plateforme : tous les partenaires. */
  platform: boolean;
}

interface RestaurantContextValue {
  restaurantId: UUID;
  restaurant: ManagedRestaurant | null;
  restaurants: ManagedRestaurant[];
  role: EffectiveRestaurantRole | null;
  access: RestaurantAccess;
  selectRestaurant: (id: UUID) => void;
  isLoading: boolean;
  error: unknown;
}

const RestaurantContext = createContext<RestaurantContextValue | null>(null);

const STORAGE_KEY = 'istanbul.admin.restaurant';

function readStoredId(): UUID | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Navigation privée, quota, stockage bloqué : on retombe simplement sur
    // le premier établissement de la liste.
    return null;
  }
}

function writeStoredId(id: UUID) {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* Idem : perdre la préférence est sans conséquence. */
  }
}

export function RestaurantProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, error, refetch } = useMyRestaurants();
  const restaurants = useMemo(() => data ?? [], [data]);

  const [selectedId, setSelectedId] = useState<UUID | null>(null);

  // La restauration depuis localStorage se fait après montage : lire le
  // stockage pendant le rendu ferait diverger le HTML serveur et le client.
  useEffect(() => {
    if (restaurants.length === 0) return;

    setSelectedId((current) => {
      const stored = current ?? readStoredId();
      const isValid = stored && restaurants.some((restaurant) => restaurant.id === stored);
      // Un établissement retiré de l'équipe entre deux sessions ne doit pas
      // bloquer le dashboard sur un identifiant mort.
      return isValid ? stored : restaurants[0]!.id;
    });
  }, [restaurants]);

  const selectRestaurant = useCallback((id: UUID) => {
    setSelectedId(id);
    writeStoredId(id);
  }, []);

  const restaurant = restaurants.find((item) => item.id === selectedId) ?? null;
  const role = restaurant?.member_role ?? null;

  const access = useMemo<RestaurantAccess>(() => {
    const platform = role === 'PLATFORM';
    return {
      view: role !== null,
      manage: platform || role === 'OWNER' || role === 'MANAGER',
      admin: platform || role === 'OWNER',
      platform,
    };
  }, [role]);

  const value = useMemo<RestaurantContextValue>(
    () => ({
      restaurantId: restaurant?.id ?? '',
      restaurant,
      restaurants,
      role,
      access,
      selectRestaurant,
      isLoading,
      error,
    }),
    [restaurant, restaurants, role, access, selectRestaurant, isLoading, error],
  );

  return (
    <RestaurantContext.Provider value={value}>
      {isLoading ? (
        <BootScreen label="Chargement de vos établissements…" />
      ) : error ? (
        <BootScreen
          label="Impossible de charger vos établissements."
          hint="Vérifiez votre connexion, puis réessayez."
          action={{ label: 'Réessayer', onClick: () => void refetch() }}
        />
      ) : restaurants.length === 0 ? (
        <BootScreen
          label="Aucun établissement rattaché à ce compte"
          hint="Votre accès existe, mais personne ne vous a encore ajouté à une équipe. Demandez au propriétaire de l’établissement de vous inviter avec cette adresse e-mail."
        />
      ) : (
        children
      )}
    </RestaurantContext.Provider>
  );
}

/**
 * Écran d'attente plein cadre.
 *
 * Rendu avant la coquille du dashboard : afficher une sidebar dont aucun lien
 * ne mène nulle part serait pire que rien.
 */
function BootScreen({
  label,
  hint,
  action,
}: {
  label: string;
  hint?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="max-w-md text-center">
        <p
          className="text-2xl leading-none tracking-tight"
          style={{ fontFamily: 'var(--font-playfair)', color: 'var(--color-primary)' }}
        >
          Istanbul
        </p>
        <h1 className="mt-6 text-lg font-semibold" style={{ fontFamily: 'var(--font-sora)' }}>
          {label}
        </h1>
        {hint ? (
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">{hint}</p>
        ) : null}
        {action ? (
          <button
            onClick={action.onClick}
            className="mt-6 inline-flex h-11 cursor-pointer items-center rounded-full border px-5 text-sm font-semibold"
            style={{ borderColor: 'var(--color-border-strong)', color: 'var(--color-text)' }}
          >
            {action.label}
          </button>
        ) : null}
      </div>
    </main>
  );
}

export function useRestaurantContext(): RestaurantContextValue {
  const context = useContext(RestaurantContext);
  if (!context) {
    throw new Error('useRestaurantContext doit être utilisé sous <RestaurantProvider>.');
  }
  return context;
}

/** Droits de l'utilisateur sur l'établissement affiché. */
export function useRestaurantAccess(): RestaurantAccess {
  return useRestaurantContext().access;
}
