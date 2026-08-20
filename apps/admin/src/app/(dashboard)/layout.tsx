import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/supabase/server';
import { Shell } from '@/components/Shell';
import { RestaurantProvider } from '@/providers/RestaurantProvider';

/**
 * Garde d'accès du dashboard.
 *
 * Le contrôle réel est côté RLS : même si quelqu'un contournait cette
 * redirection, ses requêtes ne renverraient rien. Cette vérification sert à
 * afficher un message clair plutôt qu'un dashboard vide.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile) redirect('/login');

  const allowed = ['RESTAURANT_STAFF', 'ADMIN', 'SUPER_ADMIN'];
  if (!allowed.includes(profile.role)) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6 text-center">
        <div className="max-w-md">
          <h1 className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-sora)' }}>
            Accès refusé
          </h1>
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            Ce compte n’a pas les droits nécessaires pour accéder au dashboard. Contactez
            l’administrateur du restaurant.
          </p>
        </div>
      </main>
    );
  }

  // Le provider tranche *quel* établissement on administre avant que la
  // moindre page ne se monte : sans lui, chaque écran partirait interroger
  // Supabase avec un identifiant vide.
  return (
    <RestaurantProvider>
      <Shell>{children}</Shell>
    </RestaurantProvider>
  );
}
