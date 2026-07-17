import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { token } = await req.json() as { token?: string }
  if (!token || typeof token !== 'string' || token.length < 10) {
    return NextResponse.json({ error: 'Token invalide' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('apns_tokens').upsert(
    {
      user_id: user.id,
      token,
      bundle_id: process.env.APNS_BUNDLE_ID ?? 'com.fleetlive.lmsdrive',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'token' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
