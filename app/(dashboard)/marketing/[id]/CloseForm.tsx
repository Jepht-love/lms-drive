'use client'

import { useState, useTransition } from 'react'
import { closeCampaign } from '@/lib/actions/campaigns'

export default function CloseForm({ campaignId, endDate }: { campaignId: string; endDate: string | null }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const input = 'w-full border border-gray-200 rounded-xl px-4 py-3 text-[13px]'
  const label = 'block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5'

  function handleClose(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await closeCampaign(campaignId, fd)
      if (result?.error) { setError(result.error); return }
      setOpen(false)
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-4 rounded-2xl bg-[#111111] text-white text-[14px] font-semibold active:scale-[.97]"
      >
        Clôturer la campagne
      </button>
    )
  }

  return (
    <form onSubmit={handleClose} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Résultats finaux</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Prospects générés</label>
          <input name="prospects_count" type="number" min="0" defaultValue="0" className={input} />
        </div>
        <div>
          <label className={label}>Réservations obtenues</label>
          <input name="reservations_count" type="number" min="0" defaultValue="0" className={input} />
        </div>
      </div>

      <div>
        <label className={label}>CA généré (€)</label>
        <input name="revenue_generated" type="number" step="0.01" min="0" defaultValue="0" className={input} />
      </div>

      <div>
        <label className={label}>Date de fin</label>
        <input name="end_date" type="date" defaultValue={endDate ?? ''} className={input} />
      </div>

      <div>
        <label className={label}>Observations & conclusions</label>
        <textarea name="observations" rows={3} className={`${input} resize-none`} placeholder="Bilan, enseignements, recommandations..." />
      </div>

      {error && <p className="text-[12px] text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-[13px] font-medium text-gray-600">
          Annuler
        </button>
        <button type="submit" disabled={isPending} className="flex-1 py-3 rounded-xl bg-[#111111] text-white text-[13px] font-semibold disabled:opacity-40 active:scale-[.97]">
          {isPending ? 'Clôture...' : 'Valider'}
        </button>
      </div>
    </form>
  )
}
