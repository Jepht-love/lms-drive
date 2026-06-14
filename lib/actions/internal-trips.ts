'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'internal_trip_started',
    entity_type: 'internal_trips',
    entity_id: data.id,
    metadata: { vehicle_id: payload.vehicle_id, purpose: payload.purpose },
  })

  revalidatePath('/internal-trips')
  return { success: true }
}

export async function endTrip(tripId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const kmEnd = Number(formData.get('km_end'))

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
    tolls_amount: formData.get('tolls_amount') ? Number(formData.get('tolls_amount')) : null,
    expenses_amount: formData.get('expenses_amount') ? Number(formData.get('expenses_amount')) : null,
  }).eq('id', tripId)

  if (error) return { error: error.message }

  // Update vehicle km
  await supabase.from('vehicles').update({ current_km: kmEnd }).eq('id', trip.vehicle_id)

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'internal_trip_ended',
    entity_type: 'internal_trips',
    entity_id: tripId,
    metadata: { km_end: kmEnd },
  })

  revalidatePath('/internal-trips')
  return { success: true }
}
