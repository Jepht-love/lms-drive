'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Check, Loader2 } from 'lucide-react'

const fmt = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

const SEIZURE = ['saisie_partielle', 'saisie_totale', 'litigieuse']

interface Props {
  reservationId: string
  depositAmount: number
  depositDeducted: number
  status: string
}

/** Saisie du montant retenu sur la caution + répartition CA / restitué. */
export default function DepositSettlement({ reservationId, depositAmount, depositDeducted, status }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const locked = status === 'saisie_totale' // saisie totale → tout est retenu
  const [amount, setAmount] = useState(String(locked ? depositAmount : depositDeducted || 0))
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  if (!SEIZURE.includes(status)) return null

  const retenu = locked
    ? depositAmount
    : Math.min(Math.max(parseFloat(amount.replace(',', '.')) || 0, 0), depositAmount)
  const restitue = Math.max(depositAmount - retenu, 0)

  async function save() {
    setLoading(true)
    await supabase.from('reservations').update({ deposit_deducted: retenu }).eq('id', reservationId)
    setLoading(false)
    setSaved(true)
    router.refresh()
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-50 space-y-3">
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Règlement de la caution</p>

      {!locked && (
        <div>
          <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-wide mb-1">Montant retenu (€)</label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            min={0}
            max={depositAmount}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-red-50 border border-red-100 p-2.5 text-center">
          <p className="text-[10px] font-bold uppercase text-red-400">Retenu (CA)</p>
          <p className="text-base font-black text-red-700">{fmt(retenu)}</p>
        </div>
        <div className="rounded-xl bg-green-50 border border-green-100 p-2.5 text-center">
          <p className="text-[10px] font-bold uppercase text-green-500">Restitué client</p>
          <p className="text-base font-black text-green-700">{fmt(restitue)}</p>
        </div>
      </div>

      <button
        onClick={save}
        disabled={loading}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#111111] text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
        {saved ? 'Enregistré' : 'Enregistrer le montant retenu'}
      </button>

      <p className="text-[11px] text-gray-400 leading-snug">
        Le montant retenu est comptabilisé en chiffre d'affaires ; le reste est restitué au client.
      </p>
    </div>
  )
}
