import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { addHours, isBefore, isAfter } from 'date-fns'

// GET: generate operational notifications (call via cron or polling)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const now = new Date()
    const created: string[] = []

    // Departures within 1h (confirmed reservations)
    const { data: upcomingDepartures } = await supabase
      .from('reservations')
      .select('id, reservation_number, start_datetime, vehicle:vehicles(plate)')
      .eq('status', 'confirmee')
      .gte('start_datetime', now.toISOString())
      .lte('start_datetime', addHours(now, 1).toISOString())

    for (const r of upcomingDepartures ?? []) {
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('type', 'departure_soon')
        .eq('entity_id', r.id)
        .eq('user_id', user.id)
        .limit(1)

      if (!existing || existing.length === 0) {
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'departure_soon',
          title: 'Départ imminent',
          body: `${r.reservation_number} — ${(r.vehicle as any)?.plate} part dans moins d'une heure`,
          entity_type: 'reservations',
          entity_id: r.id,
        })
        created.push(r.id)
      }
    }

    // Late returns (en_cours past end time)
    const { data: lateReturns } = await supabase
      .from('reservations')
      .select('id, reservation_number, end_datetime, vehicle:vehicles(plate)')
      .eq('status', 'en_cours')
      .lt('end_datetime', now.toISOString())

    for (const r of lateReturns ?? []) {
      // Mark as en_retard
      await supabase.from('reservations').update({ status: 'en_retard' }).eq('id', r.id)

      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('type', 'return_late')
        .eq('entity_id', r.id)
        .eq('user_id', user.id)
        .limit(1)

      if (!existing || existing.length === 0) {
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'return_late',
          title: 'Retour en retard',
          body: `${r.reservation_number} — ${(r.vehicle as any)?.plate} aurait dû être rendu`,
          entity_type: 'reservations',
          entity_id: r.id,
        })
        created.push(r.id)
      }
    }

    return NextResponse.json({ created: created.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
