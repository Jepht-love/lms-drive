'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error('[LMS Drive]', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-8 text-center max-w-sm w-full">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7 text-red-500" />
        </div>
        <h2 className="text-base font-bold text-gray-900 mb-2">Une erreur est survenue</h2>
        <p className="text-sm text-gray-400 mb-6">
          {error.message?.includes('fetch') || error.message?.includes('network')
            ? 'Problème de connexion — vérifiez votre réseau et réessayez.'
            : 'Une erreur inattendue s\'est produite. Nos équipes en sont informées.'}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/')}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Accueil
          </button>
          <button
            onClick={reset}
            className="flex-1 py-2.5 rounded-xl bg-[#111111] text-white text-sm font-semibold hover:bg-gray-800 transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    </div>
  )
}
