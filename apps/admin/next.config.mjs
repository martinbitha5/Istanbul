/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /**
   * Dossier de build, redirigeable.
   *
   * Un `next build` lancé pendant qu'un `next dev` tourne écrit dans le même
   * `.next` et les deux se détruisent mutuellement : le serveur se met à
   * répondre 500 (« ENOENT ... chunk »), le build meurt sur un « Cannot find
   * module for page: /_document ». Aucun des deux messages ne parle du vrai
   * problème, et on perd un après-midi à chercher un bug qui n'existe pas.
   *
   * `NEXT_DIST_DIR=.next-verif pnpm build` permet de vérifier une compilation
   * sans toucher au serveur de développement en cours.
   */
  distDir: process.env.NEXT_DIST_DIR || '.next',

  // Les packages du workspace sont livrés en TypeScript brut : Next doit les
  // transpiler lui-même plutôt que d'attendre un build préalable.
  // Le dashboard n'utilise pas @istanbul/tokens : sa palette est écrite en
  // variables CSS dans globals.css (régénérables via `pnpm tokens:css`).
  transpilePackages: ['@istanbul/core', '@istanbul/types'],

  experimental: {
    /**
     * Import à la carte des barils volumineux.
     *
     * `@phosphor-icons/react` expose près de dix mille modules derrière un
     * unique `index`. Sans cette option, écrire `import { Receipt } from
     * '@phosphor-icons/react'` fait traverser tout le baril au compilateur :
     * en développement, chaque première visite d'une page coûtait plusieurs
     * secondes de compilation ; en production, le tree-shaking finissait par
     * nettoyer, mais après avoir gonflé le graphe de modules.
     *
     * Next réécrit ces imports vers les chemins profonds correspondants. Le
     * code des écrans reste lisible, la compilation ne voit que les quinze
     * icônes réellement utilisées.
     */
    optimizePackageImports: ['@phosphor-icons/react', 'recharts', '@tanstack/react-query'],
  },

  images: {
    // Une seule origine autorisée : le Storage du projet. Les photos de la
    // carte y sont téléversées depuis le backoffice, jamais référencées par
    // un lien externe — un domaine tiers dans cette liste, c'est une image
    // qui disparaît le jour où quelqu'un d'autre la supprime.
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }],
  },

  /**
   * Anciennes URL du dashboard.
   *
   * La racine est passée à la vitrine publique et le backoffice est descendu
   * sous /admin. Les signets et les onglets épinglés de l'équipe pointent
   * encore sur /orders ou /menu : sans ces redirections ils tomberaient sur
   * un 404 de la vitrine, ce qui se lit comme « le dashboard a disparu ».
   *
   * Redirections permanentes : ces chemins ne reviendront pas.
   */
  async redirects() {
    const moved = [
      'login',
      'orders',
      'menu',
      'categories',
      'promotions',
      'drivers',
      'zones',
      'customers',
      'staff',
      'settings',
    ];

    return moved.map((path) => ({
      source: `/${path}`,
      destination: `/admin/${path}`,
      permanent: true,
    }));
  },

  // `typedRoutes` est volontairement désactivé : il transforme chaque href en
  // union littérale, ce qui oblige à caster les URL construites
  // (« /orders?status=NEW ») et fait échouer le build pour un gain nul ici.
};

export default nextConfig;
