import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { broadcastPushToManagers } from '@/lib/push/broadcastPush'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { status } = await request.json()
  if (!status) return NextResponse.json({ error: 'status requis' }, { status: 400 })

  const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const { data: event } = await supabase.from('calendar_events').select('assigned_to, title').eq('id', id).single()

  const isManager = caller?.role === 'gerant' || caller?.role === 'associe'
  const isOwner = event?.assigned_to === user.id
  if (!isManager && !isOwner) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('calendar_events')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const eventTitle = event?.title ?? 'Tâche'

  if (status === 'en_cours') {
    await broadcastPushToManagers({
      title: 'Départ confirmé',
      body: eventTitle,
      url: '/calendrier',
    }, 'departure_alert')
  } else if (status === 'termine') {
    await broadcastPushToManagers({
      title: 'Retour effectué',
      body: eventTitle,
      url: '/calendrier',
    }, 'return_alert')
  }

  return NextResponse.json(data)
}
