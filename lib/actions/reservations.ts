'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { generateReservationNumber, generateContractNumber, calculateRentalDays, calculateRentalPrice } from '@/lib/utils'
import type { ReservationStatus } from '@/types/database'

export async function createReservation(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const vehicleId = formData.get('vehicle_id') as string
  const clientId = formData.get('client_id') as string
  const startDatetime = formData.get('start_datetime') as string
  const endDatetime = formData.get('end_datetime') as string
  const dailyPrice = Number(formData.get('daily_price'))

  // Check conflict
  const { data: conflicts } = await supabase
    .from('reservations')
    .select('id')
    .eq('vehicle_id', vehicleId)
    .not('status', 'in', '("annulee","terminee")')
    .or(`start_datetime.lt.${endDatetime},end_datetime.gt.${startDatetime}`)
    .limit(1)

  if (conflicts && conflicts.length > 0) {
    return { error: 'Ce véhicule est déjà réservé sur cette période.' }
  }

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('weekly_price, km_included_daily, extra_km_price')
    .eq('id', vehicleId)
    .single()

  const days = calculateRentalDays(startDatetime, endDatetime)
  const totalPrice = calculateRentalPrice(dailyPrice, vehicle?.weekly_price ?? null, days)

  const payload = {
    reservation_number: generateReservationNumber(),
    vehicle_id: vehicleId,
    client_id: clientId,
    start_datetime: startDatetime,
    end_datetime: endDatetime,
    status: 'option' as ReservationStatus,
    daily_price: dailyPrice,
    total_price: totalPrice,
    km_included: formData.get('km_included') ? Number(formData.get('km_included')) : vehicle?.km_included_daily ?? null,
    extra_km_price: formData.get('extra_km_price') ? Number(formData.get('extra_km_price')) : vehicle?.extra_km_price ?? null,
    deposit_amount: formData.get('deposit_amount') ? Number(formData.get('deposit_amount')) : null,
    deposit_method: formData.get('deposit_method') as string || null,
    deposit_ref: formData.get('deposit_ref') as string || null,
    internal_notes: formData.get('internal_notes') as string || null,
    created_by: user.id,
  }

  const { data, error } = await supabase.from('reservations').insert(payload).select('id').single()
  if (error) return { error: error.message }

  // Update vehicle status to reserved
  await supabase.from('vehicles').update({ status: 'reserve' }).eq('id', vehicleId)

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'reservation_created',
    entity_type: 'reservations',
    entity_id: data.id,
    metadata: { reservation_number: payload.reservation_number },
  })

  revalidatePath('/reservations')
  revalidatePath('/calendar')
  redirect(`/reservations/${data.id}`)
}

export async function updateReservationStatus(id: string, status: ReservationStatus) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: reservation } = await supabase
    .from('reservations')
    .select('vehicle_id, status')
    .eq('id', id)
    .single()

  if (!reservation) return { error: 'Réservation introuvable' }

  await supabase.from('reservations').update({ status }).eq('id', id)

  // Sync vehicle status
  const vehicleStatus = status === 'en_cours' ? 'loue'
    : status === 'terminee' || status === 'annulee' ? 'disponible'
    : status === 'confirmee' || status === 'option' ? 'reserve'
    : null

  if (vehicleStatus) {
    await supabase.from('vehicles').update({ status: vehicleStatus }).eq('id', reservation.vehicle_id)
  }

  // If starting, create contract
  if (status === 'en_cours') {
    const { data: existing } = await supabase
      .from('contracts')
      .select('id')
      .eq('reservation_id', id)
      .limit(1)

    if (!existing || existing.length === 0) {
      await supabase.from('contracts').insert({
        contract_number: generateContractNumber(),
        reservation_id: id,
        status: 'a_signer',
        created_by: user.id,
      })
    }
  }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'reservation_status_changed',
    entity_type: 'reservations',
    entity_id: id,
    metadata: { status },
  })

  revalidatePath(`/reservations/${id}`)
  revalidatePath('/reservations')
  revalidatePath('/')
  return { success: true }
}

export async function updateReservationDates(
  id: string,
  startDatetime: string,
  endDatetime: string,
  newDailyPrice?: number,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: reservation } = await supabase
    .from('reservations')
    .select('daily_price, status, vehicle:vehicles(weekly_price)')
    .eq('id', id)
    .single()

  if (!reservation) return { error: 'Réservation introuvable' }

  const days = calculateRentalDays(startDatetime, endDatetime)
  if (days <= 0) return { error: 'Les dates sont invalides.' }

  const effectiveDailyPrice = (newDailyPrice != null && newDailyPrice > 0)
    ? newDailyPrice
    : reservation.daily_price

  const vehicle = Array.isArray(reservation.vehicle) ? reservation.vehicle[0] : reservation.vehicle as any
  const totalPrice = calculateRentalPrice(
    effectiveDailyPrice,
    vehicle?.weekly_price ?? null,
    days,
  )

  const { error } = await supabase.from('reservations').update({
    start_datetime: startDatetime,
    end_datetime: endDatetime,
    daily_price: effectiveDailyPrice,
    total_price: totalPrice,
  }).eq('id', id)

  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'reservation_dates_updated',
    entity_type: 'reservations',
    entity_id: id,
    metadata: {
      start_datetime: startDatetime,
      end_datetime: endDatetime,
      daily_price: effectiveDailyPrice,
      total_price: totalPrice,
      days,
    },
  })

  revalidatePath(`/reservations/${id}`)
  revalidatePath('/reservations')
  revalidatePath('/calendar')
  return { success: true, totalPrice, days }
}

export async function validateContract(contractId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, status, reservation_id')
    .eq('id', contractId)
    .single()

  if (!contract) return { error: 'Contrat introuvable' }
  if (contract.status === 'cloture') return { error: 'Contrat déjà clôturé' }

  // Vérifier EDL départ signé
  const { data: depInsp } = await supabase
    .from('inspections')
    .select('id, client_signature_svg')
    .eq('contract_id', contractId)
    .eq('type', 'depart')
    .not('client_signature_svg', 'is', null)
    .limit(1)
    .single()

  if (!depInsp) return { error: "L'état des lieux de départ signé est requis pour valider le contrat." }

  // Vérifier EDL retour signé
  const { data: arrInsp } = await supabase
    .from('inspections')
    .select('id, client_signature_svg')
    .eq('contract_id', contractId)
    .eq('type', 'arrivee')
    .not('client_signature_svg', 'is', null)
    .limit(1)
    .single()

  if (!arrInsp) return { error: "L'état des lieux de retour signé est requis pour valider le contrat." }

  await supabase.from('contracts').update({ status: 'cloture' }).eq('id', contractId)

  if (contract.reservation_id) {
    await supabase.from('reservations').update({ status: 'terminee' }).eq('id', contract.reservation_id)
  }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'contract_validated',
    entity_type: 'contracts',
    entity_id: contractId,
    metadata: { dep_inspection: depInsp.id, arr_inspection: arrInsp.id },
  })

  revalidatePath(`/reservations/${contract.reservation_id}`)
  revalidatePath('/reservations')
  return { success: true }
}
