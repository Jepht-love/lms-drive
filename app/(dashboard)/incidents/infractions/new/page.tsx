'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, UserCheck, UserCog, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { INFRACTION_TYPES } from '@/lib/incidents'
import { lookupDriver, createInfraction } from '@/lib/actions/incidents'

interface Vehicle { id: string; plate: string; brand: string; model: string }
interface Driver {
  type: 'client' | 'internal'
  reservationId?: string
  client?: { id: string; first_name: string; last_name: string } | null
  internalUser?: { id: string; full_name: string } | null
}

export default function NewInfractionPage() {
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
      const res = await createInfraction(fd)
      if (res?.error) setError(res.error)
      else router.push(`/incidents/infractions/${res.id}`)
    })
  }

  const input = 'w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 focus:outline-none focus:border-gray-400 transition-colors'
  const label = 'block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5'

  return (
    <div className="space-y-4 pb-4">
      <Link href="/incidents/infractions" className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Retour
      </Link>
      <h1 className="text-xl font-black text-gray-900">Déclarer une infraction</h1>

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
              <label className={label} htmlFor="infraction_date">Date de l'infraction</label>
              <input id="infraction_date" name="infraction_date" type="date" required className={input}
                value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          {/* Conducteur identifié automatiquement */}
          {vehicleId && date && (
            <div className={`rounded-xl border p-3 flex items-center gap-2.5 text-sm ${
              driverLoading ? 'border-gray-200 bg-gray-50 text-gray-400'
              : driver?.type === 'client' ? 'border-blue-200 bg-blue-50 text-blue-800'
              : driver?.type === 'internal' ? 'border-purple-200 bg-purple-50 text-purple-800'
              : 'border-orange-200 bg-orange-50 text-orange-800'
            }`}>
              {driverLoading ? <>Recherche du conducteur…</>
              : driver?.type === 'client' ? <><UserCheck className="w-4 h-4 flex-shrink-0" /> Responsable : <b>{driver.client?.first_name} {driver.client?.last_name}</b> (client)</>
              : driver?.type === 'internal' ? <><UserCog className="w-4 h-4 flex-shrink-0" /> Utilisation interne : <b>{driver.internalUser?.full_name}</b></>
              : <><AlertTriangle className="w-4 h-4 flex-shrink-0" /> Aucune location trouvée — véhicule interne, vérifier Gestion des déplacements</>}
            </div>
          )}

          <div>
            <label className={label} htmlFor="type">Type d'infraction</label>
            <select id="type" name="type" defaultValue="exces_vitesse" className={input}>
              {INFRACTION_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="amount">Montant (€)</label>
              <input id="amount" name="amount" type="number" step="0.01" min="0" placeholder="0" className={input} inputMode="decimal" />
            </div>
            <div>
              <label className={label} htmlFor="points_lost">Points retirés</label>
              <input id="points_lost" name="points_lost" type="number" min="0" placeholder="0" className={input} inputMode="numeric" />
            </div>
            <div>
              <label className={label} htmlFor="reception_date">Date de réception de l'avis</label>
              <input id="reception_date" name="reception_date" type="date" className={input} />
            </div>
            <div>
              <label className={label} htmlFor="admin_fees">Frais de dossier LMS (€)</label>
              <input id="admin_fees" name="admin_fees" type="number" step="0.01" min="0" placeholder="0" className={input} inputMode="decimal" />
            </div>
          </div>

          <div>
            <label className={label} htmlFor="notes">Notes</label>
            <textarea id="notes" name="notes" rows={3} placeholder="Notes complémentaires…" className={`${input} resize-none`} />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}

        <button type="submit" disabled={pending}
          className="w-full py-3.5 bg-[#111111] text-white rounded-2xl font-bold text-sm hover:bg-gray-800 transition-colors active:scale-[.99] disabled:opacity-40">
          {pending ? 'Enregistrement…' : 'Enregistrer l\'infraction'}
        </button>
      </form>
    </div>
  )
}
