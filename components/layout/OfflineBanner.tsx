'use client'
import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export default function OfflineBanner() {
  const online = useOnlineStatus()

  if (online) return null

  return (
    <>
      <div className="fixed top-0 inset-x-0 z-50 bg-amber-500 text-white text-[12px] font-semibold flex items-center justify-center gap-2 px-4 py-2 safe-area-inset-top">
        <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
        Mode hors-ligne — consultation uniquement, les modifications ne seront pas enregistrées
      </div>
      {!online && <div className="h-8" />}
    </>
  )
}
