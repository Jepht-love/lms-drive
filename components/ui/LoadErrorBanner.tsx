'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * Bandeau discret : « on n'a pas pu charger », avec un bouton pour réessayer.
 *
 * Pourquoi il existe : jusqu'ici, quand le serveur ne répondait pas, le planning
 * s'affichait vide. Sur le terrain, une semaine vide se lit « rien de prévu » — le
 * contraire de ce qu'il faut comprendre. Un composant unique pour que les trois
 * écrans concernés (calendrier, tableau de bord, panneau d'alertes) disent la même
 * chose de la même façon.
 */
export default function LoadErrorBanner({
  message = 'Impossible de charger les données.',
  onRetry,
  className = '',
}: {
  message?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      role="status"
      className={`flex items-center justify-between gap-3 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 ${className}`}
    >
      <span className="flex items-start gap-2 min-w-0 text-[13px] text-amber-900">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-px text-amber-600" aria-hidden="true" />
        <span className="min-w-0">{message}</span>
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex-shrink-0 h-9 inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 text-[13px] font-semibold text-amber-900 hover:bg-amber-50 active:scale-[0.98] transition"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          Réessayer
        </button>
      )}
    </div>
  )
}
