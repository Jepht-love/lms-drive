'use client'

import { useRouter, useSearchParams } from 'next/navigation'

/**
 * Choix d'un véhicule dans une barre de filtres.
 *
 * D'où ça vient. Écrit pour l'écran Réservations le 28/07/2026 (`VehicleFilter`),
 * généralisé le 02/08/2026 sur demande de Jeff (remarque 46) : le même couple
 * « liste déroulante + carte de situation » sert maintenant à Réservations,
 * Suivi véhicule et Déplacements. Seul le chemin change, d'où `basePath`.
 *
 * Les autres paramètres de l'adresse sont conservés : choisir un véhicule ne doit
 * effacer ni une recherche, ni un statut, ni l'onglet en cours.
 *
 * À ne pas casser. La liste déroulante est posée par-dessus la pastille, en
 * invisible : le menu du téléphone garde les libellés complets (marque, modèle,
 * plaque) alors que la pastille n'affiche qu'un libellé court et borné. Sans ça
 * la liste prenait la largeur de son plus long véhicule, près de 300 px, et
 * poussait les filtres hors de l'écran d'un iPhone. Signalé par Jeff le
 * 29/07/2026.
 */
export default function VehiclePicker({
  vehicles,
  selected,
  basePath,
}: {
  vehicles: { id: string; brand: string | null; model: string | null; plate: string | null }[]
  selected?: string
  basePath: string
}) {
  const router = useRouter()
  const params = useSearchParams()

  function choisir(id: string) {
    const p = new URLSearchParams(params.toString())
    if (id) p.set('vehicle', id)
    else p.delete('vehicle')
    router.push(`${basePath}${p.toString() ? `?${p}` : ''}`)
  }

  // Libellé court de la pastille : le véhicule choisi est de toute façon repris
  // en entier juste en dessous, dans la carte noire de situation.
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
      <label htmlFor="filtre-vehicule" className="sr-only">Choisir un véhicule</label>
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
