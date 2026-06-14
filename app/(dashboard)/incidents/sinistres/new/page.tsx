'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, UserCheck, UserCog, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { lookupDriver, createAccident } from '@/lib/actions/incidents'

interface Vehicle { id: string; plate: string; brand: string; model: string }
interface Driver {
  type: 'client' | 'internal'
  reservationId?: string
  client?: { id: string; first_name: string; last_name: string } | null
  internalUser?: { id: string; full_name: string } | null
}

export default function NewSinistrePage() {
  const router = useRouter()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [vehicleId, setVehicleId] = useState('')
  const [date, setDate] = useState('')
  const [driver, setDriver] = useState<Driver | null>(null)
  const [driverLoading, setDriverLoading] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const sb = createClient()
    sb.from('vehicles').select('id, plate, brand, model').eq('is_active', true).order('brand')
      .then(({ data }) => setVehicles((data as Vehicle[]) ?? []))
  }, [])

  useEffect(() => {
    if (!vehicleId || !date) { setDriver(null); return }
    setDriverLoading(true)
    lookupDriver(vehicleId, date)
      .then(r => setDriver(r as Driver | null))
      .catch(() => setDriver(null))
      .finally(() => setDriverLoading(false))
  }, [vehicleId, date])

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    if (driver?.type === 'client') {
      if (driver.client?.id) fd.set('client_id', driver.client.id)
      if (driver.reservationId) fd.set('reservation_id', driver.reservationId)
    } else if (driver?.type === 'internal' && driver.internalUser?.id) {
      fd.set('internal_user_id', driver.internalUser.id)
    }
    startTransition(async () => {
      const res = await createAccident(fd)
      if (res?.error) setError(res.error)
      else router.push(`/incidents/sinistres/${res.id}`)
    })
  }

  const input = 'w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 focus:outline-none focus:border-gray-400 transition-colors'
  const label = 'block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5'

  return (
    <div className="space-y-4 pb-4">
      <Link href="/incidents/sinistres" className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Retour
      </Link>
      <h1 className="text-xl font-black text-gray-900">Déclarer un sinistre</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="vehicle_id">Véhicule</label>
              <select id="vehicle_id" name="vehicle_id" required className={input}
                value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
                <option value="">Sélectionner…</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} · {v.brand} {v.model}</option>)}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="accident_date">Date du sinistre</label>
              <input id="accident_date" name="accident_date" type="date" required className={input}
                value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          {vehicleId && date && (
            <div className={`rounded-xl border p-3 flex items-center gap-2.5 text-sm ${
              driverLoading ? 'border-gray-200 bg-gray-50 text-gray-400'
              : driver?.type === 'client' ? 'border-blue-200 bg-blue-50 text-blue-800'
              : driver?.type === 'internal' ? 'border-purple-200 bg-purple-50 text-purple-800'
              : 'border-orange-200 bg-orange-50 text-orange-800'
            }`}>
              {driverLoading ? <>Recherche du conducteur…</>
              : driver?.type === 'client' ? <><UserCheck className="w-4 h-4 flex-shrink-0" /> Conducteur : <b>{driver.client?.first_name} {driver.client?.last_name}</b> (client)</>
              : driver?.type === 'internal' ? <><UserCog className="w-4 h-4 flex-shrink-0" /> Utilisation interne : <b>{driver.internalUser?.full_name}</b></>
              : <><AlertTriangle className="w-4 h-4 flex-shrink-0" /> Aucune location trouvée — véhicule interne, vérifier Gestion des déplacements</>}
            </div>
          )}

          <div>
            <label className={label} htmlFor="description">Description des faits</label>
            <textarea id="description" name="description" rows={3} required placeholder="Circonstances du sinistre…" className={`${input} resize-none`} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="dossier_number">N° dossier assurance</label>
              <input id="dossier_number" name="dossier_number" type="text" className={input} />
            </div>
            <div>
              <label className={label} htmlFor="repair_cost">Coût réparations (€)</label>
              <input id="repair_cost" name="repair_cost" type="number" step="0.01" min="0" placeholder="0" className={input} inputMode="decimal" />
            </div>
            <div>
              <label className={label} htmlFor="insurance_amount">Pris en charge assurance (€)</label>
              <input id="insurance_amount" name="insurance_amount" type="number" step="0.01" min="0" placeholder="0" className={input} inputMode="decimal" />
            </div>
            <div>
              <label className={label} htmlFor="deposit_retained">Retenue sur caution (€)</label>
              <input id="deposit_retained" name="deposit_retained" type="number" step="0.01" min="0" placeholder="0" className={input} inputMode="decimal" />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="insurance_covered" className="w-4 h-4 rounded" /> Couvert par l'assurance
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="client_responsibility" defaultChecked className="w-4 h-4 rounded" /> Responsabilité client
            </label>
          </div>

          <div>
            <label className={label} htmlFor="notes">Notes</label>
            <textarea id="notes" name="notes" rows={2} placeholder="Notes complémentaires…" className={`${input} resize-none`} />
          </div>

          <p className="text-[11px] text-gray-400">📷 L'upload des photos de dommages sera disponible après la création du bucket de stockage.</p>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}

        <button type="submit" disabled={pending}
          className="w-full py-3.5 bg-[#111111] text-white rounded-2xl font-bold text-sm hover:bg-gray-800 transition-colors active:scale-[.99] disabled:opacity-40">
          {pending ? 'Enregistrement…' : 'Déclarer le sinistre'}
        </button>
      </form>
    </div>
  )
}
