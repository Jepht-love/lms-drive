'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  Car, Users, Calendar, FileText, ClipboardList,
  AlertTriangle, Navigation, BarChart3, Settings,
  LogOut, Bell, Menu, X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { logout } from '@/lib/actions/auth'
import type { Profile } from '@/types/database'

const navItems = [
  { key: 'dashboard',      href: '/',               label: 'Dashboard',    icon: BarChart3 },
  { key: 'calendar',       href: '/calendrier',     label: 'Calendrier',   icon: Calendar },
  { key: 'reservations',   href: '/reservations',   label: 'Réservations', icon: ClipboardList },
  { key: 'clients',        href: '/clients',        label: 'Clients',      icon: Users },
  { key: 'vehicles',       href: '/vehicles',       label: 'Véhicules',    icon: Car },
  { key: 'contracts',      href: '/contracts',      label: 'Contrats',     icon: FileText },
  { key: 'incidents',      href: '/incidents',      label: 'Incidents',    icon: AlertTriangle },
  { key: 'internal-trips', href: '/internal-trips', label: 'Déplacements', icon: Navigation },
]

const managerItems = [
  { href: '/settings', label: 'Paramètres', icon: Settings },
]

interface SidebarProps { profile: Profile; unreadCount?: number }

export default function Sidebar({ profile, unreadCount = 0 }: SidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const isManager = profile.role === 'gerant' || profile.role === 'associe'

  // Permissions par onglet : un employé ne voit que ses onglets autorisés.
  // allowed_tabs null/vide → accès complet (rétro-compatible avec l'existant).
  const allowed = profile.allowed_tabs
  const visibleNav = (isManager || !allowed || allowed.length === 0)
    ? navItems
    : navItems.filter(item => allowed.includes(item.key))

  const NavLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: LucideIcon }) => {
    const active = pathname === href || (href !== '/' && pathname.startsWith(href))
    return (
      <Link
        href={href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 min-h-[44px] group',
          active ? 'text-[#0A0A0A]' : 'text-white hover:bg-white/8'
        )}
        style={active ? { background: 'linear-gradient(135deg, #C4A35A, #D4B870)', color: '#0A0A0A' } : {}}
      >
        <Icon className={cn('flex-shrink-0 transition-colors', active ? 'text-[#0A0A0A]' : 'text-white group-hover:text-white')} size={17} />
        <span className="tracking-wide">{label}</span>
      </Link>
    )
  }

  const LogoBlock = ({ compact = false }: { compact?: boolean }) => (
    <div className={compact ? 'flex items-center h-8' : 'flex items-center h-10'}>
      <Image
        src="/logo.webp"
        alt="LMS Drive"
        width={compact ? 90 : 120}
        height={compact ? 32 : 40}
        className="object-contain"
        style={{ filter: 'invert(1)', mixBlendMode: 'screen', marginTop: '-8px' }}
        priority
      />
    </div>
  )

  const sidebarContent = (
    <div className="flex flex-col h-full" style={{ background: '#0A0A0A' }}>

      {/* Logo */}
      <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: '#1E1E1E' }}>
        <Link href="/" onClick={() => setMobileOpen(false)}>
          <LogoBlock />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto sidebar-scroll">
        {visibleNav.map(item => <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />)}
        {isManager && (
          <>
            <div className="my-3 mx-2" style={{ height: '1px', background: '#1E1E1E' }} />
            {managerItems.map(item => <NavLink key={item.href} {...item} />)}
          </>
        )}
      </nav>

      {/* Notifications */}
      <div className="px-3 pb-2">
        <Link
          href="/notifications"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-white hover:bg-white/8 transition-all min-h-[44px]"
        >
          <Bell size={17} className="text-white flex-shrink-0" />
          <span>Notifications</span>
          {unreadCount > 0 && (
            <span className="ml-auto flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold text-black" style={{ background: '#C4A35A' }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>
      </div>

      {/* Profil */}
      <div className="px-3 pb-5 pt-3" style={{ borderTop: '1px solid #1E1E1E' }}>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1" style={{ background: '#141414' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm text-black" style={{ background: 'linear-gradient(135deg, #C4A35A, #D4B870)' }}>
            {profile.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{profile.full_name}</p>
            <p className="text-xs capitalize" style={{ color: '#C4A35A' }}>{profile.role}</p>
          </div>
        </div>
        <form action={logout}>
          <button type="submit" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-white/70 hover:text-white hover:bg-white/8 transition-all min-h-[44px]">
            <LogOut size={16} />
            <span>Déconnexion</span>
          </button>
        </form>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex w-60 flex-shrink-0 flex-col h-screen sticky top-0" style={{ background: '#0A0A0A' }}>
        {sidebarContent}
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-30" style={{ background: '#0A0A0A', borderBottom: '1px solid #1E1E1E' }}>
        <Link href="/">
          <LogoBlock compact />
        </Link>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Link href="/notifications" className="relative p-2">
              <Bell size={18} className="text-white/70" />
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full text-xs flex items-center justify-center text-black font-bold" style={{ background: '#C4A35A' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </Link>
          )}
          <button onClick={() => setMobileOpen(true)} className="p-2 text-white/70 hover:text-white">
            <Menu size={22} />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 h-full flex flex-col shadow-2xl" style={{ background: '#0A0A0A' }}>
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 p-2 text-white/40 hover:text-white/80">
              <X size={18} />
          </button>
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}
