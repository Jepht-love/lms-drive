'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Wrench, Lock } from 'lucide-react'
import { SINISTRE_FLOW, SINISTRE_STATUS } from '@/lib/incidents'
import { updateAccidentStatus, addAccidentToVehicle } from '@/lib/actions/incidents'

export default function SinistreActions({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  function run(fn: () => Promise<{ error?: string; success?: boolean }>, okMsg: string) {
    setError(null); setMsg(null)
    startTransition(async () => {
      const res = await fn()
      if (res?.error) setError(res.error)
      else { setMsg(okMsg); router.refresh() }
    })
  }

  const idx = SINISTRE_FLOW.indexOf(status)
  const next = idx >= 0 && idx < SINISTRE_FLOW.length - 1 ? SINISTRE_FLOW[idx + 1] : null
  const btn = 'flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-colors active:scale-[.99] disabled:opacity-40'

  return (
    <div className="space-y-2">
      {next ? (
        <button onClick={() => run(() => updateAccidentStatus(id, next), 'Statut avancé ✓')} disabled={pending}
          className={`${btn} bg-[#111111] text-white hover:bg-gray-800 w-full active:scale-[.97]`}>
          <ArrowRight className="w-4 h-4" /> Étape suivante : {SINISTRE_STATUS[next].label}
        </button>
      ) : (
        <div className="flex items-center justify-center gap-2 py-3 bg-green-50 border border-green-100 rounded-2xl text-sm font-semibold text-green-700">
          <Lock className="w-4 h-4" /> Sinistre clôturé
        </div>
      )}

      <button onClick={() => run(() => addAccidentToVehicle(id), 'Ajouté au suivi entretien ✓')} disabled={pending}
        className={`${btn} bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 w-full`}>
        <Wrench className="w-4 h-4" /> Ajouter au suivi véhicule (réparation)
      </button>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
      {msg && <p className="text-sm text-green-600 font-medium">{msg}</p>}
    </div>
  )
}
