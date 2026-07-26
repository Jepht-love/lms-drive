'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MARKETING_CHANNELS } from '@/lib/marketing/channels'
import { createCampaign } from '@/lib/actions/campaigns'
import DatePickerField from '@/components/ui/DatePickerField'

export default function NewCampaignPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [channel, setChannel] = useState('')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createCampaign(fd)
      if (result?.error) { setError(result.error); return }
      router.push('/marketing')
    })
  }

  const input = 'w-full border border-gray-200 rounded-xl px-4 py-3 text-[13px] text-gray-800 bg-white'
  const label = 'block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-gray-600">←</button>
        <h1 className="text-xl font-black text-gray-900">Nouvelle campagne</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <div>
            <label className={label} htmlFor="name">Nom de la campagne *</label>
            <input id="name" name="name" required placeholder="Ex: Promo été Instagram" className={input} />
          </div>
          <div>
            <label className={label} htmlFor="objective">Objectif</label>
            <textarea id="objective" name="objective" rows={2} placeholder="Notoriété, acquisition, fidélisation..." className={`${input} resize-none`} />
          </div>
          <div>
            <label htmlFor="page-channel" className={label}>Canal *</label>
            <select id="page-channel" name="channel" required className={input}
              value={channel} onChange={e => setChannel(e.target.value)}>
              <option value="">Sélectionner un canal...</option>
              {MARKETING_CHANNELS.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          {channel === 'autre' && (
            <div>
              <label className={label} htmlFor="observations">Précisez le canal *</label>
              <textarea id="observations" name="observations" rows={2} required
                placeholder="Quel est ce canal de diffusion ?"
                className={`${input} resize-none border-amber-200 bg-amber-50`} />
            </div>
          )}
          <div>
            <label className={label} htmlFor="responsible">Responsable</label>
            <input id="responsible" name="responsible" placeholder="Prénom Nom" className={input} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="page-start_date" className={label}>Date de lancement *</label>
              <DatePickerField id="page-start_date" name="start_date" required className={input} aria-label="Date de lancement" />
            </div>
            <div>
              <label htmlFor="page-end_date" className={label}>Date de fin</label>
              <DatePickerField id="page-end_date" name="end_date" className={input} aria-label="Date de fin" />
            </div>
          </div>
          <div>
            <label htmlFor="page-budget" className={label}>Budget engagé (€)</label>
            <input id="page-budget" name="budget" type="number" step="0.01" min="0" defaultValue="0" className={input} />
          </div>
        </div>

        {error && <p className="text-[13px] text-red-500 px-1">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-4 rounded-2xl bg-[#111111] text-white text-[14px] font-semibold disabled:opacity-40 active:scale-[.97]"
        >
          {isPending ? 'Création...' : 'Créer la campagne'}
        </button>
      </form>
    </div>
  )
}
