'use client'

import { useState } from 'react'
import { HandCoins, Check, X, Loader2 } from 'lucide-react'
import { createReceivable } from '@/lib/actions/dueDates'
import { formatPrice } from '@/lib/utils'

interface Props {
  reservationId: string
  /** Reste dû = total − déjà encaissé. Pré-remplit le montant de la créance. */
  remaining: number
  /** Échéance par défaut (YYYY-MM-DD). */
  defaultDueDate: string
}

export default function CreateReceivableButton({ reservationId, remaining, defaultDueDate }: Props) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(remaining > 0 ? String(remaining) : '')
  // Échéance = une simple date (input type=date compact, pas datetime-local qui
  // déborde sur Safari) : l'heure d'une échéance de paiement n'a aucun sens.
  const [dueDate, setDueDate] = useState(defaultDueDate)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const amountNum = amount === '' ? 0 : Number(amount)

  async function handleSave() {
    setError(null)
    setLoading(true)
    const fd = new FormData()
    fd.set('reservation_id', reservationId)
    fd.set('amount', String(amountNum))
    fd.set('due_date', dueDate)
    const res = await createReceivable(fd)
    setLoading(false)
    if (res?.error) { setError(res.error); return }
    setSaved(true)
    setTimeout(() => { setSaved(false); setOpen(false) }, 1400)
  }

  const inputCls = 'h-10 rounded-lg border border-gray-200 bg-white text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10 px-2.5'

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-sm font-bold hover:bg-blue-100 transition-colors"
      >
        <HandCoins className="w-4 h-4" />
        Enregistrer une créance (paiement à recevoir)
      </button>
    )
  }

  return (
    <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
      <div className="flex items-center gap-2">
        <HandCoins className="w-4 h-4 text-blue-600 flex-shrink-0" />
        <p className="text-sm font-bold text-blue-900">Créance client</p>
        <button onClick={() => setOpen(false)} className="ml-auto p-1.5 rounded-lg text-blue-400 hover:bg-blue-100" aria-label="Fermer">
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-[11px] text-blue-700/80 leading-relaxed">
        Le service est rattaché à la date de la réservation. La créance figure en
        « à recevoir » et entre au chiffre d’affaires une fois l’argent encaissé.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] text-blue-700/80 font-bold uppercase tracking-wide mb-1">Montant dû</label>
          <div className="relative">
            <input
              type="number" min="0" step="0.01" inputMode="decimal" placeholder="0"
              value={amount} onChange={e => setAmount(e.target.value)}
              className={`w-full min-w-0 ${inputCls} pr-7 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
          </div>
        </div>
        <div>
          <label className="block text-[11px] text-blue-700/80 font-bold uppercase tracking-wide mb-1">Échéance</label>
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className={`w-full min-w-0 ${inputCls}`}
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={loading || !(amountNum > 0) || !dueDate}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 ${saved ? 'bg-green-100 text-green-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {saved ? 'Créance créée ✓' : `Créer · ${formatPrice(amountNum)}`}
        </button>
        <button onClick={() => setOpen(false)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors">
          <X className="w-3.5 h-3.5" /> Annuler
        </button>
      </div>
    </div>
  )
}
