import Image from 'next/image'
import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Bell } from 'lucide-react'

interface PageHeaderProps {
  title?: string
  alertCount?: number
}

export default function PageHeader({ title, alertCount = 0 }: PageHeaderProps) {
  const today = new Date()
  const date  = title ?? format(today, 'EEE d', { locale: fr })

  return (
    // Bande d'encoche (safe-area) noire pour un rendu propre sous la Dynamic Island ;
    // barre de header blanche en dessous → le logo (image opaque sur fond blanc)
    // s'affiche tel quel, sans filtre, donc plus de « rectangle blanc ».
    <header
      className="shrink-0 bg-[#111111]"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', position: 'relative', zIndex: 10 }}
    >
      <div className="flex items-center justify-between px-4 h-[60px] bg-white border-b border-gray-100">
        {/* Gauche : date */}
        <p className="text-sm text-gray-500 font-semibold w-20 capitalize">{date}</p>

        {/* Centre : logo */}
        <Image
          src="/logo.png"
          alt="LMS Drive"
          width={220}
          height={44}
          className="object-contain"
          style={{ height: 40, width: 'auto', maxWidth: 180 }}
          priority
          unoptimized
        />

        {/* Droite : cloche */}
        <div className="w-20 flex justify-end">
          <Link href="/alerts" className="relative inline-flex items-center">
            <Bell className="w-5 h-5 text-gray-800" strokeWidth={2} />
            {alertCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full
                               text-white text-[9px] font-black flex items-center justify-center leading-none">
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  )
}
