/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'picsum.photos' },
    ],
  },

  // `typedRoutes` est volontairement désactivé : il transforme chaque href en
  // union littérale, ce qui oblige à caster les URL construites
  // (« /orders?status=NEW ») et fait échouer le build pour un gain nul ici.
};

export default nextConfig;
