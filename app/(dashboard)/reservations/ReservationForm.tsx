'use client'

import { useActionState, useState, useEffect } from 'react'
import { calculateRentalDays, calculateRentalPrice, formatPrice } from '@/lib/utils'

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface Vehicle {
  id: string; plate: string; brand: string; model: string
  daily_price: number | null; weekly_price: number | null
  deposit_amount: number | null; km_included_daily: number | null
  extra_km_price: number | null
}

interface Client {
  id: string; first_name: string; last_name: string; phone: string; status?: string
}

interface Props {
  action: (formData: FormData) => Promise<{ error: string } | void>
  vehicles: Vehicle[]
  clients: Client[]
  defaultClientId?: string
  defaultVehicleId?: string
}

export default function ReservationForm({ action, vehicles, clients, defaultClientId, defaultVehicleId }: Props) {
  const [state, formAction, pending] = useActionState(async (_prev: any, formData: FormData) => {
    return action(formData)
  }, null)

  const [selectedVehicleId, setSelectedVehicleId] = useState(defaultVehicleId ?? '')
  const [startDatetime, setStartDatetime] = useState('')
  const [endDatetime, setEndDatetime] = useState('')
  const [dailyPrice, setDailyPrice] = useState('')
  const [creatingNewClient, setCreatingNewClient] = useState(false)
  const [acompte, setAcompte] = useState('')
  const [selectedClientId, setSelectedClientId] = useState(defaultClientId ?? '')
  const [clientQuery, setClientQuery] = useState('')
  const [showClientResults, setShowClientResults] = useState(false)

  const selectedClient = clients.find(c => c.id === selectedClientId)
  const filteredClients = clientQuery.trim()
    ? clients.filter(c => {
        const q = clientQuery.trim().toLowerCase()
        return `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q)
      }).slice(0, 8)
    : []

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId)

  useEffect(() => {
    if (selectedVehicle?.daily_price) {
      setDailyPrice(selectedVehicle.daily_price.toString())
    }
  }, [selectedVehicleId, selectedVehicle])

  const days = startDatetime && endDatetime
    ? calculateRentalDays(startDatetime, endDatetime)
    : 0

  function setDuration(hours: number) {
    const start = startDatetime ? new Date(startDatetime) : new Date()
    const end = new Date(start.getTime() + hours * 3600000)
    if (!startDatetime) setStartDatetime(toDatetimeLocal(start))
    setEndDatetime(toDatetimeLocal(end))
  }

  const totalPrice = days > 0 && dailyPrice
    ? calculateRentalPrice(Number(dailyPrice), selectedVehicle?.weekly_price ?? null, days)
    : 0

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 font-medium">
          {state.error}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Vehicle + client */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="font-bold text-gray-900">Véhicule & client</h3>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Véhicule *</label>
            <select
              name="vehicle_id"
              value={selectedVehicleId}
              onChange={e => setSelectedVehicleId(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm bg-white"
            >
              <option value="">— Choisir un véhicule —</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.brand} {v.model} — {v.plate} {v.daily_price ? `(${v.daily_price}€/j)` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide">Client *</label>
              <button
                type="button"
                onClick={() => setCreatingNewClient(v => !v)}
                className="text-xs font-semibold text-gray-700 hover:underline"
              >
                {creatingNewClient ? 'Choisir un client existant' : '+ Nouveau client'}
              </button>
            </div>
            {creatingNewClient ? (
              <div className="grid grid-cols-3 gap-2">
                <input name="new_client_first_name" placeholder="Prénom" required
                  className="px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm" />
                <input name="new_client_last_name" placeholder="Nom" required
                  className="px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm" />
                <input name="new_client_phone" type="tel" placeholder="Téléphone" required
                  className="px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm" />
              </div>
            ) : (
              <div className="relative">
                <input type="hidden" name="client_id" value={selectedClientId} />
                <input
                  type="text"
                  placeholder="Rechercher par nom ou téléphone..."
                  value={selectedClient ? `${selectedClient.first_name} ${selectedClient.last_name} — ${selectedClient.phone}` : clientQuery}
                  onChange={e => { setSelectedClientId(''); setClientQuery(e.target.value); setShowClientResults(true) }}
                  onFocus={() => setShowClientResults(true)}
                  onBlur={() => setTimeout(() => {
                    if (!selectedClientId) setClientQuery('')
                    setShowClientResults(false)
                  }, 150)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm bg-white"
                />
                {showClientResults && filteredClients.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                    {filteredClients.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        disabled={c.status === 'blackliste'}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { setSelectedClientId(c.id); setClientQuery(''); setShowClientResults(false) }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
                      >
                        {c.status === 'blackliste' ? '⚠ ' : ''}{c.first_name} {c.last_name} — {c.phone}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Dates */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="font-bold text-gray-900">Dates</h3>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Départ *</label>
            <input
              type="datetime-local"
              name="start_datetime"
              value={startDatetime}
              onChange={e => setStartDatetime(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Retour *</label>
            <input
              type="datetime-local"
              name="end_datetime"
              value={endDatetime}
              onChange={e => setEndDatetime(e.target.value)}
              required
              min={startDatetime}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setDuration(24)} className="flex-1 px-2 py-2 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
              24h (1 jour)
            </button>
            <button type="button" onClick={() => setDuration(72)} className="flex-1 px-2 py-2 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
              72h (3 jours)
            </button>
            <button type="button" onClick={() => setDuration(168)} className="flex-1 px-2 py-2 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
              168h (1 semaine)
            </button>
          </div>
          {days > 0 && (
            <p className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
              Durée : <strong>{days} jour{days > 1 ? 's' : ''}</strong>
            </p>
          )}
        </div>
      </div>

      {/* Tarification */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-900 mb-4">Tarification</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Prix/jour (€) *</label>
            <input
              type="number"
              name="daily_price"
              value={dailyPrice}
              onChange={e => setDailyPrice(e.target.value)}
              required
              step="0.01"
              min="0"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">KM inclus/jour</label>
            <input
              type="number"
              name="km_included"
              defaultValue={selectedVehicle?.km_included_daily?.toString() ?? ''}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Supplément KM (€/km)</label>
            <input
              type="number"
              name="extra_km_price"
              defaultValue={selectedVehicle?.extra_km_price?.toString() ?? ''}
              step="0.01"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Caution (€)</label>
            <input
              type="number"
              name="deposit_amount"
              defaultValue={selectedVehicle?.deposit_amount?.toString() ?? ''}
              step="0.01"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Mode caution</label>
            <select
              name="deposit_method"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm bg-white"
            >
              <option value="">— Choisir —</option>
              <option value="especes">Espèces</option>
              <option value="virement">Virement</option>
              <option value="cb">Carte bancaire</option>
              <option value="cheque">Chèque</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Référence caution</label>
            <input
              type="text"
              name="deposit_ref"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Acompte encaissé (€)</label>
            <input
              type="number"
              name="payment_amount"
              value={acompte}
              onChange={e => setAcompte(e.target.value)}
              step="0.01"
              min="0"
              placeholder="0"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm"
            />
          </div>
        </div>

        {totalPrice > 0 && (
          <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-800">Total estimé ({days} jour{days > 1 ? 's' : ''})</span>
              <span className="text-xl font-bold text-blue-900">{formatPrice(totalPrice)}</span>
            </div>
            {Number(acompte) > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-blue-100">
                <span className="text-sm font-medium text-blue-700">Reste à payer (acompte {formatPrice(Number(acompte))})</span>
                <span className="text-lg font-bold text-blue-900">{formatPrice(Math.max(0, totalPrice - Number(acompte)))}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-900 mb-3">Notes internes</h3>
        <textarea
          name="internal_notes"
          rows={2}
          placeholder="Observations, demandes spéciales..."
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm resize-none"
        />
      </div>

      <p className="text-[11px] text-gray-400">* Champ obligatoire</p>
      <button
        type="submit"
        disabled={pending}
        className="px-6 py-3 bg-[#111111] hover:bg-gray-800 disabled:opacity-40 text-white font-semibold rounded-xl transition-colors text-sm"
      >
        {pending ? 'Création...' : 'Créer la réservation'}
      </button>
    </form>
  )
}
