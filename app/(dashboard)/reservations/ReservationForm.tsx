'use client'

import { useActionState, useState, useEffect } from 'react'
import { calculateRentalDays, calculateRentalPrice, formatPrice } from '@/lib/utils'

interface Vehicle {
  id: string; plate: string; brand: string; model: string
  daily_price: number | null; weekly_price: number | null
  deposit_amount: number | null; km_included_daily: number | null
  extra_km_price: number | null
}

interface Client {
  id: string; first_name: string; last_name: string; phone: string
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

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId)

  useEffect(() => {
    if (selectedVehicle?.daily_price) {
      setDailyPrice(selectedVehicle.daily_price.toString())
    }
  }, [selectedVehicleId, selectedVehicle])

  const days = startDatetime && endDatetime
    ? calculateRentalDays(startDatetime, endDatetime)
    : 0

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
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <h3 className="font-semibold text-slate-800">Véhicule & client</h3>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5 uppercase tracking-wide">Véhicule *</label>
            <select
              name="vehicle_id"
              value={selectedVehicleId}
              onChange={e => setSelectedVehicleId(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            >
              <option value="">— Choisir un véhicule —</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.plate} — {v.brand} {v.model} {v.daily_price ? `(${v.daily_price}€/j)` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5 uppercase tracking-wide">Client *</label>
            <select
              name="client_id"
              defaultValue={defaultClientId ?? ''}
              required
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            >
              <option value="">— Choisir un client —</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name} — {c.phone}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dates */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <h3 className="font-semibold text-slate-800">Dates</h3>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5 uppercase tracking-wide">Départ *</label>
            <input
              type="datetime-local"
              name="start_datetime"
              value={startDatetime}
              onChange={e => setStartDatetime(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5 uppercase tracking-wide">Retour *</label>
            <input
              type="datetime-local"
              name="end_datetime"
              value={endDatetime}
              onChange={e => setEndDatetime(e.target.value)}
              required
              min={startDatetime}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          {days > 0 && (
            <p className="text-sm text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">
              Durée : <strong>{days} jour{days > 1 ? 's' : ''}</strong>
            </p>
          )}
        </div>
      </div>

      {/* Tarification */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="font-semibold text-slate-800 mb-4">Tarification</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5 uppercase tracking-wide">Prix/jour (€) *</label>
            <input
              type="number"
              name="daily_price"
              value={dailyPrice}
              onChange={e => setDailyPrice(e.target.value)}
              required
              step="0.01"
              min="0"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5 uppercase tracking-wide">KM inclus/jour</label>
            <input
              type="number"
              name="km_included"
              defaultValue={selectedVehicle?.km_included_daily?.toString() ?? ''}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5 uppercase tracking-wide">Supplément KM (€/km)</label>
            <input
              type="number"
              name="extra_km_price"
              defaultValue={selectedVehicle?.extra_km_price?.toString() ?? ''}
              step="0.01"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5 uppercase tracking-wide">Caution (€)</label>
            <input
              type="number"
              name="deposit_amount"
              defaultValue={selectedVehicle?.deposit_amount?.toString() ?? ''}
              step="0.01"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5 uppercase tracking-wide">Mode caution</label>
            <select
              name="deposit_method"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            >
              <option value="">— Choisir —</option>
              <option value="especes">Espèces</option>
              <option value="virement">Virement</option>
              <option value="cb">Carte bancaire</option>
              <option value="cheque">Chèque</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5 uppercase tracking-wide">Référence caution</label>
            <input
              type="text"
              name="deposit_ref"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

        {totalPrice > 0 && (
          <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-800">Total estimé ({days} jour{days > 1 ? 's' : ''})</span>
              <span className="text-xl font-bold text-blue-900">{formatPrice(totalPrice)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="font-semibold text-slate-800 mb-3">Notes internes</h3>
        <textarea
          name="internal_notes"
          rows={2}
          placeholder="Observations, demandes spéciales..."
          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-xl transition-colors text-sm"
      >
        {pending ? 'Création...' : 'Créer la réservation'}
      </button>
    </form>
  )
}
