'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Loader2 } from 'lucide-react'
import { resolveVehicleIssue } from '@/lib/actions/vehicle-issues'
import type { MaintenanceFlag } from '@/types/database'

const SEV_CLS: Record<MaintenanceFlag['severity'], string> = {
  attention: 'bg-orange-100 text-orange-700',
  rayure:    'bg-yellow-100 text-yellow-700',
  dommage:   'bg-red-100 text-red-700',
}

/**
 * Une ligne de dommage soldable. Le bouton « Résoudre » ouvre un mini-formulaire
 * (prix payé + date + note de réparation). Solder retire le dommage et, si un
 * montant > 0 est saisi, crée la dépense compta liée au véhicule. Tant qu'un
 * dommage n'est pas soldé, il reste affiché (badge « Intervenir »), même véhicule
 * reloué. Partagé par la fiche véhicule et la page entretien.
 */
export default function ResolveDamageRow({ vehicleId, flag }: { vehicleId: string; flag: MaintenanceFlag }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function submit() {
    start(async () => {
      setErr(null)
      const raw = amount.trim() ? parseFloat(amount.replace(',', '.')) : 0
      const amt = Number.isFinite(raw) && raw > 0 ? raw : 0
      const res = await resolveVehicleIssue(vehicleId, flag.id, { amount: amt, date, note: note.trim() || null })
      if (res && 'error' in res && res.error) { setErr(res.error); return }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="rounded-xl bg-gray-50 p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${SEV_CLS[flag.severity] ?? 'bg-gray-100 text-gray-700'}`}>
            {flag.severity}
          </span>
          <span className="text-sm text-gray-700 truncate">{flag.label}</span>
          {flag.source === 'manuel' && <span className="text-[10px] text-gray-400 flex-shrink-0">· manuel</span>}
        </div>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            disabled={pending}
            className="text-xs font-semibold text-gray-500 hover:text-green-600 flex items-center gap-1 flex-shrink-0 disabled:opacity-40"
          >
            <Check className="w-3.5 h-3.5" /> Résoudre
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2 space-y-2 border-t border-gray-100 pt-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] text-gray-400 mb-0.5">Prix payé (€)</label>
              <input
                inputMode="decimal"
                autoFocus
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] text-gray-400 mb-0.5">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-gray-400 mb-0.5">Réparation effectuée (note)</label>
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Ex : remplacement pare-choc AV"
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => { setOpen(false); setErr(null) }}
              disabled={pending}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 disabled:opacity-40 flex items-center justify-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Annuler
            </button>
            <button
              onClick={submit}
              disabled={pending}
              className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 flex items-center justify-center gap-1"
            >
              {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Solder
            </button>
          </div>
          <p className="text-[10px] text-gray-400">Un montant &gt; 0 crée une dépense liée au véhicule (Rentabilité / compta).</p>
        </div>
      )}
    </div>
  )
}
