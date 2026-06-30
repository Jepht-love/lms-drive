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
    <header
      className="shrink-0 bg-[#111111] flex items-center justify-between px-4"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        paddingBottom: 12,
        zIndex: 10,
        position: 'relative',
      }}
    >
      {/* Gauche : date */}
      <p className="text-sm text-white/60 font-semibold w-20 capitalize">{date}</p>

      {/* Centre : logo */}
      <Image
        src="/logo.png"
        alt="LMS Drive"
        width={220}
        height={60}
        className="object-contain"
        style={{ height: 60, width: 'auto', maxWidth: 220 }}
        priority
        unoptimized
      />

      {/* Droite : cloche */}
      <div className="w-20 flex justify-end">
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
    </header>
  )
}
