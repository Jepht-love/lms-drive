import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  experimental: {
    // @ts-expect-error serverActionsBodySizeLimit existe en runtime mais manque dans les types bundlés
    serverActionsBodySizeLimit: '20mb',
    // Cache de navigation client : revenir sur un onglet déjà visité (ou préchargé)
    // s'affiche instantanément depuis le cache au lieu de refaire un aller-retour
    // serveur. Les mutations appellent router.refresh() → données rafraîchies.
    //   dynamic : onglet non préchargé, réutilisé 30 s
    //   static  : onglet préchargé (Link prefetch par défaut), réutilisé 5 min
    staleTimes: { dynamic: 30, static: 300 },
  },
};

export default nextConfig;
