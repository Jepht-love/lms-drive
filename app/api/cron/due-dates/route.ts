import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToSubscription } from '@/lib/push/sendPush'

// Cron Vercel — exécuté chaque matin à 08h00 UTC
// Vérifie les échéances de loyers / paiements à J-7, J-1, J0 et retard
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  const querySecret = request.nextUrl.searchParams.get('secret')
  const validSecret = process.env.CRON_SECRET
  const authorized = auth === `Bearer ${validSecret}` || querySecret === validSecret
  if (!authorized) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const todayStr  = today.toISOString().slice(0, 10)
  const d1 = addDays(today, 1).toISOString().slice(0, 10)  // J+1 (on prévient J-1 avant)
  const d7 = addDays(today, 7).toISOString().slice(0, 10)  // J+7

  // Échéances impayées : en retard, aujourd'hui, dans 1 jour, dans 7 jours
  const { data: dues } = await supabase
    .from('financial_due_dates')
    .select('id, description, amount, due_date, category, vehicle_id, vehicles(brand, model, plate)')
    .eq('is_paid', false)
    .lte('due_date', d7)
    .order('due_date')

  if (!dues?.length) return NextResponse.json({ sent: 0 })

  // Récupérer tous les abonnés push (gérant + associé)
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, user_id, profiles(role)')

  const managerSubs = (subs ?? []).filter(s => {
    const role = (s.profiles as any)?.role
    return role === 'gerant' || role === 'associe'
  })

  if (!managerSubs.length) return NextResponse.json({ sent: 0, reason: 'No manager subscriptions' })

  let sent = 0
  const expiredEndpoints: string[] = []

  for (const due of dues) {
    const dueDate = due.due_date as string
    const vehicle = due.vehicles as any
    const vehicleLabel = vehicle ? `${vehicle.brand} ${vehicle.model} (${vehicle.plate})` : null

    let urgency: 'overdue' | 'today' | 'tomorrow' | 'week'
    let title: string
    let body: string

    if (dueDate < todayStr) {
      urgency = 'overdue'
      const daysLate = Math.round((today.getTime() - new Date(dueDate).getTime()) / 86400000)
      title = `⚠️ Échéance en retard — ${daysLate}j`
      body = `${due.description}${vehicleLabel ? ` · ${vehicleLabel}` : ''} — ${formatAmount(due.amount)} (dû le ${formatDate(dueDate)})`
    } else if (dueDate === todayStr) {
      urgency = 'today'
      title = `🔴 Échéance aujourd'hui`
      body = `${due.description}${vehicleLabel ? ` · ${vehicleLabel}` : ''} — ${formatAmount(due.amount)}`
    } else if (dueDate === d1) {
      urgency = 'tomorrow'
      title = `🟡 Échéance demain`
      body = `${due.description}${vehicleLabel ? ` · ${vehicleLabel}` : ''} — ${formatAmount(due.amount)}`
    } else {
      urgency = 'week'
      title = `📅 Échéance dans 7 jours`
      body = `${due.description}${vehicleLabel ? ` · ${vehicleLabel}` : ''} — ${formatAmount(due.amount)}`
    }

    // Éviter les doublons : vérifier si une notif identique a déjà été envoyée aujourd'hui
    const notifKey = `due_date_${due.id}_${urgency}`
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('type', 'due_date_reminder')
      .eq('entity_id', due.id)
      .gte('created_at', todayStr + 'T00:00:00Z')
      .ilike('body', `%${urgency}%`)
      .limit(1)

    if (existing?.length) continue

    // Créer une notif in-app
    await supabase.from('notifications').insert({
      user_id: null,
      type: 'due_date_reminder',
      title,
      body: body + ` [${urgency}]`,
      entity_type: 'financial_due_dates',
      entity_id: due.id,
    })

    // Envoyer push à tous les managers
    for (const sub of managerSubs) {
      const result = await sendPushToSubscription(
        { id: sub.id, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        { title, body, url: '/accounting/due-dates', icon: '/logo.png', badge: '/logo.png' }
      )
      if (result.ok) {
        sent++
      } else if (result.expired) {
        expiredEndpoints.push(sub.endpoint)
      }
    }
  }

  // Nettoyer les abonnements expirés
  if (expiredEndpoints.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints)
  }

  return NextResponse.json({ sent, expired: expiredEndpoints.length })
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
