'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { removeReservationFromCalendar } from '@/lib/calendar/syncRental'
import { recomputeVehicleStatus } from '@/lib/vehicles/vehicleStatus'

export async function deleteVehicle(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Soft delete
  const { error } = await supabase.from('vehicles').update({ is_active: false }).eq('id', id)
  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id: user.id, action: 'vehicle_deleted',
    entity_type: 'vehicles', entity_id: id,
  })

  revalidatePath('/vehicles')
  redirect('/vehicles')
}

export async function deleteClient(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) {
    if (error.code === '23503') return { error: 'Ce client a des réservations ou documents associés — suppression impossible. Archivez ou supprimez-les d\'abord.' }
    return { error: error.message }
  }

  await supabase.from('audit_logs').insert({
    user_id: user.id, action: 'client_deleted',
    entity_type: 'clients', entity_id: id,
  })

  revalidatePath('/clients')
  redirect('/clients')
}

export async function deleteReservation(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: reservation } = await supabase
    .from('reservations').select('vehicle_id').eq('id', id).single()

  // 1. Événements calendrier
  await removeReservationFromCalendar(id)

  // 2. Cascade contracts → inspections → inspection_photos
  const { data: contracts } = await supabase
    .from('contracts').select('id').eq('reservation_id', id)
  if (contracts && contracts.length > 0) {
    const contractIds = contracts.map(c => c.id)
    const { data: inspections } = await supabase
      .from('inspections').select('id').in('contract_id', contractIds)
    if (inspections && inspections.length > 0) {
      const inspectionIds = inspections.map(i => i.id)
      await supabase.from('inspection_photos').delete().in('inspection_id', inspectionIds)
      await supabase.from('inspections').delete().in('id', inspectionIds)
    }
    await supabase.from('contracts').delete().in('id', contractIds)
  }

  // 3. Déréférencer les FK sans CASCADE
  await supabase.from('tasks').update({ reservation_id: null }).eq('reservation_id', id)
  await supabase.from('infractions').update({ reservation_id: null }).eq('reservation_id', id)
  await supabase.from('accidents').update({ reservation_id: null }).eq('reservation_id', id)
  await supabase.from('financial_transactions').update({ reservation_id: null }).eq('reservation_id', id)
  await supabase.from('inter_agency_rentals').update({ client_reservation_id: null }).eq('client_reservation_id', id)

  // 4. Supprimer la réservation
  const { error } = await supabase.from('reservations').delete().eq('id', id)
  if (error) return { error: error.message }

  if (reservation) await recomputeVehicleStatus(supabase, reservation.vehicle_id)

  await supabase.from('audit_logs').insert({
    user_id: user.id, action: 'reservation_deleted',
    entity_type: 'reservations', entity_id: id,
  })

  revalidatePath('/reservations')
  revalidatePath('/vehicles')
  redirect('/reservations')
}

export async function deleteContract(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Récupérer les inspections liées
  const { data: inspections } = await supabase
    .from('inspections')
    .select('id')
    .eq('contract_id', id)

  const inspectionIds = (inspections ?? []).map(i => i.id)

  // Supprimer les photos d'inspection
  if (inspectionIds.length > 0) {
    await supabase.from('inspection_photos').delete().in('inspection_id', inspectionIds)
    await supabase.from('inspections').delete().in('id', inspectionIds)
  }

  // Supprimer le contrat
  const { error } = await supabase.from('contracts').delete().eq('id', id)
  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id: user.id, action: 'contract_deleted',
    entity_type: 'contracts', entity_id: id,
  })

  revalidatePath('/contracts')
  revalidatePath('/reservations')
  redirect('/contracts')
}

export async function resetInspection(inspectionId: string, redirectTo: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Supprimer photos puis inspection
  await supabase.from('inspection_photos').delete().eq('inspection_id', inspectionId)
  const { error } = await supabase.from('inspections').delete().eq('id', inspectionId)
  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id: user.id, action: 'inspection_reset',
    entity_type: 'inspections', entity_id: inspectionId,
  })

  revalidatePath('/reservations')
  redirect(redirectTo)
}

export async function updateDepositStatus(reservationId: string, depositStatus: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error } = await supabase
    .from('reservations')
    .update({ deposit_status: depositStatus })
    .eq('id', reservationId)

  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id: user.id, action: 'deposit_status_updated',
    entity_type: 'reservations', entity_id: reservationId,
    metadata: { deposit_status: depositStatus },
  })

  revalidatePath(`/reservations/${reservationId}`)
  return { success: true }
}
