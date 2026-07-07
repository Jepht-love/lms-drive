import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToSubscription } from '@/lib/push/sendPush'

// ─── Calendrier de rappel des échéances (facile à ajuster) ───────────────────
// AVANT l'échéance : on prévient à J-7, J-5, J-3, J-1.
const UPCOMING_DAYS = [7, 5, 3, 1]
// APRÈS l'échéance (si toujours impayée) : relance tous les 2 jours jusqu'à J+19.
const OVERDUE_DAYS = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
// Le jour J (offset 0) déclenche aussi un rappel « échéance aujourd'hui ».

// Cron — à appeler 1×/jour (le rappel du jour dépend de la date, pas de l'heure).
// Vérifie les échéances de loyers / paiements selon le calendrier ci-dessus.
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
  // Instant exact du début de journée locale (pour les comparaisons sur timestamp).
  const todayStartIso = today.toISOString()
  // La date du jour doit être lue sur les composantes LOCALES : `toISOString()`
  // repasse en UTC et, sur un serveur en avance sur UTC (Europe/Afrique), minuit
  // local tombe la veille en UTC → tout le calcul d'offset serait décalé d'un jour.
  const todayStr = localDateStr(today)

  // Fenêtre de scan : de J-19 (retard max relancé) à J+7 (anticipation max).
  const maxUpcoming = Math.max(...UPCOMING_DAYS)
  const maxOverdue = Math.max(...OVERDUE_DAYS)
  const dueMax = localDateStr(addDays(today, maxUpcoming))
  const dueMin = localDateStr(addDays(today, -maxOverdue))

  const { data: dues } = await supabase
    .from('financial_due_dates')
    .select('id, description, amount, due_date, category, vehicle_id, vehicles(brand, model, plate)')
    .eq('is_paid', false)
    .gte('due_date', dueMin)
    .lte('due_date', dueMax)
    .order('due_date')

  if (!dues?.length) return NextResponse.json({ sent: 0 })

  // Abonnés push (gérant + associé)
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

    // Décalage en jours : >0 à venir, 0 aujourd'hui, <0 en retard.
    const offset = Math.round(
      (Date.parse(dueDate + 'T00:00:00Z') - Date.parse(todayStr + 'T00:00:00Z')) / 86_400_000
    )

    // Aujourd'hui est-il un jour de rappel pour cette échéance ?
    let title: string
    if (offset === 0) {
      title = `🔴 Échéance aujourd'hui`
    } else if (offset > 0 && UPCOMING_DAYS.includes(offset)) {
      title = offset === 1 ? `🟡 Échéance demain` : `📅 Échéance dans ${offset} jours`
    } else if (offset < 0 && OVERDUE_DAYS.includes(-offset)) {
      title = `⚠️ Échéance en retard — ${-offset} j`
    } else {
      continue // pas un jour de rappel pour cette échéance
    }

    const body = `${due.description}${vehicleLabel ? ` · ${vehicleLabel}` : ''} — ${formatAmount(due.amount)}${offset < 0 ? ` (due le ${formatDate(dueDate)})` : ''}`

    // Dédup : une seule notif par échéance et par jour (le cron peut être appelé
    // plusieurs fois sans spammer).
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('type', 'due_date_reminder')
      .eq('entity_id', due.id)
      .gte('created_at', todayStartIso)
      .limit(1)

    if (existing?.length) continue

    // Notif in-app
    await supabase.from('notifications').insert({
      user_id: null,
      type: 'due_date_reminder',
      title,
      body,
      entity_type: 'financial_due_dates',
      entity_id: due.id,
    })

    // Push à tous les managers
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

// Formate une Date en 'YYYY-MM-DD' sur les composantes LOCALES (pas UTC), pour
// rester aligné avec la colonne `due_date` (type date, sans fuseau).
function localDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
