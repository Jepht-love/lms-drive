'use client'

import { useState, useTransition } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { MAINTENANCE_TYPES } from '@/lib/maintenance'
import { createMaintenanceRecord } from '@/lib/actions/maintenance'

export default function NewMaintenancePage() {
  const { vehicleId } = useParams<{ vehicleId: string }>()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [type, setType] = useState('revision')

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await createMaintenanceRecord(formData)
      if (res?.error) setError(res.error)
      else router.push(`/maintenance/${vehicleId}`)
    })
  }

  const today = new Date().toISOString().slice(0, 10)
  const inputCls = 'w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 focus:outline-none focus:border-gray-400 transition-colors'
  const labelCls = 'block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5'

  return (
    <div className="space-y-4 pb-4">

      <BackButton fallbackHref={`/maintenance/${vehicleId}`} className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Retour
      </BackButton>

      <h1 className="text-xl font-black text-gray-900">Nouvelle intervention</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        <input type="hidden" name="vehicle_id" value={vehicleId} />

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          {/* Type */}
          <div>
            <label className={labelCls} htmlFor="type">Type</label>
            <select id="type" name="type" className={inputCls} required
              value={type} onChange={e => setType(e.target.value)}>
              {MAINTENANCE_TYPES.map(t => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Date + Montant */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="date">Date</label>
              <input id="date" name="date" type="date" defaultValue={today} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls} htmlFor="amount">Montant (€)</label>
              <input id="amount" name="amount" type="number" step="0.01" min="0" placeholder="0" className={inputCls} inputMode="decimal" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={labelCls} htmlFor="description">Description</label>
            <input id="description" name="description" type="text" placeholder="Ex : remplacement plaquettes avant" className={inputCls} />
          </div>

          {/* Km + Prestataire */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="km_at_intervention">Km</label>
              <input id="km_at_intervention" name="km_at_intervention" type="number" min="0" placeholder="Kilométrage" className={inputCls} inputMode="numeric" />
            </div>
            <div>
              <label className={labelCls} htmlFor="provider">Prestataire</label>
              <input id="provider" name="provider" type="text" placeholder="Garage…" className={inputCls} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls} htmlFor="notes">
              {type === 'autre' ? "Précisez le type d'intervention *" : 'Notes'}
            </label>
            <textarea id="notes" name="notes" rows={3} required={type === 'autre'}
              placeholder={type === 'autre' ? 'Quel est ce type d\'intervention ?' : 'Notes complémentaires…'}
              className={`${inputCls} resize-none ${type === 'autre' ? 'border-amber-200 bg-amber-50' : ''}`} />
          </div>

          {/* Justificatif optionnel → rangé dans Documents › Véhicule si joint */}
          <div>
            <label className={labelCls} htmlFor="justificatif">Justificatif (facture, devis…) — optionnel</label>
            <input id="justificatif" name="justificatif" type="file" accept="image/*,application/pdf"
              className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 file:font-semibold file:text-xs" />
            <p className="text-[11px] text-gray-400 mt-1">Si joint, classé automatiquement dans Documents › Véhicule.</p>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full py-3.5 bg-[#111111] text-white rounded-2xl font-bold text-sm hover:bg-gray-800 transition-colors active:scale-[.99] disabled:opacity-40"
        >
          {pending ? 'Enregistrement…' : "Enregistrer l'intervention"}
        </button>
      </form>
    </div>
  )
}
