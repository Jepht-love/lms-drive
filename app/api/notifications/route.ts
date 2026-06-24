import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAllAlerts } from '@/lib/utils/alerts'
import { syncAlertsToCalendar } from '@/lib/calendar/syncAlerts'
import { addHours } from 'date-fns'

// GET: détecte départs imminents et retours en retard, bascule le statut des
// retours en `en_retard`. Appelé toutes les heures par un crontab local
// (pas d'hébergement Vercel) avec `Authorization: Bearer CRON_SECRET`.
// Plus de session utilisateur (un cron n'en a pas) → client admin + notifications
// en broadcast (user_id: null, visibles de tous).
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const now = new Date()
    const created: string[] = []

    // Departures within 1h (confirmed reservations)
    const { data: upcomingDepartures } = await supabase
      .from('reservations')
      .select('id, reservation_number, start_datetime, vehicle:vehicles(plate, brand, model)')
      .eq('status', 'confirmee')
      .gte('start_datetime', now.toISOString())
      .lte('start_datetime', addHours(now, 1).toISOString())

    for (const r of upcomingDepartures ?? []) {
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('type', 'departure_soon')
        .eq('entity_id', r.id)
        .limit(1)

      if (!existing || existing.length === 0) {
        await supabase.from('notifications').insert({
          user_id: null,
          type: 'departure_soon',
          title: 'Départ imminent',
          body: `${r.reservation_number} — ${(r.vehicle as any)?.brand} ${(r.vehicle as any)?.model} (${(r.vehicle as any)?.plate}) part dans moins d'une heure`,
          entity_type: 'reservations',
          entity_id: r.id,
        })
        created.push(r.id)
      }
    }

    // Late returns (en_cours past end time) → bascule en_retard + notif
    const { data: lateReturns } = await supabase
      .from('reservations')
      .select('id, reservation_number, end_datetime, vehicle:vehicles(plate, brand, model)')
      .eq('status', 'en_cours')
      .lt('end_datetime', now.toISOString())

    for (const r of lateReturns ?? []) {
      await supabase.from('reservations').update({ status: 'en_retard' }).eq('id', r.id)

      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('type', 'return_late')
        .eq('entity_id', r.id)
        .limit(1)

      if (!existing || existing.length === 0) {
        await supabase.from('notifications').insert({
          user_id: null,
          type: 'return_late',
          title: 'Retour en retard',
          body: `${r.reservation_number} — ${(r.vehicle as any)?.brand} ${(r.vehicle as any)?.model} (${(r.vehicle as any)?.plate}) aurait dû être rendu`,
          entity_type: 'reservations',
          entity_id: r.id,
        })
        created.push(r.id)
      }
    }

    // Reflète les alertes urgentes/importantes (CT, assurance, lavage, infractions...)
    // sur le calendrier — même mécanisme de rattrapage que /alertes, en filet de
    // sécurité horaire pour les alertes qui n'ont pas de date d'échéance proche.
    const alerts = await fetchAllAlerts(supabase)
    await syncAlertsToCalendar(supabase, alerts)

    return NextResponse.json({ created: created.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
