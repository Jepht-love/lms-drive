import type { createClient } from '@/lib/supabase/server'

/**
 * Durée de repli d'un déplacement SANS date de fin. Depuis que la fin est
 * obligatoire à la planification, seuls restent : les déplacements créés
 * directement depuis le calendrier et les lignes antérieures. Sans ce repli, une
 * fin nulle bloquerait le véhicule pour toujours. Même valeur que le bloc
 * calendrier (lib/calendar/syncInternalTrip.ts).
 */
export const FALLBACK_DURATION_MINUTES = 60

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
 * Statuts qui disent le véhicule réellement SORTI pour un client. Même liste que
 * la page Véhicules (EN_LOCATION_STATUSES) : elle doit rester alignée.
 */
const EN_LOCATION_STATUSES = ['loue', 'mis_a_disposition']

/**
 * Faut-il AFFICHER ce véhicule comme « en déplacement professionnel » ?
 *
 * Règle unique de la superposition décrite dans `fetchActiveInternalTrips` : le
 * statut en base ne bouge jamais, l'information est ajoutée à l'affichage. Un
 * véhicule loué ou mis à disposition n'est jamais annoncé en déplacement, la
 * location dit la vérité — un déplacement encore ouvert n'est alors qu'une ligne
 * que personne n'a clôturée.
 *
 * Écrite ici et pas dans chaque écran : la liste des véhicules, le tableau de
 * bord, la fiche d'un véhicule et la carte du véhicule choisi des réservations
 * posent tous la même question. Ajoutée le 02/08/2026 en corrigeant la fiche
 * véhicule, qui lisait le statut brut et affichait « Disponible » une voiture
 * partie en déplacement (défaut remonté par le gérant).
 *
 * Ne PAS confondre avec la question posée par l'écran des immobilisés : lui
 * cherche la RAISON à afficher et regarde donc si le statut a déjà une cause
 * d'immobilisation à lui.
 */
export function estEnDeplacement(
  vehicleStatus: string,
  trip: ActiveInternalTrip | undefined,
): trip is ActiveInternalTrip {
  return !!trip && !EN_LOCATION_STATUSES.includes(vehicleStatus)
}

/**
 * Fenêtre pendant laquelle un déplacement interdit d'engager le véhicule.
 * SEULE définition de cette règle : le contrôle d'enregistrement
 * (`findBlockingInternalTrip`) et l'affichage des créneaux libres
 * (`fetchBlockingInternalTripsForVehicles`) passent tous les deux par ici, pour
 * qu'un écran ne puisse jamais annoncer « libre » là où l'enregistrement refuse.
 *
 *  - fin renseignée → [début, fin[ ;
 *  - « en cours » sans fin → `fin: null`, à partir du départ et sans limite
 *    (véhicule dehors, retour inconnu : on ne peut rien promettre) ;
 *  - planifié/terminé sans fin → repli d'une heure, sinon une ligne incomplète
 *    condamnerait le véhicule pour toujours.
 */
export function fenetreBloquanteDeplacement(trip: {
  start_datetime: string
  end_datetime: string | null
  status: string
}): { debut: string; fin: string | null } {
  if (trip.end_datetime) return { debut: trip.start_datetime, fin: trip.end_datetime }
  if (trip.status === 'en_cours') return { debut: trip.start_datetime, fin: null }
  return { debut: trip.start_datetime, fin: plusFallback(trip.start_datetime) }
}

/** Vrai si la fenêtre du déplacement chevauche [startIso, endIso[. */
const chevauche = (f: { debut: string; fin: string | null }, startIso: string, endIso: string) =>
  f.debut < endIso && (f.fin === null || f.fin > startIso)

/**
 * Un déplacement interne empêche-t-il d'engager le véhicule sur [startIso, endIso[ ?
 * Renvoie le déplacement bloquant, sinon null. Règle de fenêtre :
 * `fenetreBloquanteDeplacement`.
 *
 * `ignorerTripId` sert à la modification d'un déplacement existant : sans lui, il
 * se déclarerait en conflit avec lui-même (même rôle que `ignorerReservationId`
 * côté réservation).
 */
export async function findBlockingInternalTrip(
  supabase: Awaited<ReturnType<typeof createClient>>,
  vehicleId: string,
  startIso: string,
  endIso: string,
  ignorerTripId?: string,
): Promise<{ id: string; start_datetime: string; end_datetime: string | null; status: string } | null> {
  let q = supabase
    .from('internal_trips')
    .select('id, start_datetime, end_datetime, status')
    .eq('vehicle_id', vehicleId)
    .neq('status', 'annule')
    .lt('start_datetime', endIso)
  if (ignorerTripId) q = q.neq('id', ignorerTripId)
  const { data } = await q

  const blocking = (data ?? []).find(t =>
    chevauche(fenetreBloquanteDeplacement(t), startIso, endIso),
  )
  return blocking ?? null
}

/**
 * Les fenêtres bloquantes de PLUSIEURS véhicules sur [startIso, endIso[, en une
 * seule requête, et sans s'arrêter au premier déplacement trouvé : l'affichage
 * des créneaux libres a besoin de tous les trous, pas d'un simple oui/non.
 *
 * Même règle que `findBlockingInternalTrip` — elles appellent la même fonction de
 * fenêtre. Ne pas réécrire la règle ici : deux copies finissent toujours par
 * diverger, et l'écran promettrait un créneau que l'enregistrement refuserait.
 *
 * Rend une entrée par véhicule concerné ; un véhicule sans déplacement bloquant
 * est simplement absent de la table.
 */
export async function fetchBlockingInternalTripsForVehicles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  vehicleIds: string[],
  startIso: string,
  endIso: string,
  ignorerTripId?: string,
): Promise<Map<string, { debut: string; fin: string | null }[]>> {
  const parVehicule = new Map<string, { debut: string; fin: string | null }[]>()
  if (vehicleIds.length === 0) return parVehicule

  let q = supabase
    .from('internal_trips')
    .select('vehicle_id, start_datetime, end_datetime, status')
    .in('vehicle_id', vehicleIds)
    .neq('status', 'annule')
    .lt('start_datetime', endIso)
  if (ignorerTripId) q = q.neq('id', ignorerTripId)
  const { data } = await q

  for (const t of data ?? []) {
    const fenetre = fenetreBloquanteDeplacement(t)
    if (!chevauche(fenetre, startIso, endIso)) continue
    const liste = parVehicule.get(t.vehicle_id)
    if (liste) liste.push(fenetre)
    else parVehicule.set(t.vehicle_id, [fenetre])
  }
  return parVehicule
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
