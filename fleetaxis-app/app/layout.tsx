import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans, Inter, IBM_Plex_Mono } from 'next/font/google'
import '@/styles/fleetaxis.css'

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-jakarta', display: 'swap' })
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-inter', display: 'swap' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono', display: 'swap' })

export const metadata: Metadata = {
  title: 'FleetAxis — Logiciel de gestion de flotte',
  description:
    'FleetAxis — logiciel de gestion de flotte de véhicules : suivi des déplacements, états des lieux numérisés, alertes, rapports. Fleet management software for rental agencies, corporate fleets and transport operators.',
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
        <div className={`${jakarta.variable} ${inter.variable} ${plexMono.variable} fx-root`}>
          {children}
        </div>
      </body>
    </html>
  )
}
