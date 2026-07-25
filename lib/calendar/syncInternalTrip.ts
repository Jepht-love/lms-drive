import { createAdminClient } from '@/lib/supabase/admin'
import { internalTripPurposeLabel } from '@/lib/vehicles/internalTrips'

// Statut du déplacement → statut de l'événement calendrier (enum calendar_events).
const STATUS_MAP: Record<string, 'a_faire' | 'en_cours' | 'termine' | 'annule'> = {
  planifie: 'a_faire', en_cours: 'en_cours', termine: 'termine', annule: 'annule',
}

// 1h par défaut quand le trajet est encore en cours (pas de end_datetime) —
// même logique que syncRental.ts, juste pour donner une hauteur de bloc au
// calendrier ; mis à jour avec la vraie durée dès que le trajet se termine.
const FALLBACK_DURATION_MINUTES = 60

/**
 * Crée ou met à jour l'événement calendrier d'un déplacement interne, au nom
 * de l'utilisateur qui l'effectue — appelé depuis startTrip/endTrip. Idempotent
 * via source_key ("trip-<id>"), y compris pour un trip créé à l'origine depuis
 * le calendrier (voir app/api/calendar/events/route.ts), qui pose déjà cette clé.
 */
export async function syncTripToCalendar(tripId: string): Promise<void> {
  const admin = createAdminClient()
  const { data: trip, error: readError } = await admin
    .from('internal_trips')
    .select('id, vehicle_id, user_id, start_datetime, end_datetime, purpose, purpose_notes, status, vehicle:vehicles(brand, model)')
    .eq('id', tripId)
    .single()

  // Sans ces logs, un échec ici laissait le déplacement absent du calendrier
  // sans la moindre trace (constaté le 25/07 : trip créé, aucun événement).
  if (readError) {
    console.error('syncTripToCalendar — lecture du déplacement échouée:', readError.message)
    return
  }
  if (!trip) return

  const vehicle = Array.isArray(trip.vehicle) ? trip.vehicle[0] : trip.vehicle
  const vehicleLabel = vehicle ? `${vehicle.brand} ${vehicle.model}` : ''
  const purposeLabel = internalTripPurposeLabel(trip.purpose, trip.purpose_notes)
  const title = `Déplacement — ${purposeLabel}${vehicleLabel ? ` (${vehicleLabel})` : ''}`

  const startAt = trip.start_datetime
  const fallbackEnd = new Date(new Date(startAt).getTime() + FALLBACK_DURATION_MINUTES * 60_000).toISOString()
  // Un déplacement planifié puis démarré EN RETARD garde sa fin prévue alors que
  // son début est recalé sur l'heure réelle (startPlannedTrip) → fin <= début.
  // Sans ce garde-fou, le calendrier reçoit un bloc de durée négative.
  const endAt = trip.end_datetime && trip.end_datetime > startAt ? trip.end_datetime : fallbackEnd

  const sourceKey = `trip-${trip.id}`
  const payload = {
    title,
    event_type: 'deplacement_interne' as const,
    status: STATUS_MAP[trip.status] ?? 'a_faire',
    start_at: startAt,
    end_at: endAt,
    vehicle_ids: [trip.vehicle_id],
    assigned_to: trip.user_id, // null = non assigné (colonne nullable)
    source_key: sourceKey,
  }

  const { data: existing } = await admin
    .from('calendar_events')
    .select('id')
    .eq('source_key', sourceKey)
    .maybeSingle()

  const { error: writeError } = existing
    ? await admin.from('calendar_events').update(payload).eq('id', existing.id)
    : await admin.from('calendar_events').insert(payload)

  if (writeError) {
    console.error('syncTripToCalendar — écriture de l’événement échouée:', writeError.message)
  }
}
