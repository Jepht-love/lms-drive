import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: caller } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (caller?.role !== 'gerant') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const body = await req.json()
  const allowed = ['full_name', 'role', 'phone', 'color', 'hire_date', 'is_active']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  const admin = createAdminClient()
  if (Object.keys(update).length > 0) {
    const { error } = await admin.from('profiles').update(update).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Permissions par onglet — best-effort (tolère l'absence de la colonne avant migration 017).
  if ('allowed_tabs' in body) {
    const effectiveRole = (body.role ?? null) as string | null
    const restricted = effectiveRole !== 'gerant' && effectiveRole !== 'associe'
    const tabs = restricted && Array.isArray(body.allowed_tabs) ? body.allowed_tabs : null
    try {
      await admin.from('profiles').update({ allowed_tabs: tabs }).eq('id', id)
    } catch { /* colonne absente — ignoré */ }
  }

  // Permissions fines — best-effort (colonnes optionnelles, migration 020).
  const finePerms: Record<string, unknown> = {}
  if ('allowed_doc_categories' in body) {
    finePerms.allowed_doc_categories = Array.isArray(body.allowed_doc_categories) ? body.allowed_doc_categories : null
  }
  if ('can_view_fleet' in body) {
    finePerms.can_view_fleet = body.can_view_fleet !== false
  }
  if (Object.keys(finePerms).length > 0) {
    try {
      await admin.from('profiles').update(finePerms).eq('id', id)
    } catch { /* colonnes absentes — ignoré */ }
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: caller } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (caller?.role !== 'gerant') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  if (id === user.id) {
    return NextResponse.json({ error: 'Vous ne pouvez pas supprimer votre propre profil.' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: target } = await admin
    .from('profiles').select('role, full_name').eq('id', id).single()
  if (!target) return NextResponse.json({ error: 'Profil introuvable.' }, { status: 404 })
  if (target.role === 'gerant') {
    return NextResponse.json({ error: 'Impossible de supprimer un gérant. Changez d\'abord son rôle.' }, { status: 400 })
  }

  // Super-utilisateur intouchable — best-effort tant que la migration 060
  // (colonne is_admin) n'est pas exécutée.
  try {
    const { data: adm } = await admin.from('profiles').select('is_admin').eq('id', id).single()
    if (adm?.is_admin) {
      return NextResponse.json({ error: 'Impossible de supprimer un administrateur.' }, { status: 400 })
    }
  } catch { /* colonne absente — ignoré */ }

  // Suppression définitive : le compte auth est supprimé, le profil suit par
  // ON DELETE CASCADE. Si le membre est référencé ailleurs (tâches, contrats,
  // pleins… sans CASCADE), Postgres refuse → on propose la désactivation, qui
  // préserve l'historique.
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) {
    const fkBlocked = /foreign key|violates|database error/i.test(error.message)
    return NextResponse.json({
      error: fkBlocked
        ? `${target.full_name} a un historique dans l'application (tâches, contrats…) et ne peut pas être supprimé. Désactivez-le depuis sa fiche pour lui retirer l'accès.`
        : error.message,
    }, { status: fkBlocked ? 409 : 400 })
  }

  return NextResponse.json({ success: true })
}
