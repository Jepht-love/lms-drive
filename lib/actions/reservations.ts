'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function updatePaymentInfo(
  reservationId: string,
  data: {
    payment_status: string
    payment_method: string | null
    payment_amount: number | null
    payment_ref: string | null
    payment_date: string | null
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error } = await supabase
    .from('reservations')
    .update(data)
    .eq('id', reservationId)

  if (error) return { error: error.message }

  revalidatePath(`/reservations/${reservationId}`)
  return { success: true }
}
import { logAudit } from '@/lib/audit/log'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateReservationNumber, generateContractNumber, calculateRentalDays, calculateRentalPrice } from '@/lib/utils'
import { syncReservationToCalendar } from '@/lib/calendar/syncRental'
import { recomputeVehicleStatus } from '@/lib/vehicles/vehicleStatus'
import { broadcastPushToManagers } from '@/lib/push/broadcastPush'
import { generateInvoiceDraft } from '@/lib/actions/invoices'
import type { ReservationStatus } from '@/types/database'

const DIACRITICS_RE = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g')

function normalizeName(s: string): string {
  return s.normalize('NFD').replace(DIACRITICS_RE, '').trim().toLowerCase()
}

// Bloque le contournement « même personne, nouveau numéro » : vrai si un AUTRE
// client (nom+prénom identique, comparaison insensible accents/casse) est blacklisté.
async function isNameBlacklisted(
  supabase: Awaited<ReturnType<typeof createClient>>,
  firstName: string,
  lastName: string,
  excludeClientId?: string,
): Promise<boolean> {
  let query = supabase.from('clients').select('id, first_name, last_name').eq('status', 'blackliste')
  if (excludeClientId) query = query.neq('id', excludeClientId)
  const { data } = await query
  const target = normalizeName(`${firstName} ${lastName}`)
  return (data ?? []).some(c => normalizeName(`${c.first_name} ${c.last_name}`) === target)
}

// Poste automatiquement le CA d'une location terminée en comptabilité (CDC :
// « les données financières seront intégrées à la comptabilité »). Idempotent —
// ne crée rien si une recette « location » existe déjà pour cette réservation.
// Utilise le client admin (service role) car la clôture peut être faite par un
// employé, alors que financial_transactions est en RLS gérant/associé.
async function postRentalRevenue(reservationId: string, userId: string) {
  const admin = createAdminClient()

  const { data: res } = await admin
    .from('reservations')
    .select('total_price, vehicle_id, end_datetime, reservation_number, extra_km_amount, late_fee_amount, late_fee_validated, deposit_deducted')
    .eq('id', reservationId)
    .single()
  if (!res) return

  const { data: existing } = await admin
    .from('financial_transactions')
    .select('id')
    .eq('reservation_id', reservationId)
    .eq('category', 'location')
    .limit(1)
  if (existing && existing.length > 0) return

  // Date réelle de clôture (aujourd'hui), pas la date prévue de fin de location.
  // Sans ça, les retours tardifs postent dans le passé et n'apparaissent pas dans
  // les recettes du jour.
  const date = new Date().toISOString().slice(0, 10)
  const base = {
    date,
    type: 'recette' as const,
    vehicle_id: res.vehicle_id,
    reservation_id: reservationId,
    reference: res.reservation_number,
    created_by: userId,
  }
  const rows: Record<string, unknown>[] = []
  if ((res.total_price ?? 0) > 0) {
    rows.push({ ...base, category: 'location', amount: res.total_price, notes: `Location ${res.reservation_number}` })
  }
  if ((res.extra_km_amount ?? 0) > 0) {
    rows.push({ ...base, category: 'km_supplementaires', amount: res.extra_km_amount, notes: `Km supplémentaires ${res.reservation_number}` })
  }
  if ((res.late_fee_amount ?? 0) > 0 && res.late_fee_validated) {
    rows.push({ ...base, category: 'frais_retard', amount: res.late_fee_amount, notes: `Frais de retard ${res.reservation_number}` })
  }
  if ((res.deposit_deducted ?? 0) > 0) {
    rows.push({ ...base, category: 'degats', amount: res.deposit_deducted, notes: `Caution retenue ${res.reservation_number}` })
  }
  if (rows.length) await admin.from('financial_transactions').insert(rows)
}

