import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { broadcastPushToManagers } from '@/lib/push/broadcastPush'
import { businessNow } from '@/lib/calendar/dateUtils'

/**
 * Résumé HEBDOMADAIRE des échéances, le lundi matin.
 *
 * Avant : un rappel par échéance à J-7, J-5, J-3, J-1, le jour J, puis tous les
 * deux jours jusqu'à J+19. Sur les 66 échéances en base (dont 64 loyers de
 * véhicules), ça produisait des dizaines de messages par semaine. Jeff, le
 * 28/07/2026 : « ça fait beaucoup, une relance globale des échéances chaque
 * début de semaine, c'est le meilleur format. »
 *
 * Un seul message donc, qui dit ce qui est en retard, ce qui tombe cette
 * semaine, et ouvre l'écran des échéances. Les créances client y figurent à
 * part : ce n'est pas de l'argent qu'on doit, c'est de l'argent qu'on attend.
 *
 * L'envoi passe désormais par `broadcastPushToManagers` avec un type : c'était
 * le seul envoi de l'application qui ignorait les réglages personnels et la
 * plage horaire de réception. Personne ne pouvait le couper.
 *
 * La tâche planifiée reste QUOTIDIENNE (vercel.json) et ne fait rien les autres
 * jours : une planification hebdomadaire qui échoue une fois attendrait sept
 * jours, alors qu'ici un rattrapage manuel suffit. L'anti-doublon garantit un
 * seul envoi par semaine.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  const querySecret = request.nextUrl.searchParams.get('secret')
  const validSecret = process.env.CRON_SECRET
  const authorized = auth === `Bearer ${validSecret}` || querySecret === validSecret
  if (!authorized) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Jour de la semaine à l'heure de l'agence : sur un serveur en temps universel,
  // le lundi 00h30 en France est encore dimanche en UTC.
  const maintenant = businessNow()
  const estLundi = maintenant.getDay() === 1
  const forcer = request.nextUrl.searchParams.get('force') === '1'
  if (!estLundi && !forcer) {
    return NextResponse.json({ sent: 0, reason: 'Résumé envoyé le lundi' })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = localDateStr(today)
  const finSemaine = localDateStr(addDays(today, 7))

  // Les échéances mises à la corbeille portent `deleted_at`. Le filtre se fait en
  // base, pas en mémoire : sur une colonne non sélectionnée, un filtre JavaScript
  // laisserait tout passer sans que rien ne le signale.
  const { data: dues } = await supabase
    .from('financial_due_dates')
    .select('id, amount, due_date, description, reservation_id, type')
    .eq('is_paid', false)
    .is('deleted_at', null)
    .lte('due_date', finSemaine)
    .order('due_date')

  if (!dues?.length) return NextResponse.json({ sent: 0, reason: 'Aucune échéance' })

  // Anti-doublon : une seule notification par semaine, même si la tâche est
  // relancée à la main plusieurs fois dans la journée.
  const debutSemaine = addDays(today, -6).toISOString()
  const { data: dejaEnvoye } = await supabase
    .from('notifications')
    .select('id')
    .eq('type', 'due_date_reminder')
    .gte('created_at', debutSemaine)
    .limit(1)
  if (dejaEnvoye?.length && !forcer) {
    return NextResponse.json({ sent: 0, reason: 'Résumé déjà envoyé cette semaine' })
  }

  const enRetard = dues.filter((d: any) => d.due_date < todayStr)
  const aVenir   = dues.filter((d: any) => d.due_date >= todayStr)
  const creances = dues.filter((d: any) => d.reservation_id)

  const somme = (liste: any[]) => liste.reduce((s, d) => s + Number(d.amount ?? 0), 0)

  const morceaux: string[] = []
  if (enRetard.length) {
    morceaux.push(`⚠️ ${enRetard.length} en retard · ${formatAmount(somme(enRetard))}`)
  }
  if (aVenir.length) {
    morceaux.push(`${aVenir.length} cette semaine · ${formatAmount(somme(aVenir))}`)
  }
  if (creances.length) {
    morceaux.push(`dont ${creances.length} créance${creances.length > 1 ? 's' : ''} client · ${formatAmount(somme(creances))}`)
  }

  const title = enRetard.length ? '📅 Échéances — dont des retards' : '📅 Échéances de la semaine'
  const body = morceaux.join(' · ')

  await supabase.from('notifications').insert({
    user_id: null,
    type: 'due_date_reminder',
    title,
    body,
    entity_type: 'financial_due_dates',
    entity_id: null,
  })

  await broadcastPushToManagers(
    { title, body, url: '/accounting/due-dates', icon: '/logo.png', badge: '/logo.png' },
    'due_date_alert',
  )

  return NextResponse.json({
    sent: 1,
    enRetard: enRetard.length,
    aVenir: aVenir.length,
    creances: creances.length,
  })
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
