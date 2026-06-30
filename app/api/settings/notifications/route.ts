import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json(data ?? {
    departure_alert: true, return_alert: true, late_return_alert: true,
    new_reservation_alert: true, new_task_alert: true,
    alert_window_start: 7, alert_window_end: 22,
    late_return_threshold_minutes: 30,
  })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await request.json()
  const { error } = await supabase
    .from('notification_settings')
    .upsert({ ...body, user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
