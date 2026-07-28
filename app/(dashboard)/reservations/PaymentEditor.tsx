'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updatePaymentInfo } from '@/lib/actions/reservations'
import { formatPrice } from '@/lib/utils'
import { Banknote, CreditCard, ArrowLeftRight, FileText, Check, Loader2 } from 'lucide-react'

type PaymentStatus = 'en_attente' | 'paye' | 'partiel' | 'impaye'
type PaymentMethodType = 'especes' | 'virement' | 'cb' | 'cheque'

const PAYMENT_STATUSES = [
  { value: 'en_attente', label: 'En attente', description: 'Paiement non encore reçu', color: 'bg-gray-100 text-gray-700 border-gray-200', dot: 'bg-gray-400' },
  { value: 'paye',       label: 'Payé',        description: 'Paiement intégral reçu',   color: 'bg-green-50 text-green-800 border-green-200', dot: 'bg-green-500' },
  { value: 'partiel',    label: 'Acompte',      description: 'Acompte encaissé',        color: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  { value: 'impaye',     label: 'Impayé',       description: 'Aucun paiement reçu',     color: 'bg-red-50 text-red-800 border-red-200', dot: 'bg-red-500' },
]

const PAYMENT_METHODS: { value: PaymentMethodType; label: string; icon: React.ReactNode }[] = [
  { value: 'especes',  label: 'Espèces',  icon: <Banknote className="w-4 h-4" /> },
  { value: 'cb',       label: 'Carte',    icon: <CreditCard className="w-4 h-4" /> },
  { value: 'virement', label: 'Virement', icon: <ArrowLeftRight className="w-4 h-4" /> },
  { value: 'cheque',   label: 'Chèque',   icon: <FileText className="w-4 h-4" /> },
]

interface Props {
  reservationId: string
  totalPrice: number
  currentStatus: PaymentStatus
  currentMethod: PaymentMethodType | null
  currentAmount: number | null
  currentRef: string | null
  /** Frais constatés au retour, déjà nommés (km, retard, dommages). */
  fees?: { label: string; amount: number }[]
  /** Ce qui a déjà été encaissé sur ces frais. */
  feesPaid?: number
  /**
   * Part de la location déjà placée en créance, non encore encaissée. Elle est
   * suivie sur l'écran Créances : la réclamer ici aussi ferait apparaître la même
   * somme à deux endroits.
   */
  inReceivables?: number
}

export default function PaymentEditor({ reservationId, totalPrice, currentStatus, currentMethod, currentAmount, currentRef, fees = [], feesPaid = 0, inReceivables = 0 }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<PaymentStatus>(currentStatus ?? 'en_attente')
  const [method, setMethod] = useState<PaymentMethodType | ''>(currentMethod ?? '')
  const [ref, setRef] = useState(currentRef ?? '')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Le champ porte le TOTAL reçu sur la réservation, location et frais confondus :
  // c'est ce que le gérant a réellement en main. La ventilation est faite juste
  // en dessous, et c'est elle qui part en base.
  const feesTotal = fees.reduce((s, f) => s + f.amount, 0)
  // Ce qui reste à encaisser ICI. Une location non soldée au départ part en
  // créance : elle est réclamée sur l'écran Créances, pas ici. Sans cette
  // déduction, le gérant verrait la même somme demandée à deux endroits.
  const locationIci = Math.max(0, totalPrice - inReceivables)
  const totalDu = locationIci + feesTotal
  // `currentAmount === null` veut dire « rien n'a jamais été saisi » → on propose
  // le total dû. Un acompte enregistré à 0 € est une saisie, elle, et doit rester
  // affichée telle quelle.
  const [amount, setAmount] = useState(
    currentAmount == null && feesPaid === 0 ? totalDu.toString() : ((currentAmount ?? 0) + feesPaid).toString()
  )

  const current = PAYMENT_STATUSES.find(s => s.value === status) ?? PAYMENT_STATUSES[0]

  // Ventilation : ce qui est reçu solde d'abord la location, le surplus va aux
  // frais. Deux comptes séparés, et c'est volontaire — la recette « location »
  // est posée en comptabilité avec le montant payé, tandis que les frais y
  // figurent dans leurs propres catégories à la clôture. Tout verser dans le
  // même sac les compterait deux fois. Décision de Jeff du 28/07/2026.
  const recu = Number(amount) || 0
  const partLocation = Math.min(Math.max(recu, 0), locationIci)
  const partFrais = Math.max(0, Math.min(recu - locationIci, feesTotal))
  const reste = Math.max(0, totalDu - recu)

  async function handleSave() {
    setLoading(true)
    setSaved(false)
    setErrorMsg(null)
    try {
      const result = await updatePaymentInfo(reservationId, {
        payment_status: status,
        payment_method: method || null,
        payment_amount: amount ? partLocation : null,
        fees_paid_amount: feesTotal > 0 ? partFrais : undefined,
        payment_ref: ref || null,
        payment_date: status === 'paye' || status === 'partiel' ? new Date().toISOString() : null,
      })
      if (result?.error) {
        setErrorMsg(result.error)
        return
      }
      setSaved(true)
      setTimeout(() => { setSaved(false); router.refresh() }, 1500)
    } catch {
      setErrorMsg('Erreur réseau : le paiement n’a pas été enregistré. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Statut actuel */}
      <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border ${current.color}`}>
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${current.dot}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{current.label}</p>
          <p className="text-xs opacity-70 mt-0.5">{current.description}</p>
        </div>
      </div>

      {/* Statuts */}
      <div>
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Statut paiement</p>
        <div className="grid grid-cols-2 gap-1.5">
          {PAYMENT_STATUSES.map(s => (
            <button type="button"
              key={s.value}
              onClick={() => setStatus(s.value as PaymentStatus)}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
                status === s.value
                  ? s.color + ' ring-1 ring-offset-1 ring-current'
                  : 'border-gray-100 bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mode de paiement */}
      <div>
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Mode de paiement</p>
        <div className="grid grid-cols-4 gap-1.5">
          {PAYMENT_METHODS.map(m => (
            <button type="button"
              key={m.value}
              onClick={() => setMethod(m.value)}
              className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-xs font-medium border transition-all ${
                method === m.value
                  ? 'border-[#111111] bg-gray-50 text-[#111111]'
                  : 'border-gray-100 bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Montant + référence */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="paymenteditor-montant-recu" className="block text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Montant reçu</label>
          <input id="paymenteditor-montant-recu"
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder={totalPrice.toString()}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/20"
          />
        </div>
        <div>
          <label htmlFor="payment-reference" className="block text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Référence</label>
          <input
            id="payment-reference"
            type="text"
            value={ref}
            onChange={e => setRef(e.target.value)}
            placeholder="N° transaction…"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/20"
          />
        </div>
      </div>

      {/* Ce qu'il y a à encaisser. Les frais du retour n'y figuraient pas : le
          gérant réclamait la location, et les km ou le retard restaient dans un
          coin de sa tête. */}
      {(feesTotal > 0 || inReceivables > 0) && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Location</span>
            <span className="font-semibold text-gray-700">{formatPrice(totalPrice)}</span>
          </div>
          {inReceivables > 0 && (
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Dont placé en créance</span>
              <span className="font-semibold text-gray-700">− {formatPrice(inReceivables)}</span>
            </div>
          )}
          {fees.map(f => (
            <div key={f.label} className="flex items-center justify-between text-xs text-gray-500">
              <span>{f.label}</span>
              <span className="font-semibold text-gray-700">{formatPrice(f.amount)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-1.5 border-t border-gray-200">
            <span className="text-sm font-bold text-gray-900">
              {inReceivables > 0 ? 'À encaisser ici' : 'Total dû'}
            </span>
            <span className="text-sm font-black text-gray-900">{formatPrice(totalDu)}</span>
          </div>
        </div>
      )}

      {/* Reste à payer, frais compris */}
      {recu > 0 && reste > 0 && (
        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-orange-50 border border-orange-100">
          <span className="text-sm font-semibold text-orange-700">Reste à payer</span>
          <span className="text-base font-bold text-orange-700">{formatPrice(reste)}</span>
        </div>
      )}
      {recu > 0 && reste === 0 && feesTotal > 0 && (
        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-green-50 border border-green-100">
          <span className="text-sm font-semibold text-green-700">Tout est soldé</span>
          <span className="text-base font-bold text-green-700">{formatPrice(totalDu)}</span>
        </div>
      )}

      {/* La ventilation est montrée, pas cachée : c'est elle qui part en
          comptabilité, la location d'un côté, les frais de l'autre. */}
      {feesTotal > 0 && recu > 0 && (
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Dont {formatPrice(partLocation)} sur la location et {formatPrice(partFrais)} sur les frais de restitution.
        </p>
      )}

      {errorMsg && (
        <div className="px-3 py-2 rounded-xl text-sm text-red-600 bg-red-50 border border-red-100">{errorMsg}</div>
      )}
      <button type="button"
        onClick={handleSave}
        disabled={loading}
        className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
          saved
            ? 'bg-green-100 text-green-700'
            : 'bg-[#111111] text-white hover:bg-gray-800 disabled:opacity-50'
        }`}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
        {loading ? 'Enregistrement…' : saved ? 'Enregistré ✓' : 'Enregistrer le paiement'}
      </button>
    </div>
  )
}
