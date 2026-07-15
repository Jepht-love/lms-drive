import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ServiceWorkerRegistration from '@/components/pwa/ServiceWorkerRegistration'
import OfflineBanner from '@/components/pwa/OfflineBanner'
import PushPermissionBanner from '@/components/pwa/PushPermissionBanner'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'LMS Drive',
  description: 'Gestion de location de véhicules',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'LMS Drive' },
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Rendu « application native » : pas de zoom pincé (comportement web).
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#111111',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.variable}>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="bg-white text-[#111111] antialiased font-sans">
        <OfflineBanner />
        <PushPermissionBanner />
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}
