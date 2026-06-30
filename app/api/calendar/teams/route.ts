import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Vérifie que l'appelant est gérant/associé — seuls les responsables peuvent
// gérer (créer / renommer / supprimer) les équipes du calendrier.
async function requireManager() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }), supabase: null }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const isManager = profile?.role === 'gerant' || profile?.role === 'associe'
  if (!isManager) return { error: NextResponse.json({ error: 'Accès réservé aux responsables' }, { status: 403 }), supabase: null }
  return { error: null, supabase }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data, error } = await supabase
    .from('calendar_teams')
    .select('id, name, color, is_active')
    .eq('is_active', true)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const { error: authError, supabase } = await requireManager()
  if (authError) return authError

  const { name, color } = await request.json()
  if (!name) return NextResponse.json({ error: 'name requis' }, { status: 400 })

  const { data, error } = await supabase!
    .from('calendar_teams')
    .insert({ name, color: color ?? null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(data)
}

// PATCH : renommer / recolorer une équipe (gestion). id + name/color dans le body.
export async function PATCH(request: NextRequest) {
  const { error: authError, supabase } = await requireManager()
  if (authError) return authError

  const { id, name, color } = await request.json()
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if (typeof name === 'string' && name.trim()) patch.name = name.trim()
  if (typeof color === 'string') patch.color = color
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Rien à modifier' }, { status: 400 })

  const { data, error } = await supabase!
    .from('calendar_teams')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(data)
}

// DELETE : suppression "douce" (is_active = false). L'équipe disparaît de la
// sidebar et de la création d'événements, mais les événements déjà rattachés
// gardent leur nom d'équipe (enrichEvents résout l'équipe par id sans filtrer
// is_active) — aucune donnée historique cassée. id passé en query (?id=).
export async function DELETE(request: NextRequest) {
  const { error: authError, supabase } = await requireManager()
  if (authError) return authError

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const { error } = await supabase!
    .from('calendar_teams')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
