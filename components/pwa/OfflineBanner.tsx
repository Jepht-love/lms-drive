'use client'

import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false)
  const [visible, setVisible]     = useState(false)

  useEffect(() => {
    const handleOffline = () => { setIsOffline(true);  setVisible(true) }
    const handleOnline  = () => {
      setIsOffline(false)
      // Garder visible 2s pour signaler le retour réseau
      setTimeout(() => setVisible(false), 2000)
    }

    // État initial
    if (!navigator.onLine) { setIsOffline(true); setVisible(true) }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online',  handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online',  handleOnline)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold transition-all duration-300 ${
        isOffline
          ? 'bg-gray-900 text-white'
          : 'bg-green-500 text-white'
      }`}
    >
      {isOffline ? (
        <>
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <span>Mode hors-ligne — données en cache uniquement</span>
        </>
      ) : (
        <>
          <span>✓</span>
          <span>Connexion rétablie</span>
        </>
      )}
    </div>
  )
}
