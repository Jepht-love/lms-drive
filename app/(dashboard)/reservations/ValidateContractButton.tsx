'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { validateContract } from '@/lib/actions/reservations'

export default function ValidateContractButton({ contractId }: { contractId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleValidate() {
    if (!confirm('Valider et clôturer ce contrat ? Les deux états des lieux seront définitivement archivés.')) return
    setLoading(true)
    setError(null)
    const result = await validateContract(contractId)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      // Retour naturel à la liste des réservations après clôture (replace : le
      // bouton « retour » ne rouvre pas le contrat clôturé).
      router.replace('/reservations')
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleValidate}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors shadow-sm"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
        {loading ? 'Validation…' : 'Valider & clôturer le contrat'}
      </button>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}
    </div>
  )
}
