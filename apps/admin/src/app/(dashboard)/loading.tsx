import { Skeleton } from '@/components/ui';

/**
 * Squelette d'app shell affiché pendant le chargement d'une page du
 * dashboard : mieux qu'un écran figé sur un réseau mobile lent.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Chargement de la page">
      {/* Titre + action */}
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-11 w-40 rounded-full" />
      </div>

      {/* Filtres */}
      <div className="flex gap-2">
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>

      {/* Tableau */}
      <div className="space-y-3 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
