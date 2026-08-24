import type { Metadata, Viewport } from 'next';
import { Figtree, Inter, Inter_Tight } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

// Typographie Wise : Inter pour le corps (leur police officielle), et pour
// les titres une approximation de « Wise Sans » (propriétaire, non
// distribuable) avec Inter Tight en graisses fortes.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const interTight = Inter_Tight({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

// Typographie de la vitrine : Figtree tient le rôle d'UberMove, propriétaire
// et non redistribuable. Même grotesque géométrique légèrement arrondie, même
// tenue en 700. Le texte courant reste sur Inter (≈ UberMoveText), déjà
// chargée ci-dessus : la vitrine n'ajoute donc qu'une seule police.
const figtree = Figtree({
  subsets: ['latin'],
  weight: ['500', '700', '800'],
  variable: '--font-ue-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Istanbul Fast Food — Livraison à Kinshasa',
    template: '%s — Istanbul Fast Food',
  },
  description:
    'Commandez vos plats préférés chez Istanbul Fast Food et faites-vous livrer près de chez vous.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    // Littéraux imposés par l'API themeColor (pas de var() possible ici).
    // Provenance : tokens --color-background clair/sombre du thème Wise —
    // à tenir en phase avec globals.css.
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#121511' },
  ],
};

/**
 * Script inline exécuté avant l'hydratation : relit le thème choisi dans
 * localStorage et pose data-theme sur <html> pour éviter le flash de thème
 * clair chez un utilisateur en sombre explicite.
 */
const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light'){document.documentElement.dataset.theme=t}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning : data-theme est posé avant hydratation par le
    // script inline, le serveur ne peut pas le connaître.
    <html
      lang="fr"
      className={`${inter.variable} ${interTight.variable} ${figtree.variable}`}
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
