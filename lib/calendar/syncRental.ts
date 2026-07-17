import { createAdminClient } from '@/lib/supabase/admin'
import { generateAlertsForEvent } from './generateAlerts'
import type { ReservationStatus } from '@/types/database'
import type { EventStatus, EventType } from '@/types/calendar'

// 60 min plutôt que 30 : laisse assez de hauteur au bloc pour que le titre
// (type + véhicule + couleur) reste lisible sur 2 lignes sans être coupé.
const EVENT_DURATION_MINUTES = 60

// Si le véhicule revient d'une autre location dans ce délai avant le nouveau
// départ, on ajoute une tâche "Lavage avant location" visible dans le
// calendrier (l'exemple donné — 1/2h — est largement dans cette fenêtre).
const QUICK_TURNAROUND_HOURS = 4

interface ReservationForSync {
  id: string
  vehicle_id: string
  client_id: string
  start_datetime: string
  end_datetime: string
  status: ReservationStatus
  reservation_number: string
  vehicle: { brand: string; model: string; color: string | null } | { brand: string; model: string; color: string | null }[] | null
}

function statusesFor(reservationStatus: ReservationStatus): { depart: EventStatus; retour: EventStatus } {
  switch (reservationStatus) {
    case 'annulee':
      return { depart: 'annule', retour: 'annule' }
    case 'terminee':
      return { depart: 'termine', retour: 'termine' }
    case 'en_cours':
    case 'en_retard':
      return { depart: 'termine', retour: 'en_cours' }
    default: // option, confirmee
      return { depart: 'a_faire', retour: 'a_faire' }
  }
}

async function upsertEvent(
  admin: ReturnType<typeof createAdminClient>,
  reservation: ReservationForSync,
  eventType: EventType,
  startAt: string,
  status: EventStatus,
  title: string,
) {
  const endAt = new Date(new Date(startAt).getTime() + EVENT_DURATION_MINUTES * 60_000).toISOString()

  const { data: existing } = await admin
    .from('calendar_events')
    .select('id')
    .eq('reservation_id', reservation.id)
    .eq('event_type', eventType)
    .maybeSingle()

  const payload = {
    title,
    event_type: eventType,
    status,
    start_at: startAt,
    end_at: endAt,
    reservation_id: reservation.id,
    vehicle_ids: [reservation.vehicle_id],
    client_id: reservation.client_id,
  }

  let eventId: string
  if (existing) {
    await admin.from('calendar_events').update(payload).eq('id', existing.id)
    eventId = existing.id
  } else {
    const { data: created } = await admin.from('calendar_events').insert(payload).select('id').single()
    if (!created) return
    eventId = created.id
  }

  await generateAlertsForEvent({ id: eventId, event_type: eventType, start_at: startAt })
}

/**
 * Crée ou met à jour les événements calendrier (départ + retour) liés à une
 * réservation. Idempotent — appelable à chaque mutation de la réservation
 * (création, changement de statut, de dates, prolongation) ainsi qu'en
 * rattrapage paresseux (GET events) pour les réservations déjà existantes.
 * Client admin obligatoire : la sync doit marcher même quand l'appelant est un
 * simple employé sans droit d'écriture direct sur calendar_events (RLS
 * gerant/associe uniquement pour l'INSERT).
 */
export async function syncReservationToCalendar(reservationId: string): Promise<void> {
  const admin = createAdminClient()
  const { data: reservation } = await admin
    .from('reservations')
    .select('id, vehicle_id, client_id, start_datetime, end_datetime, status, reservation_number, vehicle:vehicles(brand, model, color)')
    .eq('id', reservationId)
    .single()

  if (!reservation) return

  const { depart, retour } = statusesFor(reservation.status)
  const vehicle = Array.isArray(reservation.vehicle) ? reservation.vehicle[0] : reservation.vehicle
  const vehicleLabel = vehicle
    ? `${vehicle.brand} ${vehicle.model}${vehicle.color ? ' ' + vehicle.color : ''}`
    : reservation.reservation_number

  await upsertEvent(admin, reservation, 'depart_vehicule', reservation.start_datetime, depart, `Départ — ${vehicleLabel}`)
  await upsertEvent(admin, reservation, 'retour_vehicule', reservation.end_datetime, retour, `Retour — ${vehicleLabel}`)
  await syncWashTask(admin, reservation, depart, vehicleLabel)
}

/**
 * Si ce véhicule revient d'une autre location peu avant ce nouveau départ
 * (rotation rapide), ajoute une tâche "Lavage avant location" visible dans le
 * calendrier, 1h avant le départ. Supprime la tâche si elle existait mais que
 * la situation ne s'applique plus (reprogrammation, annulation de l'autre
 * réservation...).
 */
async function syncWashTask(
  admin: ReturnType<typeof createAdminClient>,
  reservation: ReservationForSync,
  departStatus: EventStatus,
  vehicleLabel: string,
) {
  const newStart = new Date(reservation.start_datetime)
  const windowStart = new Date(newStart.getTime() - QUICK_TURNAROUND_HOURS * 3_600_000)

  const { data: previousRental } = await admin
    .from('reservations')
    .select('id, end_datetime')
    .eq('vehicle_id', reservation.vehicle_id)
    .neq('id', reservation.id)
    .neq('status', 'annulee')
    .lte('end_datetime', reservation.start_datetime)
    .gte('end_datetime', windowStart.toISOString())
    .order('end_datetime', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Besoin de lavage : véhicule jamais lavé ou lavé il y a plus de 2 j avant ce
  // départ (même critère que l'alerte lavage). Uniquement pour les départs à
  // venir (a_faire), pas les résas terminées/annulées.
  const { data: veh } = await admin
    .from('vehicles')
    .select('last_wash_date')
    .eq('id', reservation.vehicle_id)
    .maybeSingle()
  const lastWash = (veh as { last_wash_date?: string | null } | null)?.last_wash_date
  const daysSinceWash = lastWash
    ? Math.floor((newStart.getTime() - new Date(lastWash).getTime()) / 86_400_000)
    : 999
  const needsWash = departStatus === 'a_faire' && daysSinceWash > 2

  const { data: existingWash } = await admin
    .from('calendar_events')
    .select('id')
    .eq('reservation_id', reservation.id)
    .eq('event_type', 'tache')
    .maybeSingle()

  // Tâche créée/gardée si rotation rapide OU si un lavage est nécessaire.
  if (!previousRental && !needsWash) {
    if (existingWash) await admin.from('calendar_events').delete().eq('id', existingWash.id)
    return
  }

  const washStart = new Date(newStart.getTime() - 60 * 60_000).toISOString()
  const payload = {
    title: `Lavage avant location — ${vehicleLabel}`,
    event_type: 'tache' as const,
    status: departStatus,
    start_at: washStart,
    end_at: reservation.start_datetime,
    reservation_id: reservation.id,
    vehicle_ids: [reservation.vehicle_id],
    client_id: null,
  }

  let eventId: string
  if (existingWash) {
    await admin.from('calendar_events').update(payload).eq('id', existingWash.id)
    eventId = existingWash.id
  } else {
    const { data: created } = await admin.from('calendar_events').insert(payload).select('id').single()
    if (!created) return
    eventId = created.id
  }

  await generateAlertsForEvent({ id: eventId, event_type: 'tache', start_at: washStart })
}

export async function removeReservationFromCalendar(reservationId: string): Promise<void> {
  const admin = createAdminClient()
  await admin.from('calendar_events').delete().eq('reservation_id', reservationId)
}
