import { NextRequest, NextResponse } from 'next/server'
import { sendPushToUser } from '@/lib/push/sendPushToUser'
import { broadcastPushToManagers } from '@/lib/push/broadcastPush'
import { jourHeureAgence } from '@/lib/format/heureAgence'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateAlertsForEvent } from '@/lib/calendar/generateAlerts'
import { enrichEvents } from '@/lib/calendar/enrichEvents'
import { isManagerRole } from '@/lib/auth/roles'
import { logAudit } from '@/lib/audit/log'

const ALLOWED_FIELDS = [
  'title', 'description', 'event_type', 'status', 'start_at', 'end_at', 'all_day',
  'reservation_id', 'vehicle_ids', 'client_id', 'assigned_to', 'assigned_team_id', 'color_override', 'notes',
]

/**
 * Garde applicatif « tâches » : la suppression, le déplacement (horaire) et la
 * modification structurelle d'une tâche sont réservés au gérant / associé. Un
 * employé peut UNIQUEMENT faire avancer le statut de sa tâche (À faire → En
 * cours → Terminé) : il rend compte de son travail sans pouvoir l'altérer. Toute
 * autre tentative est refusée ET tracée dans le journal d'audit (consulté par le
 * gérant dans Réglages). Nécessaire en plus de la RLS : la policy UPDATE de
 * calendar_events laisse l'assigné modifier son propre événement.
 */
async function isManager(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<boolean> {
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  return isManagerRole(profile?.role)
}

async function logDeniedTaskChange(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  eventId: string,
  attempt: 'modification' | 'déplacement' | 'suppression',
): Promise<NextResponse> {
  const { data: ev } = await supabase
    .from('calendar_events').select('title').eq('id', eventId).maybeSingle()
  const action =
    attempt === 'suppression' ? 'calendar_event_delete_denied'
    : attempt === 'déplacement' ? 'calendar_event_move_denied'
    : 'calendar_event_update_denied'
  await logAudit(supabase, {
    userId,
    action,
    entityType: 'calendar_events',
    entityId: eventId,
    summary: `Tentative de ${attempt} d'une tâche refusée (employé) — « ${ev?.title ?? 'tâche'} »`,
  })
  return NextResponse.json(
    { error: "Cette action n'est pas autorisée : seul le gérant ou un associé peut modifier, déplacer ou supprimer une tâche." },
    { status: 403 },
  )
}

// Deux valeurs de champ sont-elles équivalentes ? Le drawer renvoie TOUT le
// payload à chaque enregistrement (dates, tableaux, null pour les champs vides) :
// on normalise pour ne repérer que les changements réels et distinguer un simple
// passage de statut d'une vraie modification / d'un déplacement.
function sameValue(key: string, a: unknown, b: unknown): boolean {
  if (key === 'start_at' || key === 'end_at') {
    const ta = a ? new Date(a as string).getTime() : NaN
    const tb = b ? new Date(b as string).getTime() : NaN
    return ta === tb
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    const na = Array.isArray(a) ? [...a].map(String).sort() : []
    const nb = Array.isArray(b) ? [...b].map(String).sort() : []
    return JSON.stringify(na) === JSON.stringify(nb)
  }
  return (a ?? '') === (b ?? '')
}

// Un événement seul (enrichi) — sert à ouvrir le tiroir depuis un lien externe
// (alerte, dashboard « À assigner ») sans dépendre de la plage chargée au calendrier.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: 'Événement introuvable' }, { status: 404 })

  const [enriched] = await enrichEvents([data])
  return NextResponse.json(enriched)
}

/**
 * Prévient la personne à qui on vient de confier une tâche.
 *
 * Assigner ne notifiait personne : l'associé ne l'apprenait qu'en ouvrant le
 * calendrier de lui-même (constaté par Jeff le 27/07/2026 sur trois appareils).
 * L'envoi est ciblé — lui seul le reçoit, pas toute l'équipe.
 *
 * N'envoie que si l'assignation CHANGE réellement, et jamais à soi-même :
 * prendre en charge une tâche libre ne doit pas déclencher sa propre alerte.
 */
async function notifierPersonneAssignee(
  supabase: Awaited<ReturnType<typeof createClient>>,
  event: { id: string; title: string | null; start_at: string | null; assigned_to: string | null },
  previousAssignee: string | null,
  actorId: string,
): Promise<void> {
  const assignee = event.assigned_to
  if (!assignee || assignee === previousAssignee || assignee === actorId) return

  const quand = event.start_at ? jourHeureAgence(event.start_at) : null
  const title = 'Nouvelle tâche pour vous'
  // Deux lignes au moins : ce qu'il y a à faire, puis quand (Jeff, 30/07/2026).
  const body = [event.title ?? 'Tâche', quand && `Prévu le ${quand}`].filter(Boolean).join('\n')

  // Trace dans la cloche de l'application, en plus du push : si le téléphone
  // n'a pas les notifications activées, la tâche reste visible quelque part.
  //
  // Connexion d'administration OBLIGATOIRE : la règle d'accès de `notifications`
  // n'autorise chacun qu'à écrire pour lui-même. Écrire au nom du destinataire
  // était donc refusé par la base, sans erreur remontée — aucune notification
  // personnelle n'a jamais été enregistrée. Constaté le 28/07/2026.
  await createAdminClient().from('notifications').insert({
    user_id: assignee,
    type: 'new_task_alert',
    title,
    body,
    entity_type: 'calendar_events',
    entity_id: event.id,
  })

  await sendPushToUser(assignee, { title, body, url: `/calendrier?event=${event.id}` }, 'new_task_alert')
}

