import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function normalize(a: any) {
  return { ...a, event: Array.isArray(a.event) ? a.event[0] ?? null : a.event }
}

// "pending" = pas encore ignorée ET l'heure de déclenchement est passée
// (sinon le badge afficherait des alertes encore loin dans le futur).
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const pending = searchParams.get('pending') === 'true'
  const countOnly = searchParams.get('count') === 'true'

  if (countOnly) {
    let query = supabase.from('calendar_alerts').select('id', { count: 'exact', head: true })
    if (pending) query = query.eq('dismissed', false).lte('trigger_at', new Date().toISOString())
    const { count, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ count: count ?? 0 })
  }

  let query = supabase
    .from('calendar_alerts')
    .select('*, event:calendar_events(id, title, start_at, event_type)')
    .order('trigger_at')
  if (pending) query = query.eq('dismissed', false).lte('trigger_at', new Date().toISOString())

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json((data ?? []).map(normalize))
}
