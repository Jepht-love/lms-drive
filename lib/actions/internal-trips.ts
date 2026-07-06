'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncTripToCalendar } from '@/lib/calendar/syncInternalTrip'

export async function startTrip(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Gérant/associé peuvent démarrer un déplacement au nom d'un collaborateur ;
  // un employé ne peut le démarrer que pour lui-même. Défaut = soi-même.
  const isManager = isManagerRole(await getRole(supabase, user.id))
  const assigneeRaw = formData.get('user_id') as string | null
  const assignee = isManager && assigneeRaw ? assigneeRaw : user.id

  const payload = {
    vehicle_id: formData.get('vehicle_id') as string,
    user_id: assignee,
    start_datetime: new Date().toISOString(),
    purpose: formData.get('purpose') as string,
    purpose_notes: formData.get('purpose_notes') as string || null,
    status: 'en_cours' as const,
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
    metadata: { vehicle_id: payload.vehicle_id, purpose: payload.purpose, assigned_to: assignee },
  })

  revalidatePath('/internal-trips')
  revalidatePath('/calendrier')
  revalidatePath('/')
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
  if (trip.km_start != null && kmEnd < trip.km_start) return { error: 'Le KM retour doit être supérieur au KM départ' }

  const { error } = await supabase.from('internal_trips').update({
    status: 'termine',
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
  revalidatePath('/')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Planification
// ─────────────────────────────────────────────────────────────────────────────

async function getRole(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).single()
  return data?.role ?? null
}

const isManagerRole = (role: string | null) => role === 'gerant' || role === 'associe'

/**
 * Planifie un déplacement pour une date (future ou non), assigné à un
 * collaborateur OU laissé non assigné. Gérant/associé planifient pour n'importe
 * qui ; un employé ne planifie que pour lui-même. Aucun km n'est saisi ici — il
 * le sera au démarrage réel (startPlannedTrip).
 */
export async function planTrip(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const isManager = isManagerRole(await getRole(supabase, user.id))

  const vehicleId = formData.get('vehicle_id') as string
  const purpose = formData.get('purpose') as string
  const startRaw = formData.get('start_datetime') as string
  if (!vehicleId || !purpose) return { error: 'Véhicule et motif requis' }
  if (!startRaw) return { error: 'Date du déplacement requise' }

  // Employé : forcé sur lui-même. Manager : valeur du select ('' ou 'none' = non assigné).
  const assigneeRaw = (formData.get('user_id') as string | null) ?? ''
  const assignee = isManager
    ? (assigneeRaw && assigneeRaw !== 'none' ? assigneeRaw : null)
    : user.id

  const payload = {
    vehicle_id: vehicleId,
    user_id: assignee,
    start_datetime: new Date(startRaw).toISOString(),
    purpose,
    purpose_notes: (formData.get('purpose_notes') as string) || null,
    status: 'planifie' as const,
    notes: (formData.get('notes') as string) || null,
  }

  const { data, error } = await supabase.from('internal_trips').insert(payload).select('id').single()
  if (error) return { error: error.message }

  await syncTripToCalendar(data.id)

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'internal_trip_planned',
    entity_type: 'internal_trips',
    entity_id: data.id,
    metadata: { vehicle_id: vehicleId, purpose, assigned_to: assignee },
  })

  revalidatePath('/internal-trips')
  revalidatePath('/calendrier')
  revalidatePath('/')
  return { success: true }
}

/** (Ré)assigner un déplacement planifié à un conducteur — gérant/associé uniquement. */
export async function assignTrip(tripId: string, userId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  if (!isManagerRole(await getRole(supabase, user.id))) return { error: 'Action réservée au gérant/associé' }

  const { error } = await supabase
    .from('internal_trips')
    .update({ user_id: userId })
    .eq('id', tripId)
    .eq('status', 'planifie')
  if (error) return { error: error.message }

  await syncTripToCalendar(tripId)
  await supabase.from('audit_logs').insert({
    user_id: user.id, action: 'internal_trip_assigned',
    entity_type: 'internal_trips', entity_id: tripId, metadata: { assigned_to: userId },
  })

  revalidatePath('/internal-trips')
  revalidatePath('/calendrier')
  revalidatePath('/')
  return { success: true }
}

/**
 * Démarre un déplacement planifié : passe à "en cours", enregistre le km/carburant
 * réels et fixe l'heure de départ effective. Un non-assigné doit d'abord recevoir
 * un conducteur.
 */
export async function startPlannedTrip(tripId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: trip } = await supabase
    .from('internal_trips')
    .select('user_id, status')
    .eq('id', tripId)
    .single()
  if (!trip) return { error: 'Déplacement introuvable' }
  if (trip.status !== 'planifie') return { error: 'Ce déplacement n’est pas planifié' }
  if (!trip.user_id) return { error: 'Assignez un conducteur avant de démarrer' }

  const { error } = await supabase.from('internal_trips').update({
    status: 'en_cours',
    start_datetime: new Date().toISOString(),
    km_start: Number(formData.get('km_start')),
    fuel_start: formData.get('fuel_start') ? Number(formData.get('fuel_start')) : null,
  }).eq('id', tripId)
  if (error) return { error: error.message }

  await syncTripToCalendar(tripId)
  await supabase.from('audit_logs').insert({
    user_id: user.id, action: 'internal_trip_started',
    entity_type: 'internal_trips', entity_id: tripId, metadata: { from: 'planifie' },
  })

  revalidatePath('/internal-trips')
  revalidatePath('/calendrier')
  revalidatePath('/')
  return { success: true }
}

/** Annule un déplacement encore planifié (propriétaire ou manager via RLS). */
export async function cancelTrip(tripId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error } = await supabase
    .from('internal_trips')
    .update({ status: 'annule' })
    .eq('id', tripId)
    .eq('status', 'planifie')
  if (error) return { error: error.message }

  await syncTripToCalendar(tripId)
  await supabase.from('audit_logs').insert({
    user_id: user.id, action: 'internal_trip_cancelled',
    entity_type: 'internal_trips', entity_id: tripId, metadata: {},
  })

  revalidatePath('/internal-trips')
  revalidatePath('/calendrier')
  revalidatePath('/')
  return { success: true }
}

/**
 * Supprime définitivement un déplacement (propriétaire ou manager via RLS) et
 * nettoie ses artefacts liés : l'événement calendrier (source_key trip-<id>) et
 * les charges compta générées à la clôture (péages / frais). Le km du véhicule
 * n'est PAS reculé — supprimer la trace ne « dé-roule » pas le véhicule.
 */
export async function deleteTrip(tripId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error } = await supabase.from('internal_trips').delete().eq('id', tripId)
  if (error) return { error: error.message }

  // Tables réservées aux managers par RLS → client admin pour le nettoyage.
  const admin = createAdminClient()
  await admin.from('calendar_events').delete().eq('source_key', `trip-${tripId}`)
  await admin.from('financial_transactions').delete().in('reference', [`trip-tolls:${tripId}`, `trip-exp:${tripId}`])

  await supabase.from('audit_logs').insert({
    user_id: user.id, action: 'internal_trip_deleted',
    entity_type: 'internal_trips', entity_id: tripId, metadata: {},
  })

  revalidatePath('/internal-trips')
  revalidatePath('/calendrier')
  revalidatePath('/')
  return { success: true }
}
