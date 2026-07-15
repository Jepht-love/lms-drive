import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor — coque native iOS/iPad de LMS Drive.
 *
 * L'app Next.js est dynamique (server actions + Supabase) : elle ne peut PAS
 * être exportée en statique. On charge donc l'app en ligne via `server.url`
 * (URL de prod Vercel) dans la webview native.
 *  → conséquence pratique : les déploiements Vercel se répercutent directement
 *    sur l'iPad, sans rebuild Xcode. On ne rebuild que pour un changement natif
 *    (caméra, notifications push).
 *
 * `webDir` (www/) ne sert qu'à héberger un index.html placeholder que Capacitor
 * exige ; il s'affiche pendant le chargement / si le réseau est absent.
 */
const config: CapacitorConfig = {
  appId: 'com.fleetlive.lmsdrive',
  appName: 'LMS DRIVE',
  webDir: 'www',
  server: {
    url: 'https://lms-drive.vercel.app',
    cleartext: false,
  },
}

export default config