export async function createReservation(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const vehicleId = formData.get('vehicle_id') as string
  let clientId = formData.get('client_id') as string
  const startDatetime = formData.get('start_datetime') as string
  const endDatetime = formData.get('end_datetime') as string
  const dailyPrice = Number(formData.get('daily_price'))

  // Nouveau client créé à la volée (prénom/nom/téléphone uniquement)
  const newFirstName = (formData.get('new_client_first_name') as string)?.trim()
  const newLastName = (formData.get('new_client_last_name') as string)?.trim()
  const newPhone = (formData.get('new_client_phone') as string)?.trim()

  let clientName = ''

  if (newFirstName && newLastName && newPhone) {
    if (await isNameBlacklisted(supabase, newFirstName, newLastName)) {
      return { error: 'Ce nom correspond à un client blacklisté — réservation impossible.' }
    }
    const admin = createAdminClient()
    const { data: newClient, error: clientErr } = await admin
      .from('clients')
      .insert({ first_name: newFirstName, last_name: newLastName, phone: newPhone, created_by: user.id })
      .select('id')
      .single()
    if (clientErr || !newClient) return { error: clientErr?.message ?? 'Erreur lors de la création du client' }
    clientId = newClient.id
    clientName = `${newFirstName} ${newLastName}`
  } else {
    const { data: selectedClient } = await supabase
      .from('clients').select('status, first_name, last_name').eq('id', clientId).maybeSingle()
    if (selectedClient?.status === 'blackliste') {
      return { error: 'Ce client est blacklisté — réservation impossible.' }
    }
    if (selectedClient && await isNameBlacklisted(supabase, selectedClient.first_name, selectedClient.last_name, clientId)) {
      return { error: 'Ce nom correspond à un client blacklisté sous un autre dossier — réservation impossible.' }
    }
    clientName = selectedClient ? `${selectedClient.first_name} ${selectedClient.last_name}` : ''
  }

  // Check conflict — chevauchement réel : l'existante commence avant la fin de
  // la nouvelle ET se termine après le début de la nouvelle. Le .or() précédent
  // combinait les deux conditions en OU au lieu de ET, donc presque toute paire
  // de réservations matchait (faux conflit permanent dès qu'un véhicule avait
  // déjà une réservation, même sans aucun chevauchement réel).
  const { data: conflicts } = await supabase
    .from('reservations')
    .select('id')
    .eq('vehicle_id', vehicleId)
    .not('status', 'in', '("annulee","terminee")')
    .lt('start_datetime', endDatetime)
    .gt('end_datetime', startDatetime)
    .limit(1)

  if (conflicts && conflicts.length > 0) {
    return { error: 'Ce véhicule est déjà réservé sur cette période.' }
  }

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('weekly_price, km_included_daily, extra_km_price, brand, model, color')
    .eq('id', vehicleId)
    .single()

  const days = calculateRentalDays(startDatetime, endDatetime)
  const grossPrice = calculateRentalPrice(dailyPrice, vehicle?.weekly_price ?? null, days)

  // Remise fidélité client appliquée automatiquement (tolérant à l'absence de la
  // colonne discount_percent avant la migration 019 → remise 0).
  const { data: cli } = await supabase
    .from('clients').select('discount_percent').eq('id', clientId).maybeSingle()
  const discountPct = Math.min(100, Math.max(0, Number((cli as { discount_percent?: number } | null)?.discount_percent ?? 0) || 0))
  const totalPrice = discountPct > 0
    ? Math.round(grossPrice * (1 - discountPct / 100) * 100) / 100
    : grossPrice

  const paymentAmount = formData.get('payment_amount') ? Number(formData.get('payment_amount')) : 0

  const baseNotes = (formData.get('internal_notes') as string) || ''
  const internalNotes = discountPct > 0
    ? `${baseNotes}${baseNotes ? '\n' : ''}Remise fidélité ${discountPct}% appliquée (tarif ${grossPrice}€ → ${totalPrice}€).`.trim()
    : (baseNotes || null)

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
    payment_amount: paymentAmount > 0 ? paymentAmount : null,
    payment_status: paymentAmount > 0 ? (paymentAmount >= totalPrice ? 'paye' : 'partiel') : 'en_attente',
    internal_notes: internalNotes,
    created_by: user.id,
  }

  const { data, error } = await supabase.from('reservations').insert(payload).select('id').single()
  if (error) return { error: error.message }

  await recomputeVehicleStatus(supabase, vehicleId)

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'reservation_created',
    entity_type: 'reservations',
    entity_id: data.id,
    metadata: { reservation_number: payload.reservation_number },
  })

  await syncReservationToCalendar(data.id)

  const startFmt = new Date(startDatetime).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  const vehLabel = vehicle
    ? `${vehicle.brand} ${vehicle.model}${vehicle.color ? ' ' + vehicle.color : ''}`
    : ''
  await broadcastPushToManagers({
    title: 'Nouvelle réservation',
    body: `${clientName || payload.reservation_number}${vehLabel ? ' — ' + vehLabel : ''} · départ le ${startFmt}`,
    url: `/reservations/${data.id}`,
  })

  revalidatePath('/')
  revalidatePath('/reservations')
  revalidatePath('/calendar')
  revalidatePath('/calendrier')
  redirect(`/reservations/${data.id}`)
}

