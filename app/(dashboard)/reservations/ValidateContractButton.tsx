'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Loader2, AlertTriangle, X } from 'lucide-react'
import { validateContract } from '@/lib/actions/reservations'

export default function ValidateContractButton({ contractId }: { contractId: string }) {
  const router = useRouter()
  const [step, setStep] = useState<'idle' | 'confirm' | 'loading'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleValidate() {
    setStep('loading')
    setError(null)
    const result = await validateContract(contractId)
    if (result?.error) {
      setError(result.error)
      setStep('idle')
    } else {
      router.replace('/reservations')
    }
  }

  if (step === 'confirm') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm font-semibold text-amber-800">
            Valider et clôturer ce contrat ? Les deux états des lieux seront définitivement archivés.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setStep('idle')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Annuler
          </button>
          <button
            onClick={handleValidate}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Confirmer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => setStep('confirm')}
        disabled={step === 'loading'}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors shadow-sm"
      >
        {step === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
        {step === 'loading' ? 'Validation…' : 'Valider & clôturer le contrat'}
      </button>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}
    </div>
  )
}
