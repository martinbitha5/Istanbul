import type { Metadata } from 'next';
import Link from 'next/link';
import { getStorefront } from '@/lib/storefront';
import { CheckoutView } from '@/components/store/CheckoutView';

export const metadata: Metadata = {
  title: 'Votre commande',
  description: 'Confirmez votre commande et faites-vous livrer.',
};

/**
 * Confirmation de commande — l'étape qui suit la connexion.
 *
 * Volontairement courte : coordonnées, adresse, paiement à la livraison. Le
 * paiement mobile (M-Pesa, Orange, Airtel) est un lot à part et n'est pas
 * proposé ici tant qu'il n'existe pas ; `fn_place_order` accepte déjà `CASH`,
 * qui est le mode réellement pratiqué à Kinshasa.
 */
export default async function CommandePage() {
  const storefront = await getStorefront();

  if (!storefront) {
    return (
      <main className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="max-w-md">
          <h1 className="ue-h1">Commande indisponible</h1>
          <Link href="/" className="ue-btn ue-btn-primary mt-6">
            Retour à l’accueil
          </Link>
        </div>
      </main>
    );
  }

  return (
    <CheckoutView restaurant={storefront.restaurant} zones={storefront.zones} />
  );
}