export async function updateReservationStatus(id: string, status: ReservationStatus) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: reservation } = await supabase
    .from('reservations')
    .select('vehicle_id, status, reservation_number, start_datetime, end_datetime, client:clients(first_name, last_name), vehicle:vehicles(brand, model, plate, color)')
    .eq('id', id)
    .single()

  if (!reservation) return { error: 'Réservation introuvable' }

  await supabase.from('reservations').update({ status }).eq('id', id)

  await recomputeVehicleStatus(supabase, reservation.vehicle_id)

  const clt = reservation.client as any
  const veh = reservation.vehicle as any
  const pushClientName = clt ? `${clt.first_name} ${clt.last_name}` : reservation.reservation_number
  const pushVehicle = veh ? `${veh.brand} ${veh.model}${veh.color ? ' ' + veh.color : ''} (${veh.plate})` : ''
  const fmtDate = (iso: string | null) => iso
    ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : ''
  const departFmt = fmtDate(reservation.start_datetime)
  const retourFmt = fmtDate(reservation.end_datetime)

  const PUSH_LABELS: Partial<Record<ReservationStatus, { title: string; body: string }>> = {
    confirmee:  { title: 'Réservation confirmée', body: `${pushClientName}${pushVehicle ? ' — ' + pushVehicle : ''}${departFmt ? ' · départ le ' + departFmt : ''}` },
    en_cours:   { title: 'Départ effectué',        body: `${pushClientName} — ${pushVehicle}${retourFmt ? ' · retour prévu le ' + retourFmt : ''}` },
    en_retard:  { title: 'Retour en retard',       body: `${pushClientName} — ${pushVehicle}${retourFmt ? ' · prévu le ' + retourFmt : ''}` },
    terminee:   { title: 'Retour effectué',        body: `${pushClientName} — ${pushVehicle} rendu` },
  }
  const pushMsg = PUSH_LABELS[status]
  if (pushMsg) {
    await broadcastPushToManagers({ ...pushMsg, url: `/reservations/${id}` })
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

  // Location terminée → CA intégré automatiquement en comptabilité
  if (status === 'terminee') {
    await postRentalRevenue(id, user.id)
  }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'reservation_status_changed',
    entity_type: 'reservations',
    entity_id: id,
    metadata: { status },
  })

  await syncReservationToCalendar(id)

  revalidatePath(`/reservations/${id}`)
  revalidatePath('/reservations')
  revalidatePath('/accounting')
  revalidatePath('/')
  revalidatePath('/calendrier')
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
    .select('daily_price, status, vehicle_id, vehicle:vehicles(weekly_price)')
    .eq('id', id)
    .single()

  if (!reservation) return { error: 'Réservation introuvable' }

  const days = calculateRentalDays(startDatetime, endDatetime)
  if (days <= 0) return { error: 'Les dates sont invalides.' }

  // Même contrôle de chevauchement que createReservation (ET, pas OU) — sans ça,
  // déplacer les dates d'une réservation peut la faire chevaucher une autre.
  const { data: conflicts } = await supabase
    .from('reservations')
    .select('id')
    .eq('vehicle_id', reservation.vehicle_id)
    .neq('id', id)
    .not('status', 'in', '("annulee","terminee")')
    .lt('start_datetime', endDatetime)
    .gt('end_datetime', startDatetime)
    .limit(1)

  if (conflicts && conflicts.length > 0) {
    return { error: 'Ce véhicule est déjà réservé sur cette période.' }
  }

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

  await syncReservationToCalendar(id)

  revalidatePath('/')
  revalidatePath(`/reservations/${id}`)
  revalidatePath('/reservations')
  revalidatePath('/calendar')
  revalidatePath('/calendrier')
  return { success: true, totalPrice, days }
}

