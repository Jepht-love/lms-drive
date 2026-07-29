'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

// Fenêtre de saisie partagée par plusieurs écrans (déplacements internes,
// documents, sinistres et infractions, boutons de statut d'une réservation,
// schéma de dommages). Elle affiche par-dessus l'écran un formulaire court sans
// changer de page.
//
// Elle s'ouvrait en bas de l'écran, à la façon d'un tiroir, avec au plus 70 %
// de la hauteur : sur iPhone et sur tablette couchée, le bouton d'enregistrement
// tombait sous le pli et il fallait faire défiler pour l'atteindre (retour Jeff
// du 29/07/2026). Elle est désormais CENTRÉE : le titre en haut, le contenu au
// milieu, et la hauteur monte jusqu'à l'écran moins 64 px, ce qui laisse une
// marge visible tout autour et remonte le bouton dans le champ de vision.
//
// 64 px, et non 96 : mesuré le 29/07/2026 sur le formulaire « Modifier un
// déplacement », le plus long du lot (796 px de contenu). À 96 px de réserve il
// restait 33 px à faire défiler pour atteindre « Enregistrer » sur iPhone Max —
// donc le défaut d'origine, en plus discret. À 64 px il tient entier.
//
// Trois choses à ne pas casser :
//  — le repère `data-drawer-open` posé sur `body` pilote deux règles de
//    `globals.css` (barre du bas effacée sur téléphone tant qu'une fenêtre est
//    ouverte, réserve sous le contenu). Le compteur permet à un écran d'en
//    porter plusieurs sans que la barre revienne trop tôt ;
//  — `100dvh` et non `100vh` : sur iPhone la barre d'adresse du navigateur
//    mange la différence, et la fenêtre dépasserait de l'écran ;
//  — le défilement vit sur le CONTENU, pas sur la fenêtre, pour que le titre et
//    la croix restent visibles pendant qu'on descend dans un formulaire long.
let tiroirsOuverts = 0

interface DrawerProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
  /**
   * Barre d'action ancrée en bas de la fenêtre, hors de la zone qui défile.
   * À utiliser quand le formulaire est plus haut que l'écran : sur iPhone 390
   * le bouton « Enregistrer » d'un formulaire long reste sinon sous le pli,
   * même la fenêtre centrée (constaté le 29/07/2026 sur « Modifier un
   * déplacement », 812 px de champs pour 844 px d'écran). Formulaire court :
   * laisser le bouton dans le contenu, une barre séparée n'apporte rien.
   * Le bouton posé ici est hors du `<form>` : lui donner `form="<id du form>"`.
   */
  footer?: React.ReactNode
}

export default function Drawer({ open, onClose, children, title, footer }: DrawerProps) {
  const pathname = usePathname()

  // Changement de page : on repart de zéro. Les fenêtres de l'écran quitté sont
  // démontées, une barre restée cachée pour de bon serait pire que le défaut.
  // Déclaré avant le compteur pour que l'ouverture d'une fenêtre gagne toujours.
  useEffect(() => {
    tiroirsOuverts = 0
    delete document.body.dataset.drawerOpen
  }, [pathname])

  useEffect(() => {
    if (!open) return
    tiroirsOuverts += 1
    document.body.dataset.drawerOpen = 'true'
    return () => {
      tiroirsOuverts = Math.max(0, tiroirsOuverts - 1)
      if (tiroirsOuverts === 0) delete document.body.dataset.drawerOpen
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-50"
          />
          {/* Le cadre plein écran centre la fenêtre ; il ne reçoit aucun clic,
              sinon il couvrirait le voile et fermer en cliquant à côté ne
              marcherait plus. */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="pointer-events-auto w-full max-w-md max-h-[calc(100dvh-64px)] flex flex-col bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-start gap-3 px-5 py-3 border-b border-gray-100">
                {title && <h3 className="flex-1 font-bold text-gray-900 text-base pt-1">{title}</h3>}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fermer"
                  className="ml-auto -mr-1 w-9 h-9 min-h-0 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex-shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="drawer-body p-5 overflow-y-auto">
                {children}
              </div>
              {footer && (
                <div className="px-5 py-3 border-t border-gray-100 bg-white flex-shrink-0">
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
