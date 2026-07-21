'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

interface BackButtonProps {
  fallbackHref?: string
  label?: string
  className?: string
  children?: React.ReactNode
}

export default function BackButton({ fallbackHref, label = 'Retour', className, children }: BackButtonProps) {
  const router = useRouter()

  function handleClick() {
    // Retour = revenir à la page où l'on était juste avant (comme le retour
    // navigateur). Le fallbackHref ne sert QUE s'il n'y a pas d'historique
    // (deep-link, page ouverte directement, rafraîchissement PWA).
    if (window.history.length > 1) router.back()
    else if (fallbackHref) router.push(fallbackHref)
    else router.push('/')
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      className={className ?? 'p-2 rounded-xl hover:bg-gray-100 transition-colors mt-1 flex-shrink-0'}
    >
      {children ?? <ArrowLeft className="w-5 h-5 text-gray-600" />}
    </button>
  )
}
