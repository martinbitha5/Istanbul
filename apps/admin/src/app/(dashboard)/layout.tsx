import { redirect } from 'next/navigation';
import { getDashboardBootstrap } from '@/lib/supabase/server';
import { Shell } from '@/components/Shell';
import { RestaurantProvider } from '@/providers/RestaurantProvider';

/**
 * Garde d'accès et amorçage du dashboard.
 *
 * Le contrôle réel est côté RLS : même si quelqu'un contournait cette
 * redirection, ses requêtes ne renverraient rien. Cette vérification sert à
 * afficher un message clair plutôt qu'un dashboard vide.
 *
 * Une seule requête ici (`fn_dashboard_bootstrap`) : identité, établissement
 * et rôle arrivent ensemble, et le provider les passe au reste de l'arbre sans
 * qu'aucun écran d'attente ne s'intercale.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, restaurant, role, isAdmin } = await getDashboardBootstrap();

  if (!profile) redirect('/login');

  const allowed = ['RESTAURANT_STAFF', 'ADMIN', 'SUPER_ADMIN'];
  if (!allowed.includes(profile.role)) {
    return (
      <Notice title="Accès refusé">
        Ce compte n’a pas les droits nécessaires pour accéder au dashboard. Contactez
        l’administrateur du restaurant.
      </Notice>
    );
  }

  // Base vierge : les migrations sont passées mais le seed non. Mieux vaut le
  // dire que de laisser chaque écran échouer sur un identifiant vide.
  if (!restaurant) {
    return (
      <Notice title="Aucun établissement en base">
        La table <code>restaurants</code> est vide. Chargez les données initiales
        (<code>supabase db reset</code>) avant d’ouvrir le dashboard.
      </Notice>
    );
  }

  return (
    <RestaurantProvider bootstrap={{ profile, restaurant, role, isAdmin }}>
      <Shell>{children}</Shell>
    </RestaurantProvider>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
          {title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
          {children}
        </p>
      </div>
    </main>
  );
}
