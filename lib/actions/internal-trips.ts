'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncTripToCalendar } from '@/lib/calendar/syncInternalTrip'

export async function startTrip(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const payload = {
    vehicle_id: formData.get('vehicle_id') as string,
    user_id: user.id,
    start_datetime: new Date().toISOString(),
    purpose: formData.get('purpose') as string,
    purpose_notes: formData.get('purpose_notes') as string || null,
    km_start: Number(formData.get('km_start')),
    fuel_start: formData.get('fuel_start') ? Number(formData.get('fuel_start')) : null,
    notes: formData.get('notes') as string || null,
  }

  const { data, error } = await supabase.from('internal_trips').insert(payload).select('id').single()
  if (error) return { error: error.message }

  await syncTripToCalendar(data.id)

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'internal_trip_started',
    entity_type: 'internal_trips',
    entity_id: data.id,
    metadata: { vehicle_id: payload.vehicle_id, purpose: payload.purpose },
  })

  revalidatePath('/internal-trips')
  revalidatePath('/calendrier')
  return { success: true }
}

export async function endTrip(tripId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const kmEnd = Number(formData.get('km_end'))
  const tolls = formData.get('tolls_amount') ? Number(formData.get('tolls_amount')) : 0
  const expenses = formData.get('expenses_amount') ? Number(formData.get('expenses_amount')) : 0

  const { data: trip } = await supabase
    .from('internal_trips')
    .select('vehicle_id, km_start')
    .eq('id', tripId)
    .single()

  if (!trip) return { error: 'Déplacement introuvable' }
  if (kmEnd < trip.km_start) return { error: 'Le KM retour doit être supérieur au KM départ' }

  const { error } = await supabase.from('internal_trips').update({
    end_datetime: new Date().toISOString(),
    km_end: kmEnd,
    fuel_end: formData.get('fuel_end') ? Number(formData.get('fuel_end')) : null,
    tolls_amount: tolls || null,
    expenses_amount: expenses || null,
  }).eq('id', tripId)

  if (error) return { error: error.message }

  // Écritures cross-module réservées au gérant/associé par RLS (vehicles_write_managers,
  // ft_managers). Un employé peut clôturer son déplacement → on passe par le client admin
  // pour que le km ET la compta soient réellement écrits (sinon échec silencieux).
  const admin = createAdminClient()

  // Mise à jour du km véhicule
  await admin.from('vehicles').update({ current_km: kmEnd }).eq('id', trip.vehicle_id)

  // Transmission auto en comptabilité : péages + frais du déplacement interne
  // deviennent des charges (anti-doublon par `reference` si endTrip rejoué).
  const today = new Date().toISOString().slice(0, 10)
  const tollsRef = `trip-tolls:${tripId}`
  const expRef = `trip-exp:${tripId}`
  const { data: alreadyBooked } = await admin
    .from('financial_transactions').select('reference').in('reference', [tollsRef, expRef])
  const booked = new Set((alreadyBooked ?? []).map(r => r.reference))
  const charges = []
  if (tolls > 0 && !booked.has(tollsRef)) {
    charges.push({ date: today, type: 'depense', category: 'peages', amount: tolls,
      vehicle_id: trip.vehicle_id, reference: tollsRef,
      notes: 'Péages — déplacement interne', created_by: user.id })
  }
  if (expenses > 0 && !booked.has(expRef)) {
    charges.push({ date: today, type: 'depense', category: 'deplacement_interne', amount: expenses,
      vehicle_id: trip.vehicle_id, reference: expRef,
      notes: 'Frais — déplacement interne', created_by: user.id })
  }
  if (charges.length) {
    const { error: chargeErr } = await admin.from('financial_transactions').insert(charges)
    if (chargeErr) console.error('endTrip — écritures compta échouées:', chargeErr.message)
  }

  await syncTripToCalendar(tripId)

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'internal_trip_ended',
    entity_type: 'internal_trips',
    entity_id: tripId,
    metadata: { km_end: kmEnd },
  })

  revalidatePath('/internal-trips')
  revalidatePath('/calendrier')
  return { success: true }
}
