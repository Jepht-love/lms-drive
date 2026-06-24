import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enrichEvents } from '@/lib/calendar/enrichEvents'
import { generateAlertsForEvent } from '@/lib/calendar/generateAlerts'
import { syncReservationToCalendar } from '@/lib/calendar/syncRental'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  const assignedTo = searchParams.getAll('assigned_to')

  if (!start || !end) {
    return NextResponse.json({ error: 'Paramètres start/end requis' }, { status: 400 })
  }

  let query = supabase
    .from('calendar_events')
    .select('*')
    .lte('start_at', end)
    .gte('end_at', start)
    .order('start_at')

  if (assignedTo.length > 0) {
    query = query.in('assigned_to', assignedTo)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  let allRows = data ?? []

  // Rattrapage paresseux : toute réservation qui chevauche la plage demandée et
  // n'a pas encore d'événement calendrier lié est synchronisée à la volée
  // (lib/calendar/syncRental.ts), pour que "dès qu'il y a une location, elle
  // doit apparaître dans le calendrier" reste vrai même pour les réservations
  // créées avant l'existence de cette synchro.
  const linkedReservationIds = new Set(allRows.map(r => r.reservation_id).filter(Boolean))
  const { data: reservationsInRange } = await supabase
    .from('reservations')
    .select('id')
    .lte('start_datetime', end)
    .gte('end_datetime', start)

  const toSync = (reservationsInRange ?? []).filter(r => !linkedReservationIds.has(r.id))

  if (toSync.length > 0) {
    await Promise.all(toSync.map(r => syncReservationToCalendar(r.id)))
    const { data: newRows } = await supabase
      .from('calendar_events')
      .select('*')
      .in('reservation_id', toSync.map(r => r.id))
    allRows = [...allRows, ...(newRows ?? [])]
  }

  return NextResponse.json(await enrichEvents(allRows))
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await request.json()
  const { title, event_type, status, start_at, end_at, all_day, reservation_id, vehicle_ids, client_id, assigned_to, assigned_team_id, color_override, notes } = body

  if (!title || !event_type || !start_at || !end_at) {
    return NextResponse.json({ error: 'title, event_type, start_at, end_at requis' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('calendar_events')
    .insert({
      title, event_type, status: status ?? 'a_faire', start_at, end_at,
      all_day: all_day ?? false,
      reservation_id: reservation_id ?? null,
      vehicle_ids: vehicle_ids ?? null,
      client_id: client_id ?? null,
      assigned_to: assigned_to ?? null,
      assigned_team_id: assigned_team_id ?? null,
      color_override: color_override ?? null,
      notes: notes ?? null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Sens calendrier → déplacements internes : un événement "Déplacement
  // interne" créé directement ici (pas via la page Déplacements) crée le trip
  // correspondant. km_start estimé depuis le kilométrage actuel du véhicule —
  // l'utilisateur corrige au besoin en clôturant le trajet. Silencieux si
  // véhicule/assigné manquent (event_type encore non finalisé dans le drawer).
  if (event_type === 'deplacement_interne' && assigned_to && Array.isArray(vehicle_ids) && vehicle_ids.length === 1) {
    const { data: vehicle } = await supabase.from('vehicles').select('current_km').eq('id', vehicle_ids[0]).single()
    const { data: newTrip } = await supabase.from('internal_trips').insert({
      vehicle_id: vehicle_ids[0],
      user_id: assigned_to,
      start_datetime: start_at,
      end_datetime: status === 'termine' ? end_at : null,
      purpose: 'autre',
      purpose_notes: notes ?? title,
      km_start: vehicle?.current_km ?? 0,
      calendar_event_id: data.id,
    }).select('id').single()

    if (newTrip) {
      await supabase.from('calendar_events').update({ source_key: `trip-${newTrip.id}` }).eq('id', data.id)
      data.source_key = `trip-${newTrip.id}`
    }
  }

  await generateAlertsForEvent(data)

  const [enriched] = await enrichEvents([data])
  return NextResponse.json(enriched)
}
