/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Les packages du workspace sont livrés en TypeScript brut : Next doit les
  // transpiler lui-même plutôt que d'attendre un build préalable.
  // Le dashboard n'utilise pas @istanbul/tokens : sa palette est écrite en
  // variables CSS dans globals.css (régénérables via `pnpm tokens:css`).
  transpilePackages: ['@istanbul/core', '@istanbul/types'],

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
