import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: caller } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (caller?.role !== 'gerant' && caller?.role !== 'associe') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { email, full_name, role, phone, color, hire_date, allowed_tabs, allowed_doc_categories, can_view_fleet } = await req.json()

  if (!email || !full_name || !role) {
    return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
  }

  // Permissions : seulement pour un membre restreint (employé/prestataire) ;
  // gérants/associés = accès complet.
  const restricted = role === 'employe' || role === 'prestataire'
  const allowedTabs    = restricted && Array.isArray(allowed_tabs) ? allowed_tabs : null
  const allowedDocCats = restricted && Array.isArray(allowed_doc_categories) ? allowed_doc_categories : null
  const canViewFleet   = restricted ? can_view_fleet !== false : true

  const admin = createAdminClient()

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name, role },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm`,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Upsert : crée ou met à jour le profil (le trigger peut avoir déjà créé une ligne)
  await admin.from('profiles').upsert({
    id: data.user.id,
    full_name,
    role,
    phone: phone || null,
    color: color || '#6366f1',
    hire_date: hire_date || null,
  }, { onConflict: 'id' })

  // Permissions par onglet — best-effort : tolère l'absence de la colonne tant que
  // la migration 017 n'est pas exécutée (n'empêche pas la création du membre).
  try {
    await admin.from('profiles').update({ allowed_tabs: allowedTabs }).eq('id', data.user.id)
  } catch { /* colonne allowed_tabs absente — ignoré */ }

  // Permissions fines (catégories documents + bloc flotte) — best-effort (migration 020).
  try {
    await admin.from('profiles')
      .update({ allowed_doc_categories: allowedDocCats, can_view_fleet: canViewFleet })
      .eq('id', data.user.id)
  } catch { /* colonnes absentes — ignoré */ }

  return NextResponse.json({ success: true, userId: data.user.id })
}
