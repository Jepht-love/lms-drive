import { createClient } from '@/lib/supabase/server'

// Identifie qui était en possession d'un véhicule à une date donnée :
// 1) une réservation client couvrant la date, sinon
// 2) un déplacement interne (internal_trips) couvrant la date.
// Schéma réel : reservations.start_datetime/end_datetime + statuts en_cours/terminee/en_retard.

export interface DriverResult {
  type: 'client' | 'internal'
  reservationId?: string
  client?: { id: string; first_name: string; last_name: string; phone: string; email: string | null } | null
  internalUser?: { id: string; full_name: string } | null
}

export async function findDriverAtDate(vehicleId: string, date: string, time?: string): Promise<DriverResult | null> {
  const supabase = await createClient()
  // Avec l'heure : on vise le conducteur réellement en possession à cet
  // instant précis (utile quand le véhicule change de main plusieurs fois le
  // même jour). Sans heure : minuit, comportement historique inchangé.
  const iso = new Date(time ? `${date}T${time}` : date).toISOString()

  // 1) Réservation client couvrant la date
  const { data: resa } = await supabase
    .from('reservations')
    .select('id, start_datetime, end_datetime, clients(id, first_name, last_name, phone, email)')
    .eq('vehicle_id', vehicleId)
    .lte('start_datetime', iso)
    .gte('end_datetime', iso)
    .in('status', ['en_cours', 'terminee', 'en_retard'])
    .order('start_datetime', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (resa) {
    const client = Array.isArray(resa.clients) ? resa.clients[0] : resa.clients
    return { type: 'client', reservationId: resa.id, client: client ?? null }
  }

  // 2) Déplacement interne couvrant la date
  const { data: trip } = await supabase
    .from('internal_trips')
    .select('id, user_id, start_datetime, end_datetime, profiles(id, full_name)')
    .eq('vehicle_id', vehicleId)
    .lte('start_datetime', iso)
    .gte('end_datetime', iso)
    .limit(1)
    .maybeSingle()

  if (trip) {
    const u = Array.isArray(trip.profiles) ? trip.profiles[0] : trip.profiles
    return { type: 'internal', internalUser: u ?? null }
  }

  return null
}