// Prolongation d'un contrat en cours : +jours (le km inclus/jour s'applique aux
// nouveaux jours), +prix recalculé sur la période totale. Règle métier : la
// prolongation doit être demandée AU PLUS TARD 12 h avant la fin prévue — au-delà,
// il faut créer une nouvelle réservation. Le « maintenant » est pris CÔTÉ SERVEUR.
const PROLONG_DEADLINE_HOURS = 12

export async function prolongReservation(
  id: string,
  additionalDays: number,
  newDailyPrice?: number,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  if (!Number.isFinite(additionalDays) || additionalDays < 1) {
    return { error: 'Indiquez un nombre de jours de prolongation valide (≥ 1).' }
  }

  const { data: reservation } = await supabase
    .from('reservations')
    .select('start_datetime, end_datetime, daily_price, total_price, status, vehicle_id, vehicle:vehicles(weekly_price)')
    .eq('id', id)
    .single()

  if (!reservation) return { error: 'Réservation introuvable' }
  if (!['en_cours', 'confirmee', 'en_retard'].includes(reservation.status)) {
    return { error: "Seule une location en cours peut être prolongée." }
  }

  // Garde-fou 12 h (heure serveur)
  const endMs = new Date(reservation.end_datetime).getTime()
  const deadlineMs = endMs - PROLONG_DEADLINE_HOURS * 3600 * 1000
  if (Date.now() > deadlineMs) {
    return {
      error: `La prolongation doit être demandée au moins ${PROLONG_DEADLINE_HOURS} h avant la fin prévue. Ce délai est dépassé — créez une nouvelle réservation.`,
    }
  }

  const newEnd = new Date(endMs + additionalDays * 24 * 3600 * 1000).toISOString()

  // Conflit : un autre engagement sur ce véhicule chevauche la période prolongée
  const { data: conflicts } = await supabase
    .from('reservations')
    .select('id')
    .eq('vehicle_id', reservation.vehicle_id)
    .neq('id', id)
    .not('status', 'in', '("annulee","terminee")')
    .lt('start_datetime', newEnd)
    .gt('end_datetime', reservation.end_datetime)
    .limit(1)

  if (conflicts && conflicts.length > 0) {
    return { error: 'Le véhicule est déjà réservé juste après — prolongation impossible sur cette période.' }
  }

  const vehicle = Array.isArray(reservation.vehicle) ? reservation.vehicle[0] : reservation.vehicle as any
  const effectiveDailyPrice = (newDailyPrice != null && newDailyPrice > 0) ? newDailyPrice : reservation.daily_price
  const totalDays = calculateRentalDays(reservation.start_datetime, newEnd)
  const newTotalPrice = calculateRentalPrice(effectiveDailyPrice, vehicle?.weekly_price ?? null, totalDays)
  const previousTotal = reservation.total_price ?? 0
  const addedAmount   = Math.round((newTotalPrice - previousTotal) * 100) / 100

  const { error } = await supabase.from('reservations').update({
    end_datetime: newEnd,
    daily_price: effectiveDailyPrice,
    total_price: newTotalPrice,
  }).eq('id', id)

  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'reservation_prolonged',
    entity_type: 'reservations',
    entity_id: id,
    metadata: {
      additional_days: additionalDays,
      previous_end: reservation.end_datetime,
      new_end: newEnd,
      previous_total_price: previousTotal,
      added_amount: addedAmount,
      new_total_price: newTotalPrice,
      daily_price: effectiveDailyPrice,
    },
  })

  await syncReservationToCalendar(id)

  revalidatePath('/')
  revalidatePath(`/reservations/${id}`)
  revalidatePath('/reservations')
  revalidatePath('/calendar')
  revalidatePath('/calendrier')
  return { success: true, newEnd, newTotalPrice, totalDays }
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
    const { data: closedRes } = await supabase
      .from('reservations')
      .update({ status: 'terminee' })
      .eq('id', contract.reservation_id)
      .select('vehicle_id')
      .single()
    // CA intégré automatiquement en comptabilité à la clôture du contrat
    await postRentalRevenue(contract.reservation_id, user.id)
    await syncReservationToCalendar(contract.reservation_id)
    if (closedRes) await recomputeVehicleStatus(supabase, closedRes.vehicle_id)
    // Phase D — brouillon de facture de restitution si des frais complémentaires existent
    await generateInvoiceDraft(contractId)

    // Opération inter-agences entrante : le véhicule était temporaire (partenaire)
    // → on l'archive, et on clôture l'opération liée.
    if (closedRes?.vehicle_id) {
      const { data: extVehicle } = await supabase
        .from('vehicles').select('is_external').eq('id', closedRes.vehicle_id).maybeSingle()
      if (extVehicle?.is_external) {
        await supabase.from('vehicles')
          .update({ is_active: false, status: 'hors_service' })
          .eq('id', closedRes.vehicle_id)
        await supabase.from('inter_agency_rentals')
          .update({ status: 'cloture', end_date_actual: new Date().toISOString() })
          .eq('client_reservation_id', contract.reservation_id)
      }
    }
  }

  // Journal d'audit — phrase lisible avec client + véhicule (ex. demandé par le
  // gérant : « Contrat validé — Babacar Diallo — Renault Captur »).
  let validatedSummary = 'Contrat validé'
  if (contract.reservation_id) {
    const { data: resInfo } = await supabase
      .from('reservations')
      .select('clients(first_name, last_name), vehicles(brand, model, plate)')
      .eq('id', contract.reservation_id).single()
    const cl = Array.isArray(resInfo?.clients) ? resInfo?.clients[0] : resInfo?.clients
    const ve = Array.isArray(resInfo?.vehicles) ? resInfo?.vehicles[0] : resInfo?.vehicles
    const who = [cl?.first_name, cl?.last_name].filter(Boolean).join(' ')
    const veh = ve ? `${ve.brand} ${ve.model}${ve.plate ? ` (${ve.plate})` : ''}` : ''
    validatedSummary = `Contrat validé${who ? ` — ${who}` : ''}${veh ? ` — ${veh}` : ''}`
  }
  await logAudit(supabase, {
    userId: user.id,
    action: 'contract_validated',
    entityType: 'contracts',
    entityId: contractId,
    summary: validatedSummary,
    metadata: { dep_inspection: depInsp.id, arr_inspection: arrInsp.id },
  })

  revalidatePath(`/reservations/${contract.reservation_id}`)
  revalidatePath('/reservations')
  revalidatePath('/accounting')
  revalidatePath('/calendrier')
  return { success: true }
}
