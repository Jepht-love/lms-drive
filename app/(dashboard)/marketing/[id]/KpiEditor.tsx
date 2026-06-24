'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Pencil, Check, X, Loader2, BarChart3 } from 'lucide-react'

interface Props {
  campaignId: string
  prospects: number
  reservations: number
  revenue: number
  observations: string | null
}

export default function KpiEditor({ campaignId, prospects, reservations, revenue, observations }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [editing, setEditing] = useState(false)
  const [p, setP] = useState(String(prospects ?? 0))
  const [r, setR] = useState(String(reservations ?? 0))
  const [rev, setRev] = useState(String(revenue ?? 0))
  const [obs, setObs] = useState(observations ?? '')
  const [loading, setLoading] = useState(false)

  async function save() {
    setLoading(true)
    await supabase.from('campaigns').update({
      prospects_count:    parseInt(p, 10) || 0,
      reservations_count: parseInt(r, 10) || 0,
      revenue_generated:  parseFloat(rev.replace(',', '.')) || 0,
      observations:       obs.trim() || null,
    }).eq('id', campaignId)
    setLoading(false)
    setEditing(false)
    router.refresh()
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors"
      >
        <Pencil className="w-4 h-4" /> Saisir / modifier les KPI (prospects · réservations · CA)
      </button>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
        <BarChart3 className="w-3.5 h-3.5" /> Saisie ROI / KPI
      </p>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Prospects" value={p} onChange={setP} />
        <Field label="Réservations" value={r} onChange={setR} />
        <Field label="CA généré (€)" value={rev} onChange={setRev} />
      </div>
      <div>
        <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-wide mb-1">Observations</label>
        <textarea
          value={obs}
          onChange={e => setObs(e.target.value)}
          rows={2}
          placeholder="Bilan, apprentissages…"
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#111111] text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Enregistrer
        </button>
        <button
          onClick={() => { setP(String(prospects ?? 0)); setR(String(reservations ?? 0)); setRev(String(revenue ?? 0)); setObs(observations ?? ''); setEditing(false) }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Annuler
        </button>
      </div>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-wide mb-1">{label}</label>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-2.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
      />
    </div>
  )
}
