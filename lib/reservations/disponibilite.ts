import { findBlockingInternalTrip } from '@/lib/vehicles/internalTrips'
import type { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

/**
 * Pourquoi ce fichier existe.
 *
 * Trois choses rendent un véhicule indisponible : une autre réservation, un
 * rendez-vous garage, un déplacement interne. Ces trois contrôles n'existaient
 * qu'au moment d'enregistrer : on saisissait toute la réservation, puis on se
 * faisait refuser. Le gérant devait ouvrir la Flotte dans un autre onglet pour
 * savoir à l'avance (ticket SAV du 27/07/2026, 21h16).
 *
 * L'écueil serait de réécrire ces règles pour l'affichage : deux copies finissent
 * toujours par diverger, et l'écran annoncerait « libre » là où l'enregistrement
 * refuse. Les règles vivent donc ICI, et les deux chemins appellent le même code.
 */

export type RaisonIndisponibilite = 'reservation' | 'garage' | 'deplacement'

export const RAISON_LABEL: Record<RaisonIndisponibilite, string> = {
  reservation:  'déjà réservé',
  garage:       'au garage',
  deplacement:  'déplacement interne',
}

// À TRANCHER AVEC LE GÉRANT (28/07/2026) : un véhicule en fourrière, non
// restitué ou hors service est aujourd'hui annoncé libre et peut être réservé.
// La question de le bloquer, et à partir de quel statut, lui revient : c'est une
// règle de métier, pas un choix technique. Rien n'est fait ici pour l'instant.

/**
 * Véhicules indisponibles sur une période, avec la raison de chacun.
 *
 * `ignorerReservationId` sert à la modification d'une réservation existante :
 * sans lui, elle se déclarerait en conflit avec elle-même.
 */
export async function vehiculesIndisponibles(
  supabase: SupabaseClient,
  debutInstant: string,
  finInstant: string,
  options?: { vehicleIds?: string[]; ignorerReservationId?: string },
): Promise<Map<string, RaisonIndisponibilite>> {
  const indispo = new Map<string, RaisonIndisponibilite>()
  const cibles = options?.vehicleIds

  // Liste des véhicules à examiner quand l'appelant n'en impose pas.
  let qVehicules = supabase.from('vehicles').select('id')
  if (cibles?.length) qVehicules = qVehicules.in('id', cibles)
  const { data: vehicules } = await qVehicules

  // 1. Autres réservations. Chevauchement RÉEL : l'existante commence avant la
  //    fin de la nouvelle ET se termine après son début.
  let q = supabase
    .from('reservations')
    .select('vehicle_id')
    .not('status', 'in', '("annulee","terminee","non_presente")')
    .lt('start_datetime', finInstant)
    .gt('end_datetime', debutInstant)
  if (cibles?.length) q = q.in('vehicle_id', cibles)
  if (options?.ignorerReservationId) q = q.neq('id', options.ignorerReservationId)
  const { data: resas } = await q
  for (const r of resas ?? []) {
    // On ne remplace pas une raison d'état déjà posée : « en fourrière » est plus
    // parlant que « déjà réservé » pour la même voiture.
    if (r.vehicle_id && !indispo.has(r.vehicle_id)) indispo.set(r.vehicle_id, 'reservation')
  }

  // 2. Rendez-vous garage, sur leur propre fenêtre uniquement : un RDV 14h-17h
  //    n'empêche pas une location à 18h.
  const { data: garages } = await supabase
    .from('calendar_events')
    .select('vehicle_ids')
    .eq('event_type', 'rdv_garage')
    .neq('status', 'annule')
    .lt('start_at', finInstant)
    .gt('end_at', debutInstant)
  for (const g of garages ?? []) {
    for (const vid of (g.vehicle_ids as string[] | null) ?? []) {
      if (cibles?.length && !cibles.includes(vid)) continue
      if (!indispo.has(vid)) indispo.set(vid, 'garage')
    }
  }

  // 3. Déplacements internes. Le contrôle existant travaille véhicule par
  //    véhicule (il gère le cas du trajet en cours sans retour connu) : on ne
  //    l'interroge que pour ceux encore déclarés libres.
  const aTester = cibles?.length ? cibles : (vehicules ?? []).map(v => v.id)
  const restants = aTester.filter((vid): vid is string => !!vid && !indispo.has(vid))
  await Promise.all(restants.map(async vid => {
    if (await findBlockingInternalTrip(supabase, vid, debutInstant, finInstant)) {
      indispo.set(vid, 'deplacement')
    }
  }))

  return indispo
}
