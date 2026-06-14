'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, RotateCcw } from 'lucide-react'
import { recordReturn, updateOperationStatus } from '@/lib/actions/partnerships'

export default function OperationActions({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [showReturn, setShowReturn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  function run(fn: () => Promise<{ error?: string; success?: boolean }>, okMsg: string) {
    setError(null); setMsg(null)
    startTransition(async () => {
      const res = await fn()
      if (res?.error) setError(res.error)
      else { setMsg(okMsg); setShowReturn(false); router.refresh() }
    })
  }

  function onReturn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    run(() => recordReturn(id, fd), 'Retour enregistré ✓')
  }

  const btn = 'flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-colors active:scale-[.99] disabled:opacity-40 w-full'

  if (status === 'cloture') {
    return (
      <div className="flex items-center justify-center gap-2 py-3 bg-green-50 border border-green-100 rounded-2xl text-sm font-semibold text-green-700">
        <Lock className="w-4 h-4" /> Opération clôturée
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {(status === 'planifie' || status === 'en_cours') && !showReturn && (
        <button onClick={() => setShowReturn(true)} className={`${btn} bg-[#111111] text-white hover:bg-gray-800 active:scale-[.97]`}>
          <RotateCcw className="w-4 h-4" /> Enregistrer le retour
        </button>
      )}

      {showReturn && (
        <form onSubmit={onReturn} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5" htmlFor="return_km">Km retour</label>
              <input id="return_km" name="return_km" type="number" min="0" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5" inputMode="numeric" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5" htmlFor="fuel_level_return">Carburant /8</label>
              <input id="fuel_level_return" name="fuel_level_return" type="number" min="0" max="8" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5" inputMode="numeric" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowReturn(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium">Annuler</button>
            <button type="submit" disabled={pending} className="flex-1 py-2.5 rounded-xl bg-[#111111] text-white text-sm font-bold disabled:opacity-40 active:scale-[.97]">Valider le retour</button>
          </div>
        </form>
      )}

      {status === 'termine' && (
        <button onClick={() => run(() => updateOperationStatus(id, 'cloture'), 'Clôturé ✓')} disabled={pending}
          className={`${btn} bg-green-600 text-white hover:bg-green-700`}>
          <Lock className="w-4 h-4" /> Clôturer l'opération
        </button>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
      {msg && <p className="text-sm text-green-600 font-medium">{msg}</p>}
    </div>
  )
}
