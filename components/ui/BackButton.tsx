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
    if (fallbackHref) router.push(fallbackHref)
    else router.back()
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
