// Onglet Départ — démarrer une location qui commence maintenant.
//
// À quoi il sert : raccourci pour les départs immédiats. La date de début est
// préremplie à l'heure actuelle (elle reste modifiable dans le formulaire).
// Après création, le flux enchaîne DIRECTEMENT sur l'état des lieux de départ
// (pas de détour par la fiche réservation), conformément à l'arbitrage Jeff du
// 08/08/2026 (#15).
//
// Ce qu'il attend : les mêmes données que la page /reservations/new (véhicules
// actifs, clients, pièces importées). Il réutilise ReservationForm sans le
// modifier.
//
// Ce qu'il produit : une réservation en statut « option », puis une redirection
// vers /inspections/departure/[id]. Le champ caché depart_flow=1 est injecté
// dans le FormData par l'action wrapper avant d'appeler createReservation.
//
// Qui s'en sert : le gérant et les associés, au moment de remettre les clés.
//
// Ce qu'il ne faut pas casser :
//   - tous les contrôles de createReservation (blacklist, conflits, garage,
//     déplacement) restent actifs. Un départ immédiat sur une voiture prise est
//     refusé comme n'importe quelle réservation.
//   - le parcours normal (/reservations/new) n'est pas touché : il ne pose pas
//     depart_flow et redirige toujours vers la fiche réservation.

import { createClient } from '@/lib/supabase/server'
import { createReservation } from '@/lib/actions/reservations'
import BackButton from '@/components/ui/BackButton'
import ReservationForm from '../reservations/ReservationForm'

// Action wrapper : injecte depart_flow=1 dans le FormData puis délègue à
// createReservation. Ainsi ReservationForm ne connaît pas le flux Départ et
// aucune copie de la logique de création n'existe.
async function createDepartureReservation(formData: FormData) {
  'use server'
  formData.set('depart_flow', '1')
  return createReservation(formData)
}

export default async function DepartPage() {
  const supabase = await createClient()

  // Heure de début : maintenant, arrondie à la minute (format ISO attendu par
  // new Date() dans ReservationForm → toDatetimeLocal).
  const now = new Date()
  now.setSeconds(0, 0)
  const startIso = now.toISOString()
  // Retour prérempli à +24 h. Sans une date de fin, le formulaire ne lance pas le
  // contrôle de disponibilité (il a besoin d'une période) et la dispo des véhicules
  // ne s'affiche pas. Cette valeur est modifiable : l'agent ajuste le retour réel.
  const endIso = new Date(now.getTime() + 24 * 3600000).toISOString()

  const [{ data: vehicles }, { data: clients }, { data: clientDocs }] = await Promise.all([
    supabase
      .from('vehicles')
      .select('id, plate, brand, model, daily_price, weekly_price, price_day_weekend, price_weekend_full, deposit_amount, km_included_daily, extra_km_price, unlimited_km_price')
      .eq('is_active', true)
      .order('brand'),
    supabase
      .from('clients')
      .select('id, first_name, last_name, phone, status, address, id_doc_front_path, id_doc_back_path, license_front_path, id_doc_type, license_number')
      .order('last_name'),
    // Pièces importées (Système A) — même logique que /reservations/new pour
    // que le dossier client soit jugé complet de la même façon.
    supabase
      .from('documents')
      .select('entity_id, subcategory')
      .eq('entity_type', 'client')
      .eq('is_auto_generated', false),
  ])

  const subsByClient = new Map<string, string[]>()
  for (const d of clientDocs ?? []) {
    if (!d.entity_id || !d.subcategory) continue
    const arr = subsByClient.get(d.entity_id) ?? []
    arr.push(d.subcategory)
    subsByClient.set(d.entity_id, arr)
  }
  const clientsAvecPieces = (clients ?? []).map(c => ({
    ...c,
    docSubcategories: subsByClient.get(c.id) ?? [],
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BackButton fallbackHref="/" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Départ</h1>
          <p className="text-gray-500 mt-0.5">Location qui commence maintenant</p>
        </div>
      </div>
      <ReservationForm
        action={createDepartureReservation}
        vehicles={vehicles ?? []}
        clients={clientsAvecPieces}
        defaultStartDatetime={startIso}
        defaultEndDatetime={endIso}
      />
    </div>
  )
}
