import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface ResourceRow {
  id: string
  full_name: string
  role: string | null
  type: 'profile' | 'team'
  color: string | null
}

// GET : liste fusionnée collaborateurs + équipes pour la sidebar du calendrier.
// - Équipes : visibles de tout le monde (pas de donnée sensible).
// - Collaborateurs : un gérant/associé voit tout le monde (via client admin, car
//   profiles_own_read ne couvre pas 'associe') ; un employé ne voit que lui-même
//   (B7 — pas de raison de lister des collègues dont il ne verra jamais les
//   événements, la RLS de calendar_events les filtrerait de toute façon).
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: caller } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .single()

  const isManager = caller?.role === 'gerant' || caller?.role === 'associe'

  let profiles: { id: string; full_name: string; role: string }[] = []
  if (isManager) {
    const admin = createAdminClient()
    const { data } = await admin
      .from('profiles')
      .select('id, full_name, role')
      .eq('is_active', true)
      .order('full_name')
    profiles = data ?? []
  } else if (caller) {
    profiles = [{ id: caller.id, full_name: caller.full_name, role: caller.role }]
  }

  const admin = createAdminClient()
  const { data: teams } = await admin
    .from('calendar_teams')
    .select('id, name, color')
    .eq('is_active', true)
    .order('name')

  const resources: ResourceRow[] = [
    ...profiles.map(p => ({ id: p.id, full_name: p.full_name, role: p.role, type: 'profile' as const, color: null })),
    ...(teams ?? []).map(t => ({ id: t.id, full_name: t.name, role: null, type: 'team' as const, color: t.color })),
  ]

  return NextResponse.json({
    me: caller ? { id: caller.id, role: caller.role } : null,
    resources,
  })
}
