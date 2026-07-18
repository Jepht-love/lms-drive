import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAllAlerts } from '@/lib/utils/alerts'
import { syncAlertsToCalendar } from '@/lib/calendar/syncAlerts'
import { broadcastPushToManagers } from '@/lib/push/broadcastPush'
import { ALERT_TYPE_TO_NOTIF } from '@/lib/push/notificationTypes'
import { RESEND_FROM, resendTo } from '@/lib/email/config'
import { addHours, subMinutes } from 'date-fns'

// POST: push immédiat depuis le client (ex : alerte clôture contrat après EDL retour)
export async function POST(request: NextRequest) {
  try {
    const { title, body } = await request.json() as { title: string; body: string }
    if (title) await broadcastPushToManagers({ title, body: body ?? '', url: '/reservations' }, 'contract_alert')
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET: détecte départs imminents et retours en retard, bascule le statut des
// retours en `en_retard`. Appelé toutes les heures par un crontab local
// (pas d'hébergement Vercel) avec `Authorization: Bearer CRON_SECRET`.
// Plus de session utilisateur (un cron n'en a pas) → client admin + notifications
// en broadcast (user_id: null, visibles de tous).
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  const querySecret = request.nextUrl.searchParams.get('secret')
  const validSecret = process.env.CRON_SECRET
  const authorized =
    auth === `Bearer ${validSecret}` ||
    querySecret === validSecret
  if (!authorized) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const now = new Date()
    const created: string[] = []

    // Departures within 1h (confirmed reservations)
    const { data: upcomingDepartures } = await supabase
      .from('reservations')
      .select('id, reservation_number, start_datetime, vehicle:vehicles(plate, brand, model, color), client:clients(first_name, last_name)')
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
        const vehLabel = veh ? `${veh.brand} ${veh.model}${veh.color ? ' ' + veh.color : ''} (${veh.plate})` : ''
        const departFmt = new Date(r.start_datetime).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        const body = `${clientLabel}${vehLabel ? ' — ' + vehLabel : ''} · départ le ${departFmt}`
        await supabase.from('notifications').insert({
          user_id: null, type: 'departure_soon',
          title: 'Départ imminent', body,
          entity_type: 'reservations', entity_id: r.id,
        })
        await broadcastPushToManagers({ title: 'Départ imminent', body, url: '/reservations' }, 'departure_alert')
        created.push(r.id)
      }
    }

    // Retours du jour : toutes les réservations en_cours revenant aujourd'hui
    // Notif envoyée une fois par heure (rappel toutes les heures + digest 8h)
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
    const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()

    const { data: returnsToday } = await supabase
      .from('reservations')
      .select('id, reservation_number, end_datetime, vehicle:vehicles(plate, brand, model, color), client:clients(first_name, last_name)')
      .eq('status', 'en_cours')
      .gte('end_datetime', todayStart.toISOString())
      .lte('end_datetime', todayEnd.toISOString())

    for (const r of returnsToday ?? []) {
      // Déduplication : ne pas renvoyer si une notif identique existe dans la dernière heure
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('type', 'return_today_soon')
        .eq('entity_id', r.id)
        .gte('created_at', oneHourAgo)
        .limit(1)

      if (!existing || existing.length === 0) {
        const clt = r.client as any
        const veh = r.vehicle as any
        const clientLabel = clt ? `${clt.first_name} ${clt.last_name}` : r.reservation_number
        const vehLabel = veh ? `${veh.brand} ${veh.model} (${veh.plate})` : ''
        const heureFmt = new Date(r.end_datetime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        const body = `${clientLabel}${vehLabel ? ' — ' + vehLabel : ''} · retour prévu à ${heureFmt}`
        await supabase.from('notifications').insert({
          user_id: null, type: 'return_today_soon',
          title: 'Retour du jour', body,
          entity_type: 'reservations', entity_id: r.id,
        })
        await broadcastPushToManagers({ title: 'Retour du jour', body, url: '/reservations' }, 'return_alert')
        created.push(r.id)
      }
    }

    // 1. Bascule en_retard les réservations en_cours dépassées
    const { data: newlyLate } = await supabase
      .from('reservations')
      .select('id')
      .eq('status', 'en_cours')
      .lt('end_datetime', now.toISOString())
    for (const r of newlyLate ?? []) {
      await supabase.from('reservations').update({ status: 'en_retard' }).eq('id', r.id)
    }

    // 2. Notif répétée toutes les 30 min pour TOUTES les réservations en_retard
    const repeatThreshold = new Date(now.getTime() - 30 * 60 * 1000).toISOString()
    const { data: lateReturns } = await supabase
      .from('reservations')
      .select('id, reservation_number, end_datetime, vehicle:vehicles(plate, brand, model, color), client:clients(first_name, last_name, email)')
      .eq('status', 'en_retard')

    for (const r of lateReturns ?? []) {
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('type', 'return_late')
        .eq('entity_id', r.id)
        .gte('created_at', repeatThreshold)
        .limit(1)

      if (!existing || existing.length === 0) {
        const clt = r.client as any
        const veh = r.vehicle as any
        const clientLabel = clt ? `${clt.first_name} ${clt.last_name}` : r.reservation_number
        const vehLabel = veh ? `${veh.brand} ${veh.model}${veh.color ? ' ' + veh.color : ''} (${veh.plate})` : ''
        const retourFmt = new Date(r.end_datetime).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        const body = `${clientLabel}${vehLabel ? ' — ' + vehLabel : ''} · prévu le ${retourFmt}`
        await supabase.from('notifications').insert({
          user_id: null, type: 'return_late',
          title: 'Retour en retard', body,
          entity_type: 'reservations', entity_id: r.id,
        })
        await broadcastPushToManagers({ title: 'Retour en retard', body, url: '/reservations' }, 'late_return_alert')
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

    // ── Relance automatique par email au client en retard ────────────────────
    // Déclenchée au passage du cron (dans la fenêtre 7h-22h ci-dessus). Une seule
    // relance par réservation : marqueur `client_late_email` = anti-doublon.
    for (const r of lateReturns ?? []) {
      const clt = r.client as any
      if (!clt?.email) continue

      const { data: alreadyEmailed } = await supabase
        .from('notifications')
        .select('id')
        .eq('type', 'client_late_email')
        .eq('entity_id', r.id)
        .limit(1)
      if (alreadyEmailed && alreadyEmailed.length > 0) continue

      const veh = r.vehicle as any
      const clientLabel = `${clt.first_name ?? ''} ${clt.last_name ?? ''}`.trim()
      const vehLabel = veh ? `${veh.brand} ${veh.model} (${veh.plate})` : ''
      const retourFmt = new Date(r.end_datetime).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

      try {
        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: RESEND_FROM,
          to: resendTo(clt.email),
          subject: `Restitution de véhicule en retard — ${vehLabel || r.reservation_number}`,
          // Contenu provisoire (à finaliser avec le gérant).
          html: `
            <p>Bonjour ${clt.first_name ?? ''},</p>
            <p>Le véhicule <b>${vehLabel || r.reservation_number}</b> devait être restitué le <b>${retourFmt}</b> et ne nous a pas encore été rendu.</p>
            <p>Merci de nous recontacter au plus vite afin d'organiser sa restitution.</p>
            <p>Cordialement,<br>LMS Drive</p>
          `,
        })
      } catch {
        // Un échec d'envoi (email invalide, quota…) ne doit pas bloquer le cron —
        // pas de marqueur posé → nouvelle tentative au prochain passage.
        continue
      }

      // Marqueur anti-doublon + visibilité côté gérant.
      await supabase.from('notifications').insert({
        user_id: null, type: 'client_late_email',
        title: 'Relance retard envoyée au client',
        body: `${clientLabel}${vehLabel ? ' — ' + vehLabel : ''} · email de relance envoyé`,
        entity_type: 'reservations', entity_id: r.id,
      })
      created.push(r.id)
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
        .gte('created_at', repeatThreshold)
        .limit(1)

      if (!existing || existing.length === 0) {
        const body = `"${ev.title}" aurait dû être terminé`
        await supabase.from('notifications').insert({
          user_id: null, type: 'event_return_late',
          title: 'Retour en retard', body,
          entity_type: 'calendar_events', entity_id: ev.id,
        })
        await broadcastPushToManagers({ title: 'Retour en retard', body, url: '/calendrier' }, 'task_late_alert')
        created.push(ev.id)
      }
    }

    // Reflète les alertes urgentes/importantes (CT, assurance, lavage, infractions...)
    // sur le calendrier — même mécanisme de rattrapage que /alertes, en filet de
    // sécurité horaire pour les alertes qui n'ont pas de date d'échéance proche.
    const alerts = await fetchAllAlerts(supabase)

    // Push mobile des alertes flotte / incidents (CT, assurance, révision, lavage,
    // sinistre, infraction, document, contrat, récupération en retard). Jusqu'ici
    // seulement affichées dans l'app. Une notification par jour et par entité
    // (anti-doublon via `notifications`), filtrée par les réglages de chaque
    // manager dans broadcastPushToManagers. Les types déjà poussés plus haut
    // (retour en retard, tâche en retard) ne sont pas dans ALERT_TYPE_TO_NOTIF.
    for (const a of alerts) {
      const notifType = ALERT_TYPE_TO_NOTIF[a.type]
      if (!notifType) continue
      const entityId = a.vehicleId ?? a.reservationId
      if (!entityId) continue
      const dedupType = `push_${a.type}`
      const { data: alreadyPushed } = await supabase
        .from('notifications')
        .select('id')
        .eq('type', dedupType)
        .eq('entity_id', entityId)
        .gte('created_at', todayStart.toISOString())
        .limit(1)
      if (alreadyPushed && alreadyPushed.length > 0) continue
      await supabase.from('notifications').insert({
        user_id: null, type: dedupType,
        title: a.label, body: a.sublabel,
        entity_type: a.vehicleId ? 'vehicles' : 'reservations',
        entity_id: entityId,
      })
      await broadcastPushToManagers({ title: a.label, body: a.sublabel, url: a.href }, notifType)
      created.push(entityId)
    }

    await syncAlertsToCalendar(supabase, alerts)

    return NextResponse.json({ created: created.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
