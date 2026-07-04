import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans, Inter, IBM_Plex_Mono } from 'next/font/google'
import '@/styles/fleetaxis.css'

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-jakarta', display: 'swap' })
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-inter', display: 'swap' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono', display: 'swap' })

export const metadata: Metadata = {
  title: 'FleetAxis — Fleet Management Platform',
  description:
    'FleetAxis — logiciel de gestion de flotte institutionnelle : suivi des véhicules, traçabilité des déplacements, états des lieux numérisés. Institutional fleet management software for UN bodies, NGOs and public administrations.',
  // Surcharge les métadonnées PWA héritées du layout racine (qui portent le nom
  // « LMS Drive ») pour que la page FleetAxis n'expose aucune référence à LMS Drive.
  applicationName: 'FleetAxis',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'FleetAxis' },
  other: {
    'apple-mobile-web-app-title': 'FleetAxis',
    'application-name': 'FleetAxis',
  },
}

export const viewport: Viewport = {
  themeColor: '#060C18',
  width: 'device-width',
  initialScale: 1,
}

export default function FleetAxisLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${jakarta.variable} ${inter.variable} ${plexMono.variable} fx-root`}>
      {children}
    </div>
  )
}
