'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HomeIcon, TruckIcon, CalendarDaysIcon, BellIcon, Squares2X2Icon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeSolid, TruckIcon as TruckSolid,
  CalendarDaysIcon as CalendarDaysSolid,
  BellIcon as BellSolid, Squares2X2Icon as Squares2X2Solid,
  ClipboardDocumentListIcon as ClipboardSolid,
} from '@heroicons/react/24/solid'

const TABS = [
  { label: 'Accueil',   href: '/',             tabKey: 'dashboard',    Icon: HomeIcon,                   ActiveIcon: HomeSolid },
  { label: 'Véhicules', href: '/vehicles',     tabKey: 'vehicles',     Icon: TruckIcon,                  ActiveIcon: TruckSolid },
  { label: 'Réservations', href: '/reservations', tabKey: 'reservations', Icon: ClipboardDocumentListIcon,  ActiveIcon: ClipboardSolid },
  { label: 'Calendrier',href: '/calendrier',   tabKey: 'calendrier',   Icon: CalendarDaysIcon,           ActiveIcon: CalendarDaysSolid },
  { label: 'Alertes',   href: '/alerts',       tabKey: null,           Icon: BellIcon,                   ActiveIcon: BellSolid, badge: true },
  { label: 'Menu',      href: '/menu',         tabKey: null,           Icon: Squares2X2Icon,             ActiveIcon: Squares2X2Solid },
]

export default function BottomNav({ alertCount: initial = 0, allowedTabs }: { alertCount?: number; allowedTabs?: string[] | null }) {
  const pathname = usePathname()
  const [alertCount, setAlertCount] = useState(initial)

  // Membre restreint : on masque les onglets non autorisés (Alertes/Menu restent).
  const visibleTabs = (!allowedTabs || allowedTabs.length === 0)
    ? TABS
    : TABS.filter(t => !t.tabKey || allowedTabs.includes(t.tabKey))

  useEffect(() => {
    fetch('/api/alerts/count')
      .then(r => r.json())
      .then(d => setAlertCount(d.count ?? initial))
      .catch(() => {})
  }, [initial])

  return (
    <nav className="shrink-0 bg-[#111111]" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}>
      {/* Items de navigation */}
      <div className="flex items-center h-[60px] px-1">
        {visibleTabs.map(({ label, href, Icon, ActiveIcon, badge }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-2xl relative min-h-[auto]"
            >
              {isActive && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-0 bg-white/10 rounded-2xl"
                  transition={{ type: 'spring', damping: 30, stiffness: 500 }}
                />
              )}
              <div className="relative z-10 flex flex-col items-center gap-1">
                <div className="relative">
                  {isActive
                    ? <ActiveIcon className="w-5 h-5 text-white" />
                    : <Icon className="w-5 h-5 text-white/40" />
                  }
                  {badge && (
                    <AnimatePresence>
                      {alertCount > 0 && (
                        <motion.span
                          key={alertCount}
                          initial={{ scale: 1.4 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          transition={{ type: 'spring', damping: 10, stiffness: 300 }}
                          className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] bg-red-500 rounded-full text-white text-[9px] font-black flex items-center justify-center px-0.5"
                        >
                          {alertCount > 9 ? '9+' : alertCount}
                        </motion.span>
                      )}
                    </AnimatePresence>
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
