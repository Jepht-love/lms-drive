import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAlertsForEvent } from '@/lib/calendar/generateAlerts'
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

  const { data, error } = await supabase
    .from('calendar_events')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

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
