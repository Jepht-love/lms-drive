import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAllAlerts } from '@/lib/utils/alerts'
import { syncAlertsToCalendar } from '@/lib/calendar/syncAlerts'
import { broadcastPushToManagers } from '@/lib/push/broadcastPush'
import { addHours, subMinutes } from 'date-fns'

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
      .select('id, reservation_number, start_datetime, vehicle:vehicles(plate, brand, model), client:clients(first_name, last_name)')
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
        const clt = r.client as any
        const veh = r.vehicle as any
        const clientLabel = clt ? `${clt.first_name} ${clt.last_name}` : r.reservation_number
        const body = `${clientLabel} — ${veh?.brand} ${veh?.model} (${veh?.plate}) part dans moins d'une heure`
        await supabase.from('notifications').insert({
          user_id: null, type: 'departure_soon',
          title: 'Départ imminent', body,
          entity_type: 'reservations', entity_id: r.id,
        })
        await broadcastPushToManagers({ title: 'Départ imminent', body, url: '/reservations' })
        created.push(r.id)
      }
    }

    // Late returns (en_cours past end time) → bascule en_retard + notif
    const { data: lateReturns } = await supabase
      .from('reservations')
      .select('id, reservation_number, end_datetime, vehicle:vehicles(plate, brand, model), client:clients(first_name, last_name)')
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
        const clt = r.client as any
        const veh = r.vehicle as any
        const clientLabel = clt ? `${clt.first_name} ${clt.last_name}` : r.reservation_number
        const body = `${clientLabel} — ${veh?.brand} ${veh?.model} (${veh?.plate}) aurait dû être rendu`
        await supabase.from('notifications').insert({
          user_id: null, type: 'return_late',
          title: 'Retour en retard', body,
          entity_type: 'reservations', entity_id: r.id,
        })
        await broadcastPushToManagers({ title: 'Retour en retard', body, url: '/reservations' })
        created.push(r.id)
      }
    }

    // Seuil de retard : lit la config du gérant (défaut 30 min)
    const { data: notifCfg } = await supabase
      .from('notification_settings')
      .select('late_return_threshold_minutes, alert_window_start, alert_window_end')
      .limit(1)
      .maybeSingle()
    const thresholdMin = notifCfg?.late_return_threshold_minutes ?? 30
    const windowStart  = notifCfg?.alert_window_start ?? 7
    const windowEnd    = notifCfg?.alert_window_end   ?? 22
    const currentHour  = now.getHours()
    if (currentHour < windowStart || currentHour >= windowEnd) {
      return NextResponse.json({ skipped: 'outside alert window' })
    }

    // Retours en retard sur les tâches calendrier (calendar_events)
    const thirtyMinAgo = subMinutes(now, thresholdMin).toISOString()
    const { data: lateEvents } = await supabase
      .from('calendar_events')
      .select('id, title')
      .lt('end_at', thirtyMinAgo)
      .not('status', 'in', '("termine","annule")')

    for (const ev of lateEvents ?? []) {
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('type', 'event_return_late')
        .eq('entity_id', ev.id)
        .limit(1)

      if (!existing || existing.length === 0) {
        const body = `"${ev.title}" aurait dû être terminé il y a plus de 30 minutes`
        await supabase.from('notifications').insert({
          user_id: null, type: 'event_return_late',
          title: 'Retour en retard', body,
          entity_type: 'calendar_events', entity_id: ev.id,
        })
        await broadcastPushToManagers({ title: 'Retour en retard', body, url: '/calendar' })
        created.push(ev.id)
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
