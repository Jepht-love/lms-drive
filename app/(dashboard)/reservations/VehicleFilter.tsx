'use client'

import { useRouter, useSearchParams } from 'next/navigation'

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
 *
 * La liste déroulante est posée par-dessus la pastille, invisible : le menu du
 * téléphone garde les libellés complets (marque, modèle et plaque), alors que la
 * pastille n'affiche qu'un libellé court et borné. Sans ça la liste prenait la
 * largeur de son plus long véhicule, près de 300 px, et poussait les filtres de
 * statut hors de l'écran d'un iPhone. Signalé par Jeff le 29/07/2026.
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

  // Libellé court de la pastille : le véhicule choisi est de toute façon repris
  // en entier juste en dessous, dans la carte noire de disponibilité.
  const choisi = vehicles.find(v => v.id === selected)
  const libelle = choisi
    ? [choisi.brand, choisi.model].filter(Boolean).join(' ') || choisi.plate || 'Véhicule'
    : 'Véhicule'

  return (
    <div
      className={`relative flex items-center px-2.5 min-h-[44px] rounded-xl text-sm font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${
        selected ? 'bg-[#111111] text-white' : 'bg-white border border-gray-100 text-gray-600 shadow-sm'
      }`}
    >
      <span className="max-w-[64px] truncate">{libelle}</span>
      <label htmlFor="filtre-vehicule" className="sr-only">Filtrer par véhicule</label>
      <select
        id="filtre-vehicule"
        value={selected ?? ''}
        onChange={e => choisir(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none"
      >
        <option value="">Tous les véhicules</option>
        {vehicles.map(v => (
          <option key={v.id} value={v.id}>
            {[v.brand, v.model].filter(Boolean).join(' ')} · {v.plate}
          </option>
        ))}
      </select>
    </div>
  )
}
