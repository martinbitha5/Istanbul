'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle, Circle, Rocket } from '@phosphor-icons/react';
import {
  toUserMessage,
  useAdminCategories,
  useAdminProducts,
  useAdminZones,
  useOpeningHours,
  useRestaurantDetail,
  useSaveRestaurant,
} from '@istanbul/core';
import { Button, Card } from '@/components/ui';
import { useToast } from '@/components/Toaster';
import { useRestaurantId } from '@/hooks/useRestaurantId';
import { useRestaurantAccess } from '@/providers/RestaurantProvider';

/**
 * Mise en route du restaurant.
 *
 * Sur une base fraîche, le dashboard s'ouvre sur une carte vide, sans zone de
 * livraison, et rien ne dit ce qui bloque. La bannière répond à la seule
 * question qui se pose alors — « qu'est-ce qu'il me reste à faire pour
 * recevoir des commandes ? » — et disparaît dès la publication.
 *
 * Elle ne s'affiche donc **jamais** pour un restaurant déjà en service : une
 * checklist permanente sur l'écran d'un gérant qui tourne depuis six mois est
 * du bruit, pas de l'aide. C'est l'appelant qui tranche (`is_published`), et
 * qui ne charge ce module qu'à ce moment : ses quatre requêtes ne partent pas
 * à chaque ouverture de la vue d'ensemble, et son code reste hors du bundle
 * initial.
 */

const MIN_PRODUCTS = 3;

export function OnboardingBanner() {
  const restaurantId = useRestaurantId();
  const access = useRestaurantAccess();

  const restaurant = useRestaurantDetail(restaurantId);
  const categories = useAdminCategories(restaurantId);
  const products = useAdminProducts(restaurantId);
  const zones = useAdminZones(restaurantId);
  const hours = useOpeningHours(restaurantId);

  const save = useSaveRestaurant();
  const toast = useToast();

  // Filet : l'appelant ne monte le composant que si `is_published` est faux,
  // mais la publication se fait depuis ce bouton — il faut disparaître ensuite.
  if (!restaurant.data || restaurant.data.is_published) return null;

  const activeProducts = (products.data ?? []).filter((product) => product.is_active);
  const activeZones = (zones.data ?? []).filter((zone) => zone.is_active);
  const openDays = (hours.data ?? []).filter((day) => !day.is_closed);

  const steps = [
    {
      done: (categories.data ?? []).length > 0,
      label: 'Créer au moins une catégorie',
      hint: 'Entrées, Sandwichs, Boissons… la carte s’organise avant de se remplir.',
      href: '/categories',
      cta: 'Ouvrir les catégories',
    },
    {
      done: activeProducts.length >= MIN_PRODUCTS,
      label: `Publier ${MIN_PRODUCTS} produits`,
      hint:
        activeProducts.length > 0
          ? `${activeProducts.length} produit${activeProducts.length > 1 ? 's' : ''} actif${activeProducts.length > 1 ? 's' : ''} pour l’instant.`
          : 'Une carte vide en vitrine fait fuir un client pour de bon.',
      href: '/menu',
      cta: 'Ouvrir le menu',
    },
    {
      done: activeZones.length > 0,
      label: 'Régler les zones de livraison',
      hint: 'Sans zone active, aucun frais ne peut être calculé et la commande est refusée.',
      href: '/zones',
      cta: 'Ouvrir les zones',
    },
    {
      done: openDays.length > 0,
      label: 'Confirmer les horaires',
      hint: 'Les horaires par défaut (10h–22h, 7j/7) sont rarement les bons.',
      href: '/settings',
      cta: 'Ouvrir l’établissement',
    },
  ];

  const done = steps.filter((step) => step.done).length;
  const ready = done === steps.length;
  const next = steps.find((step) => !step.done);

  const publish = () => {
    save.mutate(
      { restaurantId, patch: { is_published: true, is_accepting_orders: true } },
      {
        onSuccess: () => toast.success('Restaurant publié. Les clients peuvent commander.'),
        onError: (error) => toast.error(toUserMessage(error)),
      },
    );
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'var(--color-primary-soft)' }}
            aria-hidden
          >
            <Rocket size={20} style={{ color: 'var(--color-on-primary-soft)' }} />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
              Mise en route
            </h2>
            <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
              {ready
                ? 'Tout est prêt. Publiez pour apparaître dans l’app client.'
                : `${done} étape${done > 1 ? 's' : ''} sur ${steps.length} — le restaurant n’est pas encore visible des clients.`}
            </p>
          </div>
        </div>

        {access.admin ? (
          <Button onClick={publish} disabled={!ready} loading={save.isPending}>
            Publier le restaurant
          </Button>
        ) : null}
      </div>

      {/* Barre de progression : `role=progressbar` pour que la valeur soit
          annoncée, et un libellé texte au-dessus — la barre seule ne dit rien
          à qui ne la voit pas. */}
      <div
        className="mt-4 h-1.5 overflow-hidden rounded-full"
        style={{ background: 'var(--color-surface-sunken)' }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={done}
        aria-label={`Mise en route : ${done} étape sur ${steps.length}`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{
            width: `${(done / steps.length) * 100}%`,
            background: 'var(--color-primary)',
          }}
        />
      </div>

      <ol className="mt-4 space-y-2">
        {steps.map((step) => {
          const isNext = step === next;

          return (
            <li
              key={step.label}
              className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3"
              style={{
                borderColor: isNext ? 'var(--color-primary)' : 'var(--color-border)',
                background: step.done ? 'var(--color-surface-sunken)' : undefined,
              }}
            >
              {step.done ? (
                <CheckCircle
                  size={20}
                  weight="fill"
                  className="shrink-0"
                  style={{ color: 'var(--color-success)' }}
                  aria-hidden
                />
              ) : (
                <Circle
                  size={20}
                  className="shrink-0 text-[var(--color-text-muted)]"
                  aria-hidden
                />
              )}

              <div className="min-w-0 flex-1">
                <p
                  className="text-sm font-medium"
                  style={{
                    color: step.done ? 'var(--color-text-muted)' : 'var(--color-text)',
                    textDecoration: step.done ? 'line-through' : undefined,
                  }}
                >
                  {step.label}
                </p>
                {!step.done ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-text-muted)]">
                    {step.hint}
                  </p>
                ) : null}
              </div>

              {/* Un seul lien mis en avant : celui de l'étape suivante. Quatre
                  boutons de même poids ne hiérarchisent rien. */}
              {!step.done ? (
                <Link
                  href={step.href}
                  className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors duration-150"
                  style={{
                    background: isNext ? 'var(--color-primary)' : 'transparent',
                    color: isNext ? 'var(--color-text-on-primary)' : 'var(--color-primary)',
                  }}
                >
                  {step.cta}
                  <ArrowRight size={16} aria-hidden />
                </Link>
              ) : null}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
