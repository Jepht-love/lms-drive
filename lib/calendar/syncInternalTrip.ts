import { createAdminClient } from '@/lib/supabase/admin'

const PURPOSE_LABELS: Record<string, string> = {
  livraison: 'Livraison', recuperation: 'Récupération', garage: 'Garage',
  preparation: 'Préparation', personnel: 'Personnel', autre: 'Autre',
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
  const { data: trip } = await admin
    .from('internal_trips')
    .select('id, vehicle_id, user_id, start_datetime, end_datetime, purpose, vehicle:vehicles(brand, model)')
    .eq('id', tripId)
    .single()

  if (!trip) return

  const vehicle = Array.isArray(trip.vehicle) ? trip.vehicle[0] : trip.vehicle
  const vehicleLabel = vehicle ? `${vehicle.brand} ${vehicle.model}` : ''
  const purposeLabel = PURPOSE_LABELS[trip.purpose] ?? trip.purpose
  const title = `Déplacement — ${purposeLabel}${vehicleLabel ? ` (${vehicleLabel})` : ''}`

  const startAt = trip.start_datetime
  const endAt = trip.end_datetime
    ?? new Date(new Date(startAt).getTime() + FALLBACK_DURATION_MINUTES * 60_000).toISOString()

  const sourceKey = `trip-${trip.id}`
  const payload = {
    title,
    event_type: 'deplacement_interne' as const,
    status: trip.end_datetime ? ('termine' as const) : ('en_cours' as const),
    start_at: startAt,
    end_at: endAt,
    vehicle_ids: [trip.vehicle_id],
    assigned_to: trip.user_id,
    source_key: sourceKey,
  }

  const { data: existing } = await admin
    .from('calendar_events')
    .select('id')
    .eq('source_key', sourceKey)
    .maybeSingle()

  if (existing) {
    await admin.from('calendar_events').update(payload).eq('id', existing.id)
  } else {
    await admin.from('calendar_events').insert(payload)
  }
}
