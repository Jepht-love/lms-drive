'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { createClient } from '@/lib/supabase/client'
import { createOperation } from '@/lib/actions/partnerships'

interface Agency { id: string; name: string }
interface Vehicle { id: string; plate: string; brand: string; model: string }
interface Reservation { id: string; reservation_number: string }
interface Client { id: string; first_name: string; last_name: string; phone: string }

export default function NewOperationPage() {
  const router = useRouter()
  const [direction, setDirection] = useState<'out' | 'in'>('out')
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [rentalCost, setRentalCost] = useState('')
  const [clientPrice, setClientPrice] = useState('')
  const [newClient, setNewClient] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const sb = createClient()
    sb.from('partner_agencies').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => setAgencies((data as Agency[]) ?? []))
    sb.from('vehicles').select('id, plate, brand, model').eq('is_active', true).order('brand')
      .then(({ data }) => setVehicles((data as Vehicle[]) ?? []))
    sb.from('reservations').select('id, reservation_number').eq('status', 'confirmee').order('start_datetime', { ascending: false })
      .then(({ data }) => setReservations((data as Reservation[]) ?? []))
    sb.from('clients').select('id, first_name, last_name, phone').order('last_name')
      .then(({ data }) => setClients((data as Client[]) ?? []))
  }, [])

  const margin = (parseFloat(clientPrice.replace(',', '.')) || 0) - (parseFloat(rentalCost.replace(',', '.')) || 0)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.set('direction', direction)
    startTransition(async () => {
      const res = await createOperation(fd)
      if (res?.error) setError(res.error)
      else router.push(`/partnerships/${res.id}`)
    })
  }

  // min-w-0 : un datetime-local a une largeur intrinsèque et déborderait de sa colonne sans cela.
  const input = 'w-full min-w-0 text-sm border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 focus:outline-none focus:border-gray-400 transition-colors'
  const label = 'block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5'

  return (
    <div className="space-y-4 pb-4">
      <BackButton fallbackHref="/partnerships" className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Retour
      </BackButton>
      <h1 className="text-xl font-black text-gray-900">Nouvelle opération</h1>

      {/* Étape 1 — type */}
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => setDirection('out')}
          className={`p-4 rounded-2xl border-2 text-left transition-colors ${direction === 'out' ? 'border-[#111111] bg-gray-50' : 'border-gray-200 bg-white'}`}>
          <p className="text-sm font-bold text-[#111111]">→ Sortant</p>
          <p className="text-xs text-gray-400 mt-1">Un de nos véhicules part chez un partenaire</p>
        </button>
        <button type="button" onClick={() => setDirection('in')}
          className={`p-4 rounded-2xl border-2 text-left transition-colors ${direction === 'in' ? 'border-[#111111] bg-gray-50' : 'border-gray-200 bg-white'}`}>
          <p className="text-sm font-bold text-[#111111]">← Entrant</p>
          <p className="text-xs text-gray-400 mt-1">On utilise un véhicule partenaire pour un client</p>
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <div>
            <label className={label} htmlFor="partner_agency_id">Agence partenaire</label>
            <select id="partner_agency_id" name="partner_agency_id" required className={input}>
              <option value="">Sélectionner…</option>
              {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          {direction === 'out' ? (
            <div>
              <label className={label} htmlFor="vehicle_id">Notre véhicule</label>
              <select id="vehicle_id" name="vehicle_id" required className={input}>
                <option value="">Sélectionner…</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.brand} {v.model} · {v.plate}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className={label} htmlFor="external_vehicle_description">Véhicule partenaire</label>
              <input id="external_vehicle_description" name="external_vehicle_description" type="text" placeholder="Marque, modèle, immat…" className={input} />
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={label.replace('mb-1.5', '')} htmlFor="client_id">Client associé</label>
              <button type="button" onClick={() => setNewClient(v => !v)} className="text-[11px] font-bold text-blue-600">
                {newClient ? 'Client existant' : '+ Nouveau client'}
              </button>
            </div>
            {newClient ? (
              <div className="grid grid-cols-2 gap-3">
                <input name="new_client_first_name" placeholder="Prénom" required className={input} />
                <input name="new_client_last_name" placeholder="Nom" required className={input} />
                <input name="new_client_phone" type="tel" placeholder="Téléphone" required className={`${input} col-span-2`} />
              </div>
            ) : (
              <select id="client_id" name="client_id" className={input}>
                <option value="">Aucun</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name} — {c.phone}</option>)}
              </select>
            )}
          </div>
          {!newClient && (
            <div>
              <label className={label} htmlFor="client_reservation_id">Ou réservation existante associée</label>
              <select id="client_reservation_id" name="client_reservation_id" className={input}>
                <option value="">Aucune</option>
                {reservations.map(r => <option key={r.id} value={r.id}>{r.reservation_number}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="start_date">Départ</label>
              <input id="start_date" name="start_date" type="datetime-local" required className={input} />
            </div>
            <div>
              <label className={label} htmlFor="end_date_expected">Retour prévu</label>
              <input id="end_date_expected" name="end_date_expected" type="datetime-local" required className={input} />
            </div>
            <div>
              <label className={label} htmlFor="departure_km">Km départ</label>
              <input id="departure_km" name="departure_km" type="number" min="0" className={input} inputMode="numeric" />
            </div>
            <div>
              <label className={label} htmlFor="fuel_level_departure">Carburant (km)</label>
              <input id="fuel_level_departure" name="fuel_level_departure" type="number" min="0" placeholder="Autonomie en km" className={input} inputMode="numeric" />
            </div>
            <div>
              <label className={label} htmlFor="rental_cost">{direction === 'in' ? 'Coût payé au partenaire (€)' : 'Montant reçu (€)'}</label>
              <input id="rental_cost" name="rental_cost" type="number" step="0.01" min="0" placeholder="0" className={input} inputMode="decimal"
                value={rentalCost} onChange={e => setRentalCost(e.target.value)} />
            </div>
            <div>
              <label className={label} htmlFor="deposit_amount">Caution (€)</label>
              <input id="deposit_amount" name="deposit_amount" type="number" step="0.01" min="0" placeholder="0" className={input} inputMode="decimal" />
            </div>
          </div>

          <div>
            <label className={label} htmlFor="client_price">Prix facturé au client (€)</label>
            <input id="client_price" name="client_price" type="number" step="0.01" min="0" placeholder="0 si aucun client associé" className={input} inputMode="decimal"
              value={clientPrice} onChange={e => setClientPrice(e.target.value)} />
          </div>
          {clientPrice && (
            <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Marge estimée</span>
              <span className={`text-base font-black ${margin >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {margin.toFixed(2)} €
              </span>
            </div>
          )}

          <div>
            <label className={label} htmlFor="notes">Notes</label>
            <textarea id="notes" name="notes" rows={2} className={`${input} resize-none`} />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}

        <button type="submit" disabled={pending}
          className="w-full py-3.5 bg-[#111111] text-white rounded-2xl font-bold text-sm hover:bg-gray-800 transition-colors active:scale-[.99] disabled:opacity-40">
          {pending ? 'Enregistrement…' : 'Créer l\'opération'}
        </button>
      </form>
    </div>
  )
}