/** Libellés d'avancement, dans la langue du calendrier. */
const AVANCEMENT: Record<string, string> = {
  en_cours: 'a commencé',
  termine:  'a terminé',
  reporte:  'a reporté',
  annule:   'a annulé',
}

/**
 * Referme la boucle demandée par Jeff (ticket SAV du 27/07/2026, 14h41) : celui
 * qui a confié la tâche doit apprendre ce qu'elle devient, sans avoir à ouvrir
 * le calendrier.
 *
 * Le message part à TOUTE l'équipe, salariés compris, et c'est voulu : chacun
 * voit qu'un collègue a déjà pris le travail au lieu que deux ou trois personnes
 * s'y mettent en même temps (décision du 28/07/2026). Celui qui a créé la tâche
 * reçoit en plus une trace dans sa cloche, puisque c'est lui qui attend la
 * réponse.
 *
 * Rien ne part si le statut ne change pas réellement : le tiroir renvoie tous
 * les champs à chaque enregistrement, y compris ceux qu'on n'a pas touchés.
 */
async function notifierAvancement(
  supabase: Awaited<ReturnType<typeof createClient>>,
  event: { id: string; title: string | null; status: string | null; created_by: string | null },
  previousStatus: string | null,
  actorId: string,
  actorName: string | null,
): Promise<void> {
  const verbe = AVANCEMENT[event.status ?? '']
  if (!verbe || event.status === previousStatus) return

  const auteur = actorName?.trim() || 'Un membre de l’équipe'
  const title = `${auteur} ${verbe} une tâche`
  const body = [
    event.title ?? 'Tâche',
    (event as any).assigned_to ? null : 'Non attribuée',
  ].filter(Boolean).join('\n')

  if (event.created_by && event.created_by !== actorId) {
    // Même raison que ci-dessus : on écrit pour le créateur de la tâche, pas
    // pour soi, ce que la règle d'accès de la table refuse.
    await createAdminClient().from('notifications').insert({
      user_id: event.created_by,
      type: 'task_progress_alert',
      title,
      body,
      entity_type: 'calendar_events',
      entity_id: event.id,
    })
  }

  await broadcastPushToManagers(
    { title, body, url: `/calendrier?event=${event.id}` },
    'task_progress_alert',
    { roles: ['gerant', 'associe', 'employe'], excludeUserId: actorId },
  )
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await request.json()
  const update: Record<string, unknown> = {}
  for (const key of ALLOWED_FIELDS) {
    if (key in body) update[key] = body[key]
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
  }

  // Un non-manager ne peut QUE changer le statut de sa tâche. On compare le
  // payload à l'état actuel : si un champ autre que `status` change réellement,
  // c'est une modification (ou un déplacement si l'horaire bouge) → refusé + tracé.
  if (!(await isManager(supabase, user.id))) {
    const { data: current } = await supabase
      .from('calendar_events')
      .select(ALLOWED_FIELDS.join(','))
      .eq('id', id)
      .maybeSingle()
    const cur = current as unknown as Record<string, unknown> | null
    const changed = cur
      ? ALLOWED_FIELDS.filter(k => k in update && !sameValue(k, update[k], cur[k]))
      : Object.keys(update)
    const structural = changed.filter(k => k !== 'status')
    if (structural.length > 0) {
      const attempt = structural.includes('start_at') || structural.includes('end_at') ? 'déplacement' : 'modification'
      return logDeniedTaskChange(supabase, user.id, id, attempt)
    }
  }

  // État AVANT mise à jour : c'est le seul moyen de savoir si l'assignation ou
  // le statut changent vraiment, et donc de ne pas re-notifier à chaque
  // enregistrement du tiroir, qui renvoie tous les champs même intacts.
  let previousAssignee: string | null = null
  let previousStatus: string | null = null
  if ('assigned_to' in update || 'status' in update) {
    const { data: before } = await supabase
      .from('calendar_events')
      .select('assigned_to, status')
      .eq('id', id)
      .maybeSingle()
    const b = before as { assigned_to: string | null; status: string | null } | null
    previousAssignee = b?.assigned_to ?? null
    previousStatus = b?.status ?? null
  }

  const { data, error } = await supabase
    .from('calendar_events')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if ('assigned_to' in update) {
    await notifierPersonneAssignee(supabase, data, previousAssignee, user.id)
  }

  if ('status' in update) {
    const { data: acteur } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()
    await notifierAvancement(supabase, data, previousStatus, user.id, acteur?.full_name ?? null)
  }

  if ('start_at' in update || 'end_at' in update) {
    await generateAlertsForEvent(data)
  }

  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  if (!(await isManager(supabase, user.id))) {
    return logDeniedTaskChange(supabase, user.id, id, 'suppression')
  }

  // `.select('id')` : on récupère les lignes réellement supprimées pour ne pas
  // répondre « succès » sur une suppression à 0 ligne (id inexistant ou filtré
  // par la RLS) — sinon l'UI croit avoir supprimé et l'élément « réapparaît ».
  const { data: deleted, error } = await supabase
    .from('calendar_events')
    .delete()
    .eq('id', id)
    .select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!deleted || deleted.length === 0) {
    return NextResponse.json({ error: 'Tâche introuvable ou déjà supprimée.' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
