'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { startTrip, endTrip } from '@/lib/actions/internal-trips'
import { useToast } from '@/components/Toast'
import { formatDateTime, formatPrice } from '@/lib/utils'
import { Plus, Navigation, Clock, CheckCircle2 } from 'lucide-react'
import Drawer from '@/components/Drawer'

interface Vehicle { id: string; plate: string; brand: string; model: string; current_km: number }
interface Trip {
  id: string; vehicle_id: string; user_id: string
  start_datetime: string; end_datetime: string | null
  purpose: string; purpose_notes: string | null
  km_start: number; km_end: number | null
  fuel_start: number | null; fuel_end: number | null
  tolls_amount: number | null; expenses_amount: number | null
  vehicle: { plate: string; brand: string; model: string } | null
  user: { full_name: string } | null
}

const PURPOSES = [
  { value: 'livraison', label: 'Livraison' },
  { value: 'recuperation', label: 'Récupération' },
  { value: 'garage', label: 'Garage' },
  { value: 'preparation', label: 'Préparation' },
  { value: 'personnel', label: 'Personnel' },
  { value: 'autre', label: 'Autre' },
]

export default function InternalTripsClient({ vehicles, trips, isManager, currentUserId }: {
  vehicles: Vehicle[]
  trips: Trip[]
  isManager: boolean
  currentUserId: string
}) {
  const router = useRouter()
  const { show } = useToast()
  const [showStartForm, setShowStartForm] = useState(false)
  const [endingTrip, setEndingTrip] = useState<Trip | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const activeTrips = trips.filter(t => !t.end_datetime)
  const completedTrips = trips.filter(t => t.end_datetime)

  async function handleStart(formData: FormData) {
    setLoading(true); setError(null)
    const result = await startTrip(formData)
    if (result?.error) { setError(result.error); setLoading(false); return }
    show('Déplacement démarré', 'success')
    setShowStartForm(false); setSelectedVehicle(null); setLoading(false)
    router.refresh()
  }

  async function handleEnd(formData: FormData) {
    if (!endingTrip) return
    setLoading(true); setError(null)
    const result = await endTrip(endingTrip.id, formData)
    if (result?.error) { setError(result.error); setLoading(false); return }
    show('Déplacement terminé', 'success')
    setEndingTrip(null); setLoading(false)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Action */}
      <button
        onClick={() => setShowStartForm(true)}
        className="flex items-center gap-2 px-4 py-2.5 bg-[#111111] text-white rounded-xl font-medium hover:bg-gray-800 transition-colors text-sm"
      >
        <Plus className="w-4 h-4" /> Démarrer un déplacement
      </button>

      {/* Active trips */}
      {activeTrips.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-green-500" /> En cours ({activeTrips.length})
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {activeTrips.map(t => (
              <div key={t.id} className="bg-white rounded-2xl border-2 border-green-200 shadow-sm p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-gray-900">{t.vehicle?.plate}</p>
                    <p className="text-xs text-gray-500">{t.vehicle?.brand} {t.vehicle?.model}</p>
                  </div>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium capitalize">
                    {t.purpose}
                  </span>
                </div>
                <p className="text-xs text-gray-400">Depuis {formatDateTime(t.start_datetime)}</p>
                <p className="text-xs text-gray-400">KM départ : {t.km_start.toLocaleString('fr-FR')}</p>
                {(isManager || t.user_id === currentUserId) && (
                  <button
                    onClick={() => setEndingTrip(t)}
                    className="mt-3 w-full py-2 bg-[#111111] text-white rounded-xl text-sm font-medium hover:bg-gray-900 transition-colors"
                  >
                    Terminer le déplacement
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      <div>
        <h3 className="font-semibold text-gray-800 mb-3">Historique</h3>
        {completedTrips.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <Navigation className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Aucun déplacement terminé</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
            {completedTrips.map(t => {
              const distance = t.km_end ? t.km_end - t.km_start : 0
              return (
                <div key={t.id} className="flex items-center gap-4 px-4 py-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 text-sm">{t.vehicle?.plate}</p>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{t.purpose}</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {t.user?.full_name} · {formatDateTime(t.start_datetime)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">{distance} km</p>
                    {(t.tolls_amount || t.expenses_amount) && (
                      <p className="text-xs text-gray-400">
                        {formatPrice((t.tolls_amount ?? 0) + (t.expenses_amount ?? 0))}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Start Drawer */}
      <Drawer open={showStartForm} onClose={() => setShowStartForm(false)} title="Démarrer un déplacement">
        <form action={handleStart} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Véhicule *</label>
            <select
              name="vehicle_id"
              required
              onChange={e => setSelectedVehicle(vehicles.find(v => v.id === e.target.value) ?? null)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm bg-white"
            >
              <option value="">— Choisir —</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Motif *</label>
            <select name="purpose" required className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm bg-white">
              {PURPOSES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
              KM départ * {selectedVehicle && <span className="text-gray-400 font-normal">(actuel: {selectedVehicle.current_km.toLocaleString('fr-FR')})</span>}
            </label>
            <input
              type="number"
              name="km_start"
              required
              defaultValue={selectedVehicle?.current_km}
              inputMode="numeric"
              enterKeyHint="next"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Autonomie carburant (km)</label>
            <input type="number" name="fuel_start" min="0" placeholder="Autonomie en km" inputMode="numeric" enterKeyHint="next" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Notes</label>
            <input type="text" name="purpose_notes" placeholder="Détails..." enterKeyHint="done" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm" />
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</div>}
          <p className="text-[11px] text-gray-400">* Champ obligatoire</p>
          <button type="submit" disabled={loading} className="w-full py-3 bg-[#111111] text-white rounded-xl font-semibold disabled:opacity-50 transition-colors active:scale-[.97]">
            {loading ? 'Démarrage...' : 'Démarrer'}
          </button>
        </form>
      </Drawer>

      {/* End Drawer */}
      <Drawer open={!!endingTrip} onClose={() => setEndingTrip(null)} title={`Terminer — ${endingTrip?.vehicle?.plate ?? ''}`}>
        <form action={handleEnd} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
              KM retour * <span className="text-gray-400 font-normal">(départ: {endingTrip?.km_start.toLocaleString('fr-FR')})</span>
            </label>
            <input type="number" name="km_end" required min={endingTrip?.km_start} defaultValue={endingTrip?.km_start} inputMode="numeric" enterKeyHint="next" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm font-bold" />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Autonomie carburant (km)</label>
            <input type="number" name="fuel_end" min="0" placeholder="Autonomie en km" inputMode="numeric" enterKeyHint="next" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Péages (€)</label>
              <input type="number" name="tolls_amount" step="0.01" inputMode="decimal" enterKeyHint="next" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Dépenses (€)</label>
              <input type="number" name="expenses_amount" step="0.01" inputMode="decimal" enterKeyHint="done" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm" />
            </div>
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</div>}
          <p className="text-[11px] text-gray-400">* Champ obligatoire</p>
          <button type="submit" disabled={loading} className="w-full py-3 bg-[#111111] text-white rounded-xl font-semibold disabled:opacity-50 transition-colors active:scale-[.97]">
            {loading ? 'Enregistrement...' : 'Terminer le déplacement'}
          </button>
        </form>
      </Drawer>
    </div>
  )
}
