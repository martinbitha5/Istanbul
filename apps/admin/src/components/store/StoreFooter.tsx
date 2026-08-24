import Link from 'next/link';
import { AppleLogo, FacebookLogo, GooglePlayLogo, InstagramLogo, WhatsappLogo } from '@phosphor-icons/react/dist/ssr';
import { Logo } from '@/components/Logo';

/**
 * Pied de page, structuré comme celui d'Uber Eats : mot-logo à gauche, deux
 * colonnes de liens à droite, badges d'application, puis une ligne légale
 * séparée par un filet.
 *
 * L'entrée « Espace restaurant » est le seul point d'accès visible au
 * backoffice depuis la vitrine — c'est aussi ce qui remplace le « Add your
 * restaurant » d'Uber, sans objet pour un établissement unique.
 */
export function StoreFooter({ phone, city }: { phone?: string | null; city?: string | null }) {
  const columns: { title: string; links: { href: string; label: string }[] }[] = [
    {
      title: 'Commander',
      links: [
        { href: '/feed', label: 'Toute la carte' },
        { href: '/feed?filtre=offres', label: 'Promotions' },
        { href: '/feed?filtre=populaires', label: 'Les plus commandés' },
        { href: '/#zones', label: 'Zones de livraison' },
      ],
    },
    {
      title: 'Istanbul Fast Food',
      links: [
        { href: '/#a-propos', label: 'À propos' },
        { href: '/#livreur', label: 'Devenir livreur' },
        { href: '/admin', label: 'Espace restaurant' },
        { href: phone ? `tel:${phone}` : '/#a-propos', label: 'Nous contacter' },
      ],
    },
  ];

  return (
    <footer className="mt-20 border-t border-[var(--ue-border-subtle)] py-12">
      <div className="ue-container">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Logo height={56} />
              <p
                className="text-2xl leading-none"
                style={{ fontFamily: 'var(--ue-font-display)', fontWeight: 800, letterSpacing: '-0.03em' }}
              >
                Istanbul <span style={{ fontWeight: 500 }}>Fast Food</span>
              </p>
            </div>

            <div className="mt-6 flex gap-2">
              <span className="ue-btn ue-btn-secondary !px-4 !text-sm">
                <AppleLogo size={20} weight="fill" aria-hidden />
                App Store
              </span>
              <span className="ue-btn ue-btn-secondary !px-4 !text-sm">
                <GooglePlayLogo size={20} weight="fill" aria-hidden />
                Google Play
              </span>
            </div>
          </div>

          <div className="grid gap-10 sm:grid-cols-2 md:gap-20">
            {columns.map((column) => (
              <div key={column.title}>
                <p className="mb-4 text-base font-bold">{column.title}</p>
                <ul className="flex flex-col gap-3">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className="text-base hover:underline">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-[var(--ue-border-subtle)] pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-4 text-[var(--ue-ink-secondary)]">
            <FacebookLogo size={22} aria-label="Facebook" />
            <InstagramLogo size={22} aria-label="Instagram" />
            <WhatsappLogo size={22} aria-label="WhatsApp" />
          </div>
          <p className="text-sm text-[var(--ue-ink-secondary)]">
            © 2026 Istanbul Fast Food{city ? ` — ${city}` : ''}. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
}
