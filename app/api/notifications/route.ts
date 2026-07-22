import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAllAlerts } from '@/lib/utils/alerts'
import { syncAlertsToCalendar } from '@/lib/calendar/syncAlerts'
import { broadcastPushToManagers } from '@/lib/push/broadcastPush'
import { ALERT_TYPE_TO_NOTIF } from '@/lib/push/notificationTypes'
import { RESEND_FROM, resendTo } from '@/lib/email/config'
import { businessNow } from '@/lib/calendar/dateUtils'
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

    // Préavis des rappels « à préparer » (départs + tâches/RDV). Demande gérant :
    // être prévenu ~2 h AVANT une tâche du jour (départ à préparer, EDL, RDV…),
    // pour distinguer les véhicules qui vont PARTIR des locations déjà sorties.
    // Une seule constante → délai ajustable. Le cron tournant à l'heure, chaque
    // échéance reçoit une notification unique (dédup permanente) dès qu'elle
    // entre dans la fenêtre des 2 h.
    const REMINDER_LEAD_HOURS = 2

    // Départs à préparer : DEUX rappels par réservation confirmée — un ~2 h avant
    // puis un ~1 h avant. Paliers distincts avec chacun son marqueur de dédup :
    // au-delà de 60 min restants → palier « 2 h » ; en deçà → palier « 1 h ». Une
    // résa créée à moins d'1 h du départ ne reçoit que le rappel « dans 1 h ».
    const { data: upcomingDepartures } = await supabase
      .from('reservations')
      .select('id, reservation_number, start_datetime, vehicle:vehicles(plate, brand, model, color), client:clients(first_name, last_name)')
      .eq('status', 'confirmee')
      .gte('start_datetime', now.toISOString())
      .lte('start_datetime', addHours(now, REMINDER_LEAD_HOURS).toISOString())

    for (const r of upcomingDepartures ?? []) {
      const minutesUntil = (new Date(r.start_datetime).getTime() - now.getTime()) / 60000
      const stage = minutesUntil > 60
        ? { type: 'departure_soon',    lead: '2 h' }
        : { type: 'departure_soon_1h', lead: '1 h' }

      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('type', stage.type)
        .eq('entity_id', r.id)
        .limit(1)
      if (existing && existing.length) continue

      const clt = r.client as any
      const veh = r.vehicle as any
      const clientLabel = clt ? `${clt.first_name} ${clt.last_name}` : r.reservation_number
      const vehLabel = veh ? `${veh.brand} ${veh.model}${veh.color ? ' ' + veh.color : ''} (${veh.plate})` : ''
      const departFmt = new Date(r.start_datetime).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      const title = `Départ dans ${stage.lead}`
      const body = `${clientLabel}${vehLabel ? ' — ' + vehLabel : ''} · départ le ${departFmt}`
      await supabase.from('notifications').insert({
        user_id: null, type: stage.type,
        title, body,
        entity_type: 'reservations', entity_id: r.id,
      })
      await broadcastPushToManagers({ title, body, url: '/reservations' }, 'departure_alert')
      created.push(r.id)
    }

    // ── Tâches imminentes : rappel ~2h avant une tâche / RDV programmé ─────────
    // Actif grâce au passage horaire du cron. Une seule fois par tâche (dédup
    // permanent sur le type `task_soon`). Couvre la table `tasks` (lavage,
    // préparation, RDV…) et les événements calendrier de type tâche/RDV/livraison.
    const inLead = addHours(now, REMINDER_LEAD_HOURS).toISOString()

    const { data: soonTasks } = await supabase
      .from('tasks')
      .select('id, title, due_datetime, vehicle:vehicles(plate, brand, model)')
      .not('status', 'in', '("termine","annule")')
      .gte('due_datetime', now.toISOString())
      .lte('due_datetime', inLead)
    for (const t of soonTasks ?? []) {
      const minutesUntil = (new Date(t.due_datetime).getTime() - now.getTime()) / 60000
      const stage = minutesUntil > 60 ? { type: 'task_soon', lead: '2 h' } : { type: 'task_soon_1h', lead: '1 h' }
      const { data: exists } = await supabase.from('notifications')
        .select('id').eq('type', stage.type).eq('entity_id', t.id).limit(1)
      if (exists && exists.length) continue
      const veh = t.vehicle as any
      const heure = new Date(t.due_datetime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      const title = `Tâche dans ${stage.lead}`
      const body = `${t.title}${veh?.plate ? ` — ${veh.brand} ${veh.model} (${veh.plate})` : ''} · prévu à ${heure}`
      await supabase.from('notifications').insert({
        user_id: null, type: stage.type, title, body,
        entity_type: 'tasks', entity_id: t.id,
      })
      await broadcastPushToManagers({ title, body, url: '/calendar/tasks' }, 'new_task_alert')
      created.push(t.id)
    }

    const { data: soonEvents } = await supabase
      .from('calendar_events')
      .select('id, title, start_at')
      .in('event_type', ['tache', 'rdv_client', 'rdv_garage', 'rdv_autre', 'livraison', 'recuperation'])
      .in('status', ['a_faire', 'en_cours'])
      .gte('start_at', now.toISOString())
      .lte('start_at', inLead)
    for (const ev of soonEvents ?? []) {
      const minutesUntil = (new Date(ev.start_at).getTime() - now.getTime()) / 60000
      const stage = minutesUntil > 60 ? { type: 'task_soon', lead: '2 h' } : { type: 'task_soon_1h', lead: '1 h' }
      const { data: exists } = await supabase.from('notifications')
        .select('id').eq('type', stage.type).eq('entity_id', ev.id).limit(1)
      if (exists && exists.length) continue
      const heure = new Date(ev.start_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      const title = `Rappel dans ${stage.lead}`
      const body = `${ev.title} · prévu à ${heure}`
      await supabase.from('notifications').insert({
        user_id: null, type: stage.type, title, body,
        entity_type: 'calendar_events', entity_id: ev.id,
      })
      await broadcastPushToManagers({ title, body, url: '/calendrier' }, 'new_task_alert')
      created.push(ev.id)
    }

    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
    const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999)

    // Retour à préparer : UN seul rappel ~1 h avant l'heure de restitution prévue.
    // Plus de rappel horaire toute la journée — le récap de 7 h liste déjà les
    // retours du jour ; ce rappel « 1 h avant » complète juste à l'approche.
    const { data: returnsSoon } = await supabase
      .from('reservations')
      .select('id, reservation_number, end_datetime, vehicle:vehicles(plate, brand, model, color), client:clients(first_name, last_name)')
      .eq('status', 'en_cours')
      .gte('end_datetime', now.toISOString())
      .lte('end_datetime', addHours(now, 1).toISOString())

    for (const r of returnsSoon ?? []) {
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('type', 'return_soon_1h')
        .eq('entity_id', r.id)
        .limit(1)
      if (existing && existing.length) continue

      const clt = r.client as any
      const veh = r.vehicle as any
      const clientLabel = clt ? `${clt.first_name} ${clt.last_name}` : r.reservation_number
      const vehLabel = veh ? `${veh.brand} ${veh.model} (${veh.plate})` : ''
      const heureFmt = new Date(r.end_datetime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      const title = 'Retour dans 1 h'
      const body = `${clientLabel}${vehLabel ? ' — ' + vehLabel : ''} · retour prévu à ${heureFmt}`
      await supabase.from('notifications').insert({
        user_id: null, type: 'return_soon_1h',
        title, body,
        entity_type: 'reservations', entity_id: r.id,
      })
      await broadcastPushToManagers({ title, body, url: '/reservations' }, 'return_alert')
      created.push(r.id)
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

    // Seuil de retard : config du gérant (défaut 30 min).
    const { data: notifCfg } = await supabase
      .from('notification_settings')
      .select('late_return_threshold_minutes')
      .limit(1)
      .maybeSingle()
    const thresholdMin = notifCfg?.late_return_threshold_minutes ?? 30

    // Garde-fou anti-nuit GLOBAL : aucun envoi hors 7h-22h (heure de Paris).
    // On NE lit plus une fenêtre "globale" en base : `.limit(1)` tombait sur le
    // réglage d'un utilisateur au hasard, dont la plage pouvait exclure l'heure
    // courante et bloquer TOUT le cron (« outside alert window »). La fenêtre
    // PERSONNELLE de chaque manager est appliquée en aval, par destinataire,
    // dans broadcastPushToManagers.
    const currentHour = businessNow().getHours()
    if (currentHour < 7 || currentHour >= 22) {
      return NextResponse.json({ skipped: 'outside alert window' })
    }

    // ── Digest du matin ───────────────────────────────────────────────────────
    // Un récap du jour, une seule fois par jour, au premier passage du cron dans
    // la fenêtre horaire (≈ 8h). Départs, retours et tâches du jour. Anti-doublon
    // via une notification `daily_digest` posée pour la journée.
    const { data: digestSent } = await supabase
      .from('notifications')
      .select('id')
      .eq('type', 'daily_digest')
      .gte('created_at', todayStart.toISOString())
      .limit(1)
    if (!digestSent || digestSent.length === 0) {
      // Programme du jour DÉTAILLÉ, listé par type (départs / retours / tâches),
      // chaque ligne avec l'heure prévue, trié chronologiquement dans sa section.
      const [depRows, retRows, taskRows, eventRows] = await Promise.all([
        supabase.from('reservations')
          .select('start_datetime, vehicle:vehicles(brand, model), client:clients(first_name, last_name)')
          .eq('status', 'confirmee')
          .gte('start_datetime', todayStart.toISOString()).lte('start_datetime', todayEnd.toISOString())
          .order('start_datetime'),
        supabase.from('reservations')
          .select('end_datetime, vehicle:vehicles(brand, model), client:clients(first_name, last_name)')
          .in('status', ['en_cours', 'en_retard'])
          .gte('end_datetime', todayStart.toISOString()).lte('end_datetime', todayEnd.toISOString())
          .order('end_datetime'),
        supabase.from('tasks')
          .select('title, due_datetime, vehicle:vehicles(brand, model, plate)')
          .not('status', 'in', '("termine","annule")')
          .gte('due_datetime', todayStart.toISOString()).lte('due_datetime', todayEnd.toISOString())
          .order('due_datetime'),
        supabase.from('calendar_events')
          .select('title, start_at')
          .in('event_type', ['tache', 'rdv_client', 'rdv_garage', 'rdv_autre', 'livraison', 'recuperation'])
          .in('status', ['a_faire', 'en_cours'])
          .gte('start_at', todayStart.toISOString()).lte('start_at', todayEnd.toISOString())
          .order('start_at'),
      ])

      const fmtH = (x: string) => new Date(x).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v)
      const vehCli = (vRaw: any, cRaw: any) => {
        const v = one<{ brand: string; model: string }>(vRaw)
        const c = one<{ first_name: string; last_name: string }>(cRaw)
        return `${v ? `${v.brand} ${v.model}` : 'Véhicule'}${c ? ` (${c.last_name})` : ''}`
      }

      const depLines = (depRows.data ?? []).map((r: any) => `· ${fmtH(r.start_datetime)} — ${vehCli(r.vehicle, r.client)}`)
      const retLines = (retRows.data ?? []).map((r: any) => `· ${fmtH(r.end_datetime)} — ${vehCli(r.vehicle, r.client)}`)
      const taskLines = [
        ...(taskRows.data ?? []).map((t: any) => {
          const v = one<{ brand: string; model: string; plate: string }>(t.vehicle)
          return { t: new Date(t.due_datetime).getTime(), line: `· ${fmtH(t.due_datetime)} — ${t.title}${v?.plate ? ` (${v.plate})` : ''}` }
        }),
        ...(eventRows.data ?? []).map((ev: any) => ({ t: new Date(ev.start_at).getTime(), line: `· ${fmtH(ev.start_at)} — ${ev.title}` })),
      ].sort((a, b) => a.t - b.t).map(x => x.line)

      const sections: string[] = []
      if (depLines.length)  sections.push(`DÉPARTS\n${depLines.join('\n')}`)
      if (retLines.length)  sections.push(`RETOURS\n${retLines.join('\n')}`)
      if (taskLines.length) sections.push(`TÂCHES\n${taskLines.join('\n')}`)
      const digestBody = sections.length ? sections.join('\n\n') : 'Rien de programmé aujourd\'hui'

      await supabase.from('notifications').insert({
        user_id: null, type: 'daily_digest',
        title: 'Programme du jour', body: digestBody,
      })
      await broadcastPushToManagers({ title: 'Programme du jour', body: digestBody, url: '/' })
      created.push('digest')
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

    // Tâches / RDV calendrier en retard : UNE seule alerte par événement (dédup
    // permanente — fini la répétition toutes les 30 min qui noyait l'écran). Cap
    // d'âge : on n'alerte que les événements devenus en retard dans les dernières
    // 24 h, pour que les vieux événements jamais clôturés ne repartent pas en masse.
    // Titre corrigé : « Tâche / RDV en retard » (et non « Retour en retard »).
    const lateEventFrom = addHours(now, -24).toISOString()
    const lateEventTo   = subMinutes(now, thresholdMin).toISOString()
    const { data: lateEvents } = await supabase
      .from('calendar_events')
      .select('id, title')
      .gte('end_at', lateEventFrom)
      .lt('end_at', lateEventTo)
      .not('status', 'in', '("termine","annule")')

    for (const ev of lateEvents ?? []) {
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('type', 'event_return_late')
        .eq('entity_id', ev.id)
        .limit(1)
      if (existing && existing.length) continue

      const body = `« ${ev.title} » aurait dû être terminé`
      await supabase.from('notifications').insert({
        user_id: null, type: 'event_return_late',
        title: 'Tâche / RDV en retard', body,
        entity_type: 'calendar_events', entity_id: ev.id,
      })
      await broadcastPushToManagers({ title: 'Tâche / RDV en retard', body, url: '/calendrier' }, 'task_late_alert')
      created.push(ev.id)
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
