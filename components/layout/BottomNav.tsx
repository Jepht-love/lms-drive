'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAlertCount } from './AlertCountProvider'
import { Home, Truck, CalendarDays, Bell, LayoutGrid, ClipboardList } from 'lucide-react'

const TABS = [
  { label: 'Accueil',      href: '/',             tabKey: 'dashboard',    Icon: Home },
  { label: 'Véhicules',    href: '/vehicles',     tabKey: 'vehicles',     Icon: Truck },
  { label: 'Réservations', href: '/reservations', tabKey: 'reservations', Icon: ClipboardList },
  { label: 'Calendrier',   href: '/calendrier',   tabKey: 'calendrier',   Icon: CalendarDays },
  { label: 'Alertes',      href: '/alerts',       tabKey: null,           Icon: Bell, badge: true },
  { label: 'Menu',         href: '/menu',         tabKey: null,           Icon: LayoutGrid },
]

export default function BottomNav({ allowedTabs }: { allowedTabs?: string[] | null }) {
  const pathname = usePathname()
  const alertCount = useAlertCount()

  const visibleTabs = (!allowedTabs || allowedTabs.length === 0)
    ? TABS
    : TABS.filter(t => !t.tabKey || allowedTabs.includes(t.tabKey))

  return (
    <nav className="shrink-0 bg-[#111111]" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}>
      <div className="flex items-center h-[60px] px-1">
        {visibleTabs.map(({ label, href, Icon, badge }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              prefetch
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-2xl relative min-h-[44px] active:scale-[.97] transition-transform"
            >
              {isActive && (
                <div className="absolute inset-0 bg-white/10 rounded-2xl" />
              )}
              <div className="relative z-10 flex flex-col items-center gap-1">
                <div className="relative">
                  <Icon
                    className={`w-5 h-5 ${isActive ? 'text-white' : 'text-white/40'}`}
                    strokeWidth={isActive ? 2.5 : 1.5}
                  />
                  {badge && alertCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] bg-red-500 rounded-full text-white text-[9px] font-black flex items-center justify-center px-0.5">
                      {alertCount > 9 ? '9+' : alertCount}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-semibold leading-none ${isActive ? 'text-white' : 'text-white/40'}`}>
                  {label}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
