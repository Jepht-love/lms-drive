'use client'

// ─── Le bouton menu (hamburger) et son volet de navigation ────────────────────
//
// À quoi il sert : depuis le 08/08/2026, la navigation ne vit plus dans une barre
// d'onglets en bas d'écran. Le bouton « 3 traits » en haut à gauche ouvre un volet
// qui glisse depuis la gauche et occupe la moitié de l'écran ; il porte les mêmes
// entrées qu'avant (Accueil, Véhicules, Réservations, Calendrier, Alertes, Menu),
// chacune avec son icône à gauche et son texte à droite.
//
// Ce qu'il attend : `allowedTabs`, la liste des sections autorisées pour le membre
// connecté (null ou vide = accès complet, rétro-compatible). Le filtrage est le
// MÊME que celui de l'ancienne barre du bas : un employé restreint voit exactement
// les mêmes entrées qu'avant.
//
// Ce qu'il ne faut pas casser :
//  — le badge rouge des alertes garde son compteur (via useAlertCount) ;
//  — le filtrage par permissions doit rester identique à celui d'avant ;
//  — le volet se ferme au clic sur une entrée, sur la croix ou sur le voile, et
//    au changement de page (sinon il resterait ouvert par-dessus l'écran suivant).

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Home, Truck, CalendarDays, Bell, LayoutGrid, ClipboardList, Timer } from 'lucide-react'
import { useAlertCount } from './AlertCountProvider'

// Les mêmes entrées que l'ancienne barre du bas. `tabKey: null` = toujours visible.
const ENTRIES = [
  { label: 'Accueil',      href: '/',             tabKey: 'dashboard',    Icon: Home },
  { label: 'Véhicules',    href: '/vehicles',     tabKey: 'vehicles',     Icon: Truck },
  { label: 'Réservations', href: '/reservations', tabKey: 'reservations', Icon: ClipboardList },
  { label: 'Départ',       href: '/depart',       tabKey: 'depart',       Icon: Timer },
  { label: 'Calendrier',   href: '/calendrier',   tabKey: 'calendrier',   Icon: CalendarDays },
  { label: 'Alertes',      href: '/alerts',       tabKey: null,           Icon: Bell, badge: true },
  { label: 'Menu',         href: '/menu',         tabKey: null,           Icon: LayoutGrid },
]

export default function MenuButton({ allowedTabs }: { allowedTabs?: string[] | null }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const alertCount = useAlertCount()

  // Changement de page : on referme. Un volet resté ouvert se poserait sur l'écran
  // suivant.
  useEffect(() => { setOpen(false) }, [pathname])

  // Le volet est rendu par un « portail » directement dans <body>, hors du bandeau.
  // Sans ça il resterait prisonnier de la couche d'empilement du bandeau (z-index
  // 10) et une barre de recherche de page, dans une couche supérieure, passerait
  // DEVANT lui (bug signalé le 08/08/2026). Au niveau de <body> avec un z-index
  // élevé, le volet passe toujours au premier plan. `mounted` évite d'appeler le
  // portail pendant le rendu serveur, où `document` n'existe pas.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const visible = (!allowedTabs || allowedTabs.length === 0)
    ? ENTRIES
    : ENTRIES.filter(e => !e.tabKey || allowedTabs.includes(e.tabKey))

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le menu"
        className="w-20 flex items-center -ml-1 pl-1 h-full text-white/90 active:scale-95 transition-transform"
      >
        <Menu className="w-6 h-6" strokeWidth={2} />
      </button>

      {mounted && createPortal(
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-black/40 z-[100]"
            />
            <motion.nav
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              className="fixed top-0 bottom-0 left-0 z-[100] w-1/2 min-w-[264px] max-w-[360px] bg-[#111111] flex flex-col"
              style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
            >
              <div className="flex items-center justify-between h-[60px] px-4 shrink-0">
                <span className="text-sm font-black uppercase tracking-widest text-white/50">Menu</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Fermer le menu"
                  className="w-9 h-9 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
                {visible.map(({ label, href, Icon, badge }) => {
                  const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
                  return (
                    <Link
                      key={href}
                      href={href}
                      prefetch
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 px-3 min-h-[52px] rounded-2xl transition-colors ${
                        isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5'
                      }`}
                    >
                      <div className="relative shrink-0">
                        <Icon className="w-6 h-6" strokeWidth={isActive ? 2.4 : 1.8} />
                        {badge && alertCount > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] bg-red-500 rounded-full text-white text-[10px] font-black flex items-center justify-center px-0.5">
                            {alertCount > 9 ? '9+' : alertCount}
                          </span>
                        )}
                      </div>
                      <span className="text-[15px] font-semibold">{label}</span>
                    </Link>
                  )
                })}
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
