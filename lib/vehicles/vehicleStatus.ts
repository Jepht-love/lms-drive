import { createClient } from '@/lib/supabase/server'

/**
 * Recalcule vehicles.status à partir des réservations actives réelles plutôt que
 * de le déduire d'un seul événement ponctuel — corrige le risque de statut
 * orphelin (ex. réservation supprimée, ou contrat clôturé, sans jamais repasser
 * le véhicule à disponible). Ne touche pas un statut de maintenance (a_reparer,
 * en_verification, hors_service, immobilise, mis_a_disposition) : seuls
 * disponible/loue/reserve sont pilotés par les réservations.
 */
export async function recomputeVehicleStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  vehicleId: string,
): Promise<void> {
  const { data: vehicle } = await supabase.from('vehicles').select('status').eq('id', vehicleId).single()
  if (!vehicle || !['disponible', 'loue', 'reserve'].includes(vehicle.status)) return

  const { data: active } = await supabase
    .from('reservations')
    .select('status')
    .eq('vehicle_id', vehicleId)
    .not('status', 'in', '("annulee","terminee")')

  const hasOngoing  = (active ?? []).some(r => ['en_cours', 'en_retard'].includes(r.status))
  const hasUpcoming = (active ?? []).some(r => ['confirmee', 'option'].includes(r.status))
  const next = hasOngoing ? 'loue' : hasUpcoming ? 'reserve' : 'disponible'

  if (next !== vehicle.status) {
    await supabase.from('vehicles').update({ status: next }).eq('id', vehicleId)
  }
}
