'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Car } from 'lucide-react'

/**
 * Choix d'un véhicule dans la barre de filtres, à côté des statuts.
 *
 * La page savait déjà filtrer par véhicule (paramètre `vehicle` dans l'adresse),
 * mais aucun écran ne permettait de le choisir : il fallait connaître
 * l'identifiant. Demande de Jeff du 28/07/2026 — un client appelle pour une
 * voiture précise, on veut voir d'un coup quand elle revient.
 *
 * Les autres filtres sont conservés dans l'adresse : choisir un véhicule ne doit
 * pas effacer une recherche ou un statut en cours.
 */
export default function VehicleFilter({
  vehicles,
  selected,
}: {
  vehicles: { id: string; brand: string | null; model: string | null; plate: string | null }[]
  selected?: string
}) {
  const router = useRouter()
  const params = useSearchParams()

  function choisir(id: string) {
    const p = new URLSearchParams(params.toString())
    if (id) p.set('vehicle', id)
    else p.delete('vehicle')
    router.push(`/reservations${p.toString() ? `?${p}` : ''}`)
  }

  return (
    <div
      className={`relative flex items-center gap-1.5 px-3.5 min-h-[44px] rounded-xl text-sm font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${
        selected ? 'bg-[#111111] text-white' : 'bg-white border border-gray-100 text-gray-600 shadow-sm'
      }`}
    >
      <Car className="w-4 h-4 flex-shrink-0 opacity-70" />
      <label htmlFor="filtre-vehicule" className="sr-only">Filtrer par véhicule</label>
      <select
        id="filtre-vehicule"
        value={selected ?? ''}
        onChange={e => choisir(e.target.value)}
        className="bg-transparent border-0 outline-none text-sm font-semibold pr-1 cursor-pointer appearance-none"
        style={{ colorScheme: selected ? 'dark' : 'light' }}
      >
        <option value="">Tous les véhicules</option>
        {vehicles.map(v => (
          <option key={v.id} value={v.id}>
            {[v.brand, v.model].filter(Boolean).join(' ')} — {v.plate}
          </option>
        ))}
      </select>
    </div>
  )
}
