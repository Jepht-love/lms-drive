'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

interface DrawerProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
}

// Nombre de tiroirs ouverts en même temps : un écran peut en porter plusieurs
// (Documents, Déplacements internes). La barre du bas ne réapparaît qu'au dernier
// refermé. Le repère posé sur `body` pilote les deux règles de `globals.css`.
let tiroirsOuverts = 0

export default function Drawer({ open, onClose, children, title }: DrawerProps) {
  const pathname = usePathname()

  // Changement de page : on repart de zéro. Les tiroirs de l'écran quitté sont
  // démontés, une barre restée cachée pour de bon serait pire que le défaut.
  // Déclaré avant le compteur pour que l'ouverture d'un tiroir gagne toujours.
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
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 max-h-[70vh] overflow-y-auto"
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1" />
            {title && (
              <div className="px-5 pt-2 pb-3 border-b border-gray-100">
                <h3 className="font-bold text-gray-900 text-base">{title}</h3>
              </div>
            )}
            <div className="drawer-body p-5">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
