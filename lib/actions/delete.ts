'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertManager } from '@/lib/auth/roles'
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
  const denied = await assertManager(supabase, user.id)
  if (denied) return denied

  // Art. 17 RGPD : supprimer les fichiers d'identité avant la ligne DB.
  // Le client admin (service role) contourne la RLS `managers_client_documents`,
  // donc ce garde est indispensable AVANT toute suppression de fichier.
  const admin = createAdminClient()
  const { data: files } = await admin.storage.from('client-documents').list(`clients/${id}`)
  if (files && files.length > 0) {
    const paths = files.map(f => `clients/${id}/${f.name}`)
    await admin.storage.from('client-documents').remove(paths)
  }

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
  // La cascade ci-dessous passe par le client admin (bypass RLS) : sans ce garde,
  // n'importe quel employé authentifié pourrait supprimer une réservation.
  const denied = await assertManager(supabase, user.id)
  if (denied) return denied

  const { data: reservation } = await supabase
    .from('reservations').select('vehicle_id').eq('id', id).single()

  // Client admin pour bypasser la RLS sur toutes les tables liées
  const admin = createAdminClient()

  // 1. Événements calendrier
  await admin.from('calendar_events').delete().eq('reservation_id', id)

  // 2. Cascade contracts → inspections → inspection_photos
  const { data: contracts } = await admin
    .from('contracts').select('id').eq('reservation_id', id)
  if (contracts && contracts.length > 0) {
    const contractIds = contracts.map(c => c.id)
    const { data: inspections } = await admin
      .from('inspections').select('id').in('contract_id', contractIds)
    if (inspections && inspections.length > 0) {
      const inspectionIds = inspections.map(i => i.id)
      await admin.from('inspection_photos').delete().in('inspection_id', inspectionIds)
      await admin.from('inspections').delete().in('id', inspectionIds)
    }
    await admin.from('contracts').delete().in('id', contractIds)
  }

  // 3. Déréférencer les FK sans CASCADE
  await admin.from('tasks').update({ reservation_id: null }).eq('reservation_id', id)
  await admin.from('infractions').update({ reservation_id: null }).eq('reservation_id', id)
  await admin.from('accidents').update({ reservation_id: null }).eq('reservation_id', id)
  await admin.from('financial_transactions').update({ reservation_id: null }).eq('reservation_id', id)
  await admin.from('inter_agency_rentals').update({ client_reservation_id: null }).eq('client_reservation_id', id)

  // 4. Supprimer la réservation
  const { error } = await admin.from('reservations').delete().eq('id', id)
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
  // La cascade ci-dessous passe par le client admin (bypass RLS) : sans ce garde,
  // n'importe quel employé authentifié pourrait supprimer un contrat.
  const denied = await assertManager(supabase, user.id)
  if (denied) return denied

  // Récupérer reservation_id pour revalider la page réservation après suppression
  const { data: contract } = await supabase
    .from('contracts')
    .select('reservation_id')
    .eq('id', id)
    .maybeSingle()
  const reservationId = contract?.reservation_id ?? null

  // Client admin : la RLS bloquait la suppression des inspections en silence,
  // et le contrat cassait ensuite sur inspections_contract_id_fkey (ticket SAV 21/07).
  const admin = createAdminClient()

  // Récupérer les inspections liées
  const { data: inspections } = await admin
    .from('inspections')
    .select('id')
    .eq('contract_id', id)

  const inspectionIds = (inspections ?? []).map(i => i.id)

  // Supprimer les photos d'inspection puis les inspections — en vérifiant chaque étape
  if (inspectionIds.length > 0) {
    const { error: photosError } = await admin
      .from('inspection_photos').delete().in('inspection_id', inspectionIds)
    if (photosError) return { error: photosError.message }
    const { error: inspectionsError } = await admin
      .from('inspections').delete().in('id', inspectionIds)
    if (inspectionsError) return { error: inspectionsError.message }
  }

  // Supprimer le contrat
  const { error } = await admin.from('contracts').delete().eq('id', id)
  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id: user.id, action: 'contract_deleted',
    entity_type: 'contracts', entity_id: id,
  })

  revalidatePath('/contracts')
  revalidatePath('/reservations')
  if (reservationId) revalidatePath(`/reservations/${reservationId}`)
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

export async function updateDepositDeducted(reservationId: string, amount: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  // Écrit dans financial_transactions via le client admin plus bas → garde requis.
  const denied = await assertManager(supabase, user.id)
  if (denied) return denied

  const { error } = await supabase
    .from('reservations')
    .update({ deposit_deducted: amount })
    .eq('id', reservationId)

  if (error) return { error: error.message }

  // Sync comptabilité : si la réservation est clôturée, mettre à jour l'écriture dégâts
  const { data: res } = await supabase
    .from('reservations')
    .select('status, reservation_number, vehicle_id')
    .eq('id', reservationId)
    .single()

  if (res?.status === 'terminee') {
    const admin = createAdminClient()
    await admin.from('financial_transactions')
      .delete()
      .eq('reservation_id', reservationId)
      .eq('category', 'degats')
    if (amount > 0) {
      await admin.from('financial_transactions').insert({
        date: new Date().toISOString().slice(0, 10),
        type: 'recette',
        category: 'degats',
        amount,
        vehicle_id: res.vehicle_id,
        reservation_id: reservationId,
        reference: res.reservation_number,
        notes: `Caution retenue ${res.reservation_number}`,
        created_by: user.id,
      })
    }
    revalidatePath('/accounting')
  }

  await supabase.from('audit_logs').insert({
    user_id: user.id, action: 'deposit_deducted_updated',
    entity_type: 'reservations', entity_id: reservationId,
    metadata: { deposit_deducted: amount },
  })

  revalidatePath(`/reservations/${reservationId}`)
  return { success: true }
}

export async function updateDepositInfo(reservationId: string, depositMethod: string | null, depositRef: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error } = await supabase
    .from('reservations')
    .update({ deposit_method: depositMethod, deposit_ref: depositRef })
    .eq('id', reservationId)

  if (error) return { error: error.message }

  revalidatePath(`/reservations/${reservationId}`)
  return { success: true }
}
