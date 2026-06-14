'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createAccident as createIncident, updateAccidentStatus as updateIncidentStatus } from '@/lib/actions/incidents'
import { formatDate } from '@/lib/utils'
import { Plus, AlertTriangle } from 'lucide-react'
import Drawer from '@/components/Drawer'

interface Vehicle { id: string; plate: string; brand: string; model: string }
interface Incident {
  id: string; vehicle_id: string; description: string; status: string
  created_at: string; vehicle: { plate: string; brand: string; model: string } | null
}

const STATUS_COLORS: Record<string, string> = {
  ouvert: 'bg-red-100 text-red-700',
  en_cours: 'bg-amber-100 text-amber-700',
  resolu: 'bg-green-100 text-green-700',
  litigieux: 'bg-purple-100 text-purple-700',
  classe: 'bg-slate-100 text-slate-600',
}

const STATUSES = ['ouvert', 'en_cours', 'resolu', 'litigieux', 'classe']

export default function IncidentsClient({ incidents, vehicles }: { incidents: Incident[]; vehicles: Vehicle[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleCreate(formData: FormData) {
    setLoading(true); setError(null)
    const result = await createIncident(formData)
    if (result?.error) { setError(result.error); setLoading(false); return }
    setShowForm(false); setLoading(false)
    router.refresh()
  }

  async function handleStatusChange(id: string, status: string) {
    await updateIncidentStatus(id, status)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => setShowForm(true)}
        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors text-sm"
      >
        <Plus className="w-4 h-4" /> Signaler un incident
      </button>

      {incidents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Aucun incident signalé</p>
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map(i => (
            <div key={i.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-bold text-slate-900 text-sm">{i.vehicle?.plate}</span>
                    <span className="text-xs text-slate-400">{i.vehicle?.brand} {i.vehicle?.model}</span>
                  </div>
                  <p className="text-sm text-slate-700">{i.description}</p>
                  <p className="text-xs text-slate-400 mt-1.5">{formatDate(i.created_at)}</p>
                </div>
                <select
                  value={i.status}
                  onChange={e => handleStatusChange(i.id, e.target.value)}
                  className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border-0 cursor-pointer ${STATUS_COLORS[i.status]}`}
                >
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      <Drawer open={showForm} onClose={() => setShowForm(false)} title="Signaler un incident">
        <form action={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Véhicule *</label>
            <select name="vehicle_id" required className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm bg-white">
              <option value="">— Choisir —</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description *</label>
            <textarea name="description" required rows={4} placeholder="Décrivez l'incident..." className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm resize-none" />
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</div>}
          <button type="submit" disabled={loading} className="w-full py-3 bg-[#111111] text-white rounded-xl font-semibold disabled:opacity-50 transition-colors active:scale-[.97]">
            {loading ? 'Enregistrement...' : 'Signaler'}
          </button>
        </form>
      </Drawer>
    </div>
  )
}
