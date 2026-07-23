'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { startTrip, endTrip, planTrip, startPlannedTrip, assignTrip, deleteTrip } from '@/lib/actions/internal-trips'
import { useToast } from '@/components/Toast'
import { formatDateTime, formatPrice } from '@/lib/utils'
import { Plus, Navigation, Clock, CheckCircle2, CalendarClock, UserPlus, Play, Trash2, User, Search } from 'lucide-react'
import Drawer from '@/components/Drawer'

interface Vehicle { id: string; plate: string; brand: string; model: string; current_km: number }
interface Member { id: string; full_name: string; role: string }
interface Trip {
  id: string; vehicle_id: string; user_id: string | null
  start_datetime: string; end_datetime: string | null
  status: 'planifie' | 'en_cours' | 'termine' | 'annule'
  purpose: string; purpose_notes: string | null
  km_start: number | null; km_end: number | null
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

export default function InternalTripsClient({ vehicles, trips, members, isManager, currentUserId }: {
  vehicles: Vehicle[]
  trips: Trip[]
  members: Member[]
  isManager: boolean
  currentUserId: string
}) {
  const router = useRouter()
  const { show } = useToast()
  const [showStartForm, setShowStartForm] = useState(false)
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [endingTrip, setEndingTrip] = useState<Trip | null>(null)
  const [startingPlanned, setStartingPlanned] = useState<Trip | null>(null)
  const [assigningTrip, setAssigningTrip] = useState<Trip | null>(null)
  const [deletingTrip, setDeletingTrip] = useState<Trip | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  // Filtre local : pas d'URL par trajet (gérés en drawer), donc recherche en mémoire.
  const q = search.trim().toLowerCase()
  const matchTrip = (t: Trip) =>
    !q || [t.vehicle?.plate, t.vehicle?.brand, t.vehicle?.model, t.purpose, t.purpose_notes, t.user?.full_name]
      .filter(Boolean).join(' ').toLowerCase().includes(q)

  const plannedTrips   = trips.filter(t => t.status === 'planifie' && matchTrip(t))
  const activeTrips     = trips.filter(t => t.status === 'en_cours' && matchTrip(t))
  const completedTrips = trips.filter(t => t.status === 'termine' && matchTrip(t))

  const vehicleById = (id: string) => vehicles.find(v => v.id === id) ?? null
  const canManageTrip = (t: Trip) => isManager || t.user_id === currentUserId

  function reset() {
    setShowStartForm(false); setShowPlanForm(false)
    setEndingTrip(null); setStartingPlanned(null); setAssigningTrip(null); setDeletingTrip(null)
    setSelectedVehicle(null); setError(null); setLoading(false)
  }

  async function run(fn: () => Promise<{ error?: string; success?: boolean } | undefined>, okMsg: string) {
    setLoading(true); setError(null)
    const result = await fn()
    if (result?.error) { setError(result.error); setLoading(false); return }
    show(okMsg, 'success'); reset(); router.refresh()
  }

  const handleStart        = (fd: FormData) => { run(() => startTrip(fd), 'Déplacement démarré') }
  const handlePlan          = (fd: FormData) => { run(() => planTrip(fd), 'Déplacement planifié') }
  const handleEnd           = (fd: FormData) => { if (endingTrip) run(() => endTrip(endingTrip.id, fd), 'Déplacement terminé') }
  const handleStartPlanned = (fd: FormData) => { if (startingPlanned) run(() => startPlannedTrip(startingPlanned.id, fd), 'Déplacement démarré') }

  async function handleAssign(fd: FormData) {
    if (!assigningTrip) return
    const userId = fd.get('user_id') as string
    if (!userId) { setError('Choisissez un conducteur'); return }
    run(() => assignTrip(assigningTrip.id, userId), 'Déplacement assigné')
  }

  function handleDelete() {
    if (deletingTrip) run(() => deleteTrip(deletingTrip.id), 'Déplacement supprimé')
  }

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setShowPlanForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-900 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm"
        >
          <CalendarClock className="w-4 h-4" /> Planifier un déplacement
        </button>
        <button
          onClick={() => setShowStartForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#111111] text-white rounded-xl font-medium hover:bg-gray-800 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" /> Démarrer maintenant
        </button>
      </div>

      {/* Recherche locale */}
      {trips.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Véhicule, motif ou conducteur…"
            autoComplete="off"
            className="w-full bg-white border border-gray-100 shadow-sm rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>
      )}

      {/* Planned trips */}
      {plannedTrips.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-blue-500" /> Planifiés ({plannedTrips.length})
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {plannedTrips.map(t => (
              <div key={t.id} className="bg-white rounded-2xl border-2 border-blue-100 shadow-sm p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-gray-900">{t.vehicle?.plate}</p>
                    <p className="text-xs text-gray-500">{t.vehicle?.brand} {t.vehicle?.model}</p>
                  </div>
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium capitalize">
                    {t.purpose}
                  </span>
                </div>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <CalendarClock className="w-3.5 h-3.5" /> {formatDateTime(t.start_datetime)}
                </p>
                <p className="text-xs mt-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                  {t.user?.full_name
                    ? <span className="text-gray-600">{t.user.full_name}</span>
                    : <span className="text-amber-600 font-medium">Non assigné</span>}
                </p>
                {t.purpose_notes && <p className="text-xs text-gray-400 mt-1">{t.purpose_notes}</p>}

                <div className="mt-3 flex gap-2">
                  {!t.user_id && isManager && (
                    <button
                      onClick={() => { setAssigningTrip(t); setError(null) }}
                      className="flex-1 py-2 bg-[#111111] text-white rounded-xl text-sm font-medium hover:bg-gray-900 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <UserPlus className="w-4 h-4" /> Assigner
                    </button>
                  )}
                  {t.user_id && canManageTrip(t) && (
                    <button
                      onClick={() => { setStartingPlanned(t); setSelectedVehicle(vehicleById(t.vehicle_id)); setError(null) }}
                      className="flex-1 py-2 bg-[#111111] text-white rounded-xl text-sm font-medium hover:bg-gray-900 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Play className="w-4 h-4" /> Démarrer
                    </button>
                  )}
                  {canManageTrip(t) && (
                    <button
                      onClick={() => { setDeletingTrip(t); setError(null) }}
                      className="px-3 py-2 border border-gray-200 text-gray-500 rounded-xl text-sm font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                {t.km_start != null && <p className="text-xs text-gray-400">KM départ : {t.km_start.toLocaleString('fr-FR')}</p>}
                {t.user?.full_name && <p className="text-xs text-gray-400">Conducteur : {t.user.full_name}</p>}
                {canManageTrip(t) && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setEndingTrip(t)}
                      className="flex-1 py-2 bg-[#111111] text-white rounded-xl text-sm font-medium hover:bg-gray-900 transition-colors"
                    >
                      Terminer le déplacement
                    </button>
                    <button
                      onClick={() => { setDeletingTrip(t); setError(null) }}
                      className="px-3 py-2 border border-gray-200 text-gray-500 rounded-xl text-sm font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
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
            <p className="text-gray-500 text-sm">{q ? 'Aucun déplacement terminé ne correspond' : 'Aucun déplacement terminé'}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
            {completedTrips.map(t => {
              const distance = t.km_end != null && t.km_start != null ? t.km_end - t.km_start : 0
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
                  {canManageTrip(t) && (
                    <button
                      onClick={() => { setDeletingTrip(t); setError(null) }}
                      className="flex-shrink-0 p-2 text-gray-300 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Plan Drawer */}
      <Drawer open={showPlanForm} onClose={reset} title="Planifier un déplacement">
        <form action={handlePlan} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Véhicule *</label>
            <select name="vehicle_id" required className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm bg-white">
              <option value="">— Choisir —</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Date et heure *</label>
            <input type="datetime-local" name="start_datetime" required className="w-full min-w-0 px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm bg-white" />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Motif *</label>
            <select name="purpose" required className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm bg-white">
              {PURPOSES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          {isManager ? (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Conducteur</label>
              <select name="user_id" defaultValue="none" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm bg-white">
                <option value="none">— Non assigné —</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">Laissez « Non assigné » pour attribuer plus tard.</p>
            </div>
          ) : (
            <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">Ce déplacement vous sera assigné.</p>
          )}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Notes</label>
            <input type="text" name="purpose_notes" placeholder="Détails..." enterKeyHint="done" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm" />
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</div>}
          <p className="text-[11px] text-gray-400">* Champ obligatoire</p>
          <button type="submit" disabled={loading} className="w-full py-3 bg-[#111111] text-white rounded-xl font-semibold disabled:opacity-50 transition-colors active:scale-[.97]">
            {loading ? 'Planification...' : 'Planifier'}
          </button>
        </form>
      </Drawer>

      {/* Assign Drawer */}
      <Drawer open={!!assigningTrip} onClose={reset} title={`Assigner — ${assigningTrip?.vehicle?.plate ?? ''}`}>
        <form action={handleAssign} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Conducteur *</label>
            <select name="user_id" required defaultValue="" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm bg-white">
              <option value="">— Choisir —</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</div>}
          <button type="submit" disabled={loading} className="w-full py-3 bg-[#111111] text-white rounded-xl font-semibold disabled:opacity-50 transition-colors active:scale-[.97]">
            {loading ? 'Assignation...' : 'Assigner'}
          </button>
        </form>
      </Drawer>

      {/* Start-planned Drawer */}
      <Drawer open={!!startingPlanned} onClose={reset} title={`Démarrer — ${startingPlanned?.vehicle?.plate ?? ''}`}>
        <form action={handleStartPlanned} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
              KM départ * {selectedVehicle && <span className="text-gray-400 font-normal">(actuel: {selectedVehicle.current_km?.toLocaleString('fr-FR') ?? '—'})</span>}
            </label>
            <input type="number" name="km_start" required defaultValue={selectedVehicle?.current_km} inputMode="numeric" enterKeyHint="next" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Autonomie carburant (km)</label>
            <input type="number" name="fuel_start" min="0" placeholder="Autonomie en km" inputMode="numeric" enterKeyHint="done" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm" />
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</div>}
          <button type="submit" disabled={loading} className="w-full py-3 bg-[#111111] text-white rounded-xl font-semibold disabled:opacity-50 transition-colors active:scale-[.97]">
            {loading ? 'Démarrage...' : 'Démarrer le déplacement'}
          </button>
        </form>
      </Drawer>

      {/* Start Drawer (immédiat) */}
      <Drawer open={showStartForm} onClose={reset} title="Démarrer un déplacement">
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
          {isManager && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Conducteur</label>
              <select name="user_id" defaultValue={currentUserId} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm bg-white">
                {members.map(m => <option key={m.id} value={m.id}>{m.full_name}{m.id === currentUserId ? ' (moi)' : ''}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
              KM départ * {selectedVehicle && <span className="text-gray-400 font-normal">(actuel: {selectedVehicle.current_km?.toLocaleString('fr-FR') ?? '—'})</span>}
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
      <Drawer open={!!endingTrip} onClose={reset} title={`Terminer — ${endingTrip?.vehicle?.plate ?? ''}`}>
        <form action={handleEnd} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
              KM retour * <span className="text-gray-400 font-normal">(départ: {endingTrip?.km_start?.toLocaleString('fr-FR') ?? '—'})</span>
            </label>
            <input type="number" name="km_end" required min={endingTrip?.km_start ?? undefined} defaultValue={endingTrip?.km_start ?? undefined} inputMode="numeric" enterKeyHint="next" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm font-bold" />
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

      {/* Delete confirmation Drawer */}
      <Drawer open={!!deletingTrip} onClose={reset} title="Supprimer le déplacement">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Supprimer définitivement ce déplacement{deletingTrip?.vehicle?.plate ? ` (${deletingTrip.vehicle.plate})` : ''} ?
            {deletingTrip?.status === 'termine' && ' Les charges de péages/frais liées seront aussi retirées de la comptabilité.'}
          </p>
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</div>}
          <div className="flex gap-2">
            <button onClick={reset} disabled={loading} className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50">
              Annuler
            </button>
            <button onClick={handleDelete} disabled={loading} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 active:scale-[.97]">
              {loading ? 'Suppression...' : 'Supprimer'}
            </button>
          </div>
        </div>
      </Drawer>
    </div>
  )
}
