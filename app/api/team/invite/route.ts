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

  const { email, full_name, role, phone, color, hire_date } = await req.json()

  if (!email || !full_name || !role) {
    return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
  }

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

  return NextResponse.json({ success: true, userId: data.user.id })
}
