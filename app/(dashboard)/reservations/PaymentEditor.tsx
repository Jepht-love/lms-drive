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
  { value: 'partiel',    label: 'Partiel',      description: 'Paiement partiel reçu',   color: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
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
}

export default function PaymentEditor({ reservationId, totalPrice, currentStatus, currentMethod, currentAmount, currentRef }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<PaymentStatus>(currentStatus ?? 'en_attente')
  const [method, setMethod] = useState<PaymentMethodType | ''>(currentMethod ?? '')
  const [amount, setAmount] = useState(currentAmount?.toString() ?? totalPrice.toString())
  const [ref, setRef] = useState(currentRef ?? '')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const current = PAYMENT_STATUSES.find(s => s.value === status) ?? PAYMENT_STATUSES[0]

  async function handleSave() {
    setLoading(true)
    setSaved(false)
    setErrorMsg(null)
    const result = await updatePaymentInfo(reservationId, {
      payment_status: status,
      payment_method: method || null,
      payment_amount: amount ? Number(amount) : null,
      payment_ref: ref || null,
      payment_date: status === 'paye' || status === 'partiel' ? new Date().toISOString() : null,
    })
    setLoading(false)
    if (result?.error) {
      setErrorMsg(result.error)
      return
    }
    setSaved(true)
    setTimeout(() => { setSaved(false); router.refresh() }, 1500)
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
            <button
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
            <button
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
          <label className="block text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Montant reçu</label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder={totalPrice.toString()}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/20"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Référence</label>
          <input
            type="text"
            value={ref}
            onChange={e => setRef(e.target.value)}
            placeholder="N° transaction…"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/20"
          />
        </div>
      </div>

      {/* Reste à payer */}
      {Number(amount) > 0 && Number(amount) < totalPrice && (
        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-orange-50 border border-orange-100">
          <span className="text-sm font-semibold text-orange-700">Reste à payer</span>
          <span className="text-base font-bold text-orange-700">{formatPrice(totalPrice - Number(amount))}</span>
        </div>
      )}

      {errorMsg && (
        <div className="px-3 py-2 rounded-xl text-sm text-red-600 bg-red-50 border border-red-100">{errorMsg}</div>
      )}
      <button
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
