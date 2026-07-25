import type { createClient } from '@/lib/supabase/server'

/**
 * Durée de repli d'un déplacement SANS date de fin. Depuis que la fin est
 * obligatoire à la planification, seuls restent : les déplacements créés
 * directement depuis le calendrier et les lignes antérieures. Sans ce repli, une
 * fin nulle bloquerait le véhicule pour toujours. Même valeur que le bloc
 * calendrier (lib/calendar/syncInternalTrip.ts).
 */
const FALLBACK_DURATION_MINUTES = 60

const plusFallback = (startIso: string) =>
  new Date(new Date(startIso).getTime() + FALLBACK_DURATION_MINUTES * 60_000).toISOString()

export interface ActiveInternalTrip {
  vehicleId: string
  status: 'planifie' | 'en_cours'
  startAt: string
  /** Fin prévue (déplacement planifié) ou null (en cours sans fin renseignée). */
  endAt: string | null
  purpose: string
  purposeNotes: string | null
}

/**
 * Véhicules INDISPONIBLES MAINTENANT à cause d'un déplacement interne :
 *  - « en cours » : le véhicule est réellement sorti → indisponible jusqu'à la
 *    clôture, même si l'heure de fin prévue est dépassée ;
 *  - « planifié » : indisponible sur sa fenêtre seulement (début passé, fin à
 *    venir). Un déplacement planifié pour demain ne bloque pas aujourd'hui, et
 *    un planifié jamais démarré cesse de bloquer une fois sa fin passée.
 *
 * On ne touche PAS `vehicles.status` : l'information est superposée à
 * l'affichage. Rien à défaire si un déplacement n'est jamais clôturé — même
 * choix que le rattrapage « engagé » des réservations (cf. engagedVehicleIds
 * dans app/(dashboard)/page.tsx), qui évite les statuts orphelins.
 *
 * La création de réservation, elle, bloque déjà sur la fenêtre du déplacement
 * (lib/actions/reservations.ts, « Indisponibilité DÉPLACEMENT INTERNE »).
 */
export async function fetchActiveInternalTrips(
  supabase: Awaited<ReturnType<typeof createClient>>,
  nowIso: string = new Date().toISOString(),
): Promise<Map<string, ActiveInternalTrip>> {
  const { data } = await supabase
    .from('internal_trips')
    .select('vehicle_id, start_datetime, end_datetime, purpose, purpose_notes, status')
    .in('status', ['en_cours', 'planifie'])
    .lte('start_datetime', nowIso)

  const byVehicle = new Map<string, ActiveInternalTrip>()
  for (const t of data ?? []) {
    // En cours = véhicule physiquement dehors → indisponible jusqu'à la clôture,
    // fin prévue dépassée ou non. Planifié = sa fenêtre seulement (repli 1 h si
    // la fin manque, sur les lignes créées depuis le calendrier).
    const covers = t.status === 'en_cours' || (t.end_datetime ?? plusFallback(t.start_datetime)) > nowIso
    if (!covers) continue

    // Un déplacement EN COURS prime sur un simple planifié : c'est celui qui dit
    // la vérité (véhicule physiquement parti).
    const existing = byVehicle.get(t.vehicle_id)
    if (existing?.status === 'en_cours' && t.status !== 'en_cours') continue

    byVehicle.set(t.vehicle_id, {
      vehicleId: t.vehicle_id,
      status: t.status,
      startAt: t.start_datetime,
      endAt: t.end_datetime,
      purpose: t.purpose,
      purposeNotes: t.purpose_notes,
    })
  }
  return byVehicle
}

/**
 * Un déplacement interne empêche-t-il d'engager le véhicule sur [startIso, endIso[ ?
 * Renvoie le déplacement bloquant, sinon null.
 *
 * Fenêtre bloquante d'un déplacement :
 *  - fin renseignée → [début, fin[ ;
 *  - « en cours » sans fin → à partir du départ, sans limite (véhicule dehors,
 *    retour inconnu : on ne peut rien promettre) ;
 *  - planifié/terminé sans fin → repli d'une heure, sinon une ligne incomplète
 *    condamnerait le véhicule pour toujours.
 */
export async function findBlockingInternalTrip(
  supabase: Awaited<ReturnType<typeof createClient>>,
  vehicleId: string,
  startIso: string,
  endIso: string,
): Promise<{ id: string; start_datetime: string; end_datetime: string | null; status: string } | null> {
  const { data } = await supabase
    .from('internal_trips')
    .select('id, start_datetime, end_datetime, status')
    .eq('vehicle_id', vehicleId)
    .neq('status', 'annule')
    .lt('start_datetime', endIso)

  const blocking = (data ?? []).find(t => {
    if (!t.end_datetime) return t.status === 'en_cours' || plusFallback(t.start_datetime) > startIso
    return t.end_datetime > startIso
  })
  return blocking ?? null
}

const PURPOSE_LABELS: Record<string, string> = {
  livraison: 'Livraison', recuperation: 'Récupération', garage: 'Garage',
  preparation: 'Préparation', personnel: 'Personnel', autre: 'Autre',
}

/**
 * Libellé lisible d'un motif de déplacement. Le motif « autre » n'apporte aucune
 * information : on affiche alors la précision saisie par l'utilisateur (« campagne
 * de pub », « usage particulier »…) plutôt que le mot « Autre ».
 */
export function internalTripPurposeLabel(purpose: string, notes?: string | null): string {
  if (purpose === 'autre' && notes?.trim()) return notes.trim()
  return PURPOSE_LABELS[purpose] ?? purpose
}
