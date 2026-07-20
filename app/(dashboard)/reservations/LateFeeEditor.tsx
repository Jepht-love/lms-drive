'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateLateFee } from '@/lib/actions/reservations'
import { Check, Loader2, Pencil, Plus, X } from 'lucide-react'

interface Props {
  reservationId: string
  lateFeeAmount: number | null
  lateMinutes: number | null
}

function fmt(n: number) {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' €'
}

/**
 * Saisie manuelle du frais de retard sur la fiche réservation. Le gérant décide
 * du montant facturé ; la durée (minutes) est optionnelle. Écrit via l'action
 * updateLateFee (late_fee_amount / late_minutes / late_fee_validated).
 */
export default function LateFeeEditor({ reservationId, lateFeeAmount, lateMinutes }: Props) {
  const router = useRouter()
  const hasFee = (lateFeeAmount ?? 0) > 0

  const [editing, setEditing] = useState(false)
  const [isLate, setIsLate] = useState(hasFee)
  const [amount, setAmount] = useState(hasFee ? String(lateFeeAmount) : '')
  const [minutes, setMinutes] = useState(lateMinutes && lateMinutes > 0 ? String(lateMinutes) : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setIsLate(hasFee)
    setAmount(hasFee ? String(lateFeeAmount) : '')
    setMinutes(lateMinutes && lateMinutes > 0 ? String(lateMinutes) : '')
    setError(null)
    setEditing(false)
  }

  async function save() {
    setError(null)
    const amt = isLate ? parseFloat(amount.replace(',', '.')) : 0
    if (isLate && (!Number.isFinite(amt) || amt <= 0)) {
      setError('Indique le montant facturé pour le retard.')
      return
    }
    const mins = isLate && minutes ? parseInt(minutes, 10) : null
    setLoading(true)
    const res = await updateLateFee(reservationId, isLate ? amt : 0, mins)
    setLoading(false)
    if (res?.error) { setError(res.error); return }
    setEditing(false)
    router.refresh()
  }

  if (!editing) {
    // Toute la ligne est tappable et l'action reste visible : sur mobile (tactile)
    // il n'y a pas de survol, un bouton en opacity-0/hover serait invisible.
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-full flex items-center justify-between text-left -mx-1 px-1 py-1 rounded-xl active:bg-gray-50 transition-colors"
      >
        <div>
          <dt className="text-xs text-gray-400 uppercase tracking-wide">Retard client</dt>
          <dd className="text-sm font-medium mt-0.5">
            {hasFee ? (
              <span className="text-orange-700 font-bold">
                {fmt(lateFeeAmount!)}{lateMinutes && lateMinutes > 0 ? ` · ${lateMinutes} min` : ''}
              </span>
            ) : (
              <span className="text-gray-400 italic">Aucun retard facturé</span>
            )}
          </dd>
        </div>
        {hasFee ? (
          <span className="p-1.5 rounded-lg bg-gray-100 text-gray-500 flex-shrink-0 ml-2">
            <Pencil className="w-3.5 h-3.5" />
          </span>
        ) : (
          <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-50 text-orange-700 text-xs font-semibold flex-shrink-0 ml-2">
            <Plus className="w-3.5 h-3.5" /> Ajouter
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-800 select-none">
        <input
          type="checkbox"
          checked={isLate}
          onChange={e => setIsLate(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
        />
        Client en retard
      </label>

      {isLate && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Durée (min, option.)</label>
            <input
              inputMode="numeric"
              value={minutes}
              onChange={e => setMinutes(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="ex. 90"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/20"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Montant facturé (€)</label>
            <input
              inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
              placeholder="ex. 50"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/20"
            />
          </div>
        </div>
      )}

      {error && (
        <div className="px-3 py-2 rounded-xl text-sm text-red-600 bg-red-50 border border-red-100">{error}</div>
      )}

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#111111] text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Enregistrer
        </button>
        <button
          onClick={reset}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Annuler
        </button>
      </div>
    </div>
  )
}
