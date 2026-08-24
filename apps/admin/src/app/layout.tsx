import type { Metadata, Viewport } from 'next';
import { Figtree, Inter } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

// Deux polices pour tout le site, vitrine et backoffice confondus.
//
// Inter pour le corps de texte : c'est le sosie le plus proche d'UberMoveText.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// Figtree pour les titres : elle tient le rôle d'UberMove, propriétaire et non
// redistribuable. Même grotesque géométrique légèrement arrondie, même tenue
// en 700.
//
// Le dashboard chargeait en plus Inter Tight pour ses titres, du temps où il
// avait sa propre charte. Elle est retirée : une police de titre commune
// suffit, et c'est une requête réseau de moins sur chaque page.
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
    // Provenance : tokens --color-background clair/sombre de globals.css —
    // à tenir en phase avec lui.
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#121212' },
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
      className={`${inter.variable} ${figtree.variable}`}
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
