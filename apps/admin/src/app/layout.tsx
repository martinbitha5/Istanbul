import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display_SC, Sora } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const sora = Sora({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-sora',
  display: 'swap',
});

const playfair = Playfair_Display_SC({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-playfair',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Istanbul Fast Food — Dashboard',
  description: 'Gestion des commandes, du menu et des livraisons.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    // Littéraux imposés par l'API themeColor (pas de var() possible ici).
    // Provenance : tokens Istanbul --color-background clair/sombre — à tenir
    // en phase avec packages/tokens et globals.css.
    { media: '(prefers-color-scheme: light)', color: '#FFFBF7' },
    { media: '(prefers-color-scheme: dark)', color: '#100D0B' },
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
      className={`${inter.variable} ${sora.variable} ${playfair.variable}`}
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
