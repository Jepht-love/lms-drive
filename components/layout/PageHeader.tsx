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
    // Header noir (encoche/safe-area incluse). Logo BLANC à fond transparent
    // (public/logo-white.png, généré depuis logo.png) → s'affiche net sur le noir,
    // sans filtre ni rectangle blanc.
    <header
      className="shrink-0 bg-[#111111]"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', position: 'relative', zIndex: 10 }}
    >
      <div className="flex items-center justify-between px-4 h-[60px]">
        {/* Gauche : date */}
        <p className="text-sm text-white/60 font-semibold w-20 capitalize">{date}</p>

        {/* Centre : logo blanc */}
        <Image
          src="/logo-white.png"
          alt="LMS Drive"
          width={543}
          height={300}
          className="object-contain"
          style={{ height: 48, width: 'auto', maxWidth: 200 }}
          priority
          unoptimized
        />

        {/* Droite : cloche */}
        <div className="w-20 flex justify-end items-center gap-2">
          <span className="text-[10px] font-bold text-yellow-400">v5</span>
          <Link href="/alerts" className="relative inline-flex items-center">
            <Bell className="w-5 h-5 text-white" strokeWidth={2} />
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
