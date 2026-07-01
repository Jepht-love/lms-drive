'use client'

import { useAlertCount } from './AlertCountProvider'

// Pastille rouge du compteur d'alertes sur la cloche de l'en-tête.
// Lit le compteur partagé (AlertCountProvider) — aucune requête propre.
export default function HeaderAlertBadge() {
  const count = useAlertCount()
  if (count <= 0) return null
  return (
    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full
                     text-white text-[9px] font-black flex items-center justify-center leading-none">
      {count > 9 ? '9+' : count}
    </span>
  )
}
