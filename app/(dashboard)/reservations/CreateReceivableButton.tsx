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

  // Même langage visuel que « Modifier les dates & tarif » (EditDatesPanel) :
  // carte SOMBRE, champs bg-white/5 bordés blancs, texte blanc, bouton primaire
  // blanc, accent émeraude. La Créance étant sur une section blanche, la carte
  // est un #111 PLEIN (le bg-black/40 translucide n'a de sens que sur le hero).
  const labelCls = 'block text-[11px] font-bold uppercase tracking-wide text-white/50 mb-1.5'
  const fieldCls = 'flex items-center rounded-xl border border-white/15 bg-white/5 transition focus-within:border-white/25 focus-within:ring-2 focus-within:ring-white/10'
  const numCls = 'flex-1 min-w-0 bg-transparent border-0 outline-none px-3 py-2.5 text-sm text-white [color-scheme:dark] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-[#111111] text-white text-sm font-semibold hover:bg-black transition-colors"
      >
        <HandCoins className="w-4 h-4 text-emerald-300" />
        Enregistrer une créance (paiement à recevoir)
      </button>
    )
  }

  return (
    // Carte sombre pleine (#111) — même style que « Modifier tarif ».
    <div className="mt-3 p-4 bg-[#111111] border border-white/10 rounded-2xl space-y-4">
      <div className="flex items-center gap-2">
        <HandCoins className="w-4 h-4 text-white/60 flex-shrink-0" />
        <p className="text-sm font-bold text-white">Créance client</p>
        <button
          onClick={() => setOpen(false)}
          className="ml-auto p-1.5 rounded-lg text-white/50 hover:bg-white/10 transition-colors"
          aria-label="Fermer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-[11px] text-white/50 leading-relaxed">
        Le service est rattaché à la date de la réservation. La créance figure en
        « à recevoir » et entre au chiffre d&apos;affaires une fois l&apos;argent encaissé.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Montant dû</label>
          <div className={fieldCls}>
            <input
              type="number" min="0" step="0.01" inputMode="decimal" placeholder="0"
              value={amount} onChange={e => setAmount(e.target.value)}
              className={numCls}
            />
            <span className="pr-3 text-xs font-semibold text-white/45">€</span>
          </div>
        </div>
        <div>
          <label className={labelCls}>Échéance</label>
          <div className={fieldCls}>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className={numCls}
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={loading || !(amountNum > 0) || !dueDate}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 ${
            saved ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white text-[#111111] hover:bg-white/90'
          }`}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {saved ? 'Créance créée ✓' : `Créer · ${formatPrice(amountNum)}`}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-white/20 text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Annuler
        </button>
      </div>
    </div>
  )
}
