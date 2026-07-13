'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Check } from 'lucide-react'
import { reportVehicleIssues, resolveVehicleIssue } from '@/lib/actions/vehicle-issues'
import { useToast } from '@/components/Toast'
import type { MaintenanceFlag } from '@/types/database'

// Faits saisis à la main par le gérant/l'équipe (ex : « usure plaquette de frein »),
// stockés comme maintenance_flags (source: manuel). Ils alimentent le badge
// « Intervenir » du véhicule sans changer son statut.
const SEVERITIES: { id: MaintenanceFlag['severity']; label: string; cls: string }[] = [
  { id: 'attention', label: 'À surveiller', cls: 'bg-orange-100 text-orange-700' },
  { id: 'rayure',    label: 'Rayure',       cls: 'bg-yellow-100 text-yellow-700' },
  { id: 'dommage',   label: 'Dommage',      cls: 'bg-red-100 text-red-700' },
]

export default function VehicleFacts({ vehicleId, flags }: { vehicleId: string; flags: MaintenanceFlag[] }) {
  const router = useRouter()
  const { show: toast } = useToast()
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [severity, setSeverity] = useState<MaintenanceFlag['severity']>('attention')
  const [pending, startTransition] = useTransition()

  function add() {
    const l = label.trim()
    if (!l) return
    startTransition(async () => {
      const r = await reportVehicleIssues(vehicleId, [
        { category: 'manuel', label: l, severity, source: 'manuel', source_id: null },
      ])
      if (r?.error) { toast(r.error, 'error'); return }
      setLabel(''); setSeverity('attention'); setAdding(false)
      router.refresh()
      toast('Fait ajouté')
    })
  }

  function resolve(flagId: string) {
    startTransition(async () => {
      const r = await resolveVehicleIssue(vehicleId, flagId)
      if (r?.error) { toast(r.error, 'error'); return }
      router.refresh()
      toast('Fait résolu')
    })
  }

  const sevCls = (s: MaintenanceFlag['severity']) => SEVERITIES.find(x => x.id === s)?.cls ?? 'bg-gray-100 text-gray-700'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-900">Faits & interventions</h2>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50"
          >
            <Plus className="w-3.5 h-3.5" /> Ajouter un fait
          </button>
        )}
      </div>

      {adding && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2">
          <input
            autoFocus
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Ex : usure plaquette de frein AV"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
          <div className="flex flex-wrap gap-1.5">
            {SEVERITIES.map(s => (
              <button
                key={s.id}
                onClick={() => setSeverity(s.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${
                  severity === s.id ? `border-[#111111] ${s.cls}` : 'border-gray-200 text-gray-500'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setAdding(false); setLabel('') }}
              disabled={pending}
              className="flex-1 py-2 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 disabled:opacity-40"
            >
              Annuler
            </button>
            <button
              onClick={add}
              disabled={pending || !label.trim()}
              className="flex-1 py-2 rounded-lg text-xs font-bold bg-[#111111] text-white disabled:opacity-40"
            >
              Ajouter
            </button>
          </div>
        </div>
      )}

      {flags.length === 0 ? (
        !adding && <p className="text-xs text-gray-400">Aucun fait signalé. Ajoutez une usure ou un point à surveiller.</p>
      ) : (
        <div className="space-y-1.5">
          {flags.map(f => (
            <div key={f.id} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-gray-50">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${sevCls(f.severity)}`}>{f.severity}</span>
                <span className="text-sm text-gray-700 truncate">{f.label}</span>
                {f.source === 'manuel' && <span className="text-[10px] text-gray-400 flex-shrink-0">· manuel</span>}
              </div>
              <button
                onClick={() => resolve(f.id)}
                disabled={pending}
                className="text-xs font-semibold text-gray-500 hover:text-green-600 flex items-center gap-1 flex-shrink-0 disabled:opacity-40"
              >
                <Check className="w-3.5 h-3.5" /> Résolu
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
