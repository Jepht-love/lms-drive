'use client'

import { useState } from 'react'
import { HandCoins, Check, X, Loader2 } from 'lucide-react'
import { createReceivable } from '@/lib/actions/dueDates'
import { formatPrice } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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

  // Libellé mini façon shadcn (comme « MONTANT REÇU / RÉFÉRENCE » de la section).
  const labelCls = 'block text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1'

  if (!open) {
    return (
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="mt-3 w-full h-11 rounded-lg text-sm font-semibold"
      >
        <HandCoins className="text-muted-foreground" />
        Enregistrer une créance (paiement à recevoir)
      </Button>
    )
  }

  return (
    // Carte shadcn neutre (gris clair) — cohérente avec la charte noir/blanc,
    // plus de bleu qui tranchait avec le reste de la fiche.
    <div className="mt-3 p-4 rounded-xl border border-input bg-muted/50 space-y-3">
      <div className="flex items-center gap-2">
        <HandCoins className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <p className="text-sm font-bold text-foreground">Créance client</p>
        <button
          onClick={() => setOpen(false)}
          className="ml-auto p-1.5 rounded-md text-muted-foreground hover:bg-accent transition-colors"
          aria-label="Fermer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Le service est rattaché à la date de la réservation. La créance figure en
        « à recevoir » et entre au chiffre d&apos;affaires une fois l&apos;argent encaissé.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Montant dû</label>
          <div className="relative">
            <Input
              type="number" min="0" step="0.01" inputMode="decimal" placeholder="0"
              value={amount} onChange={e => setAmount(e.target.value)}
              className="h-10 text-[13px] pr-7 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
          </div>
        </div>
        <div>
          <label className={labelCls}>Échéance</label>
          <Input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className="h-10 text-[13px] min-w-0"
          />
        </div>
      </div>

      {error && <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>}

      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={loading || !(amountNum > 0) || !dueDate}
          className={`rounded-lg ${saved ? 'bg-emerald-600 text-white hover:bg-emerald-600' : ''}`}
        >
          {loading ? <Loader2 className="animate-spin" /> : <Check />}
          {saved ? 'Créance créée ✓' : `Créer · ${formatPrice(amountNum)}`}
        </Button>
        <Button variant="outline" onClick={() => setOpen(false)} className="rounded-lg font-medium">
          <X /> Annuler
        </Button>
      </div>
    </div>
  )
}
