import { fetchAllAlerts } from '@/lib/utils/alerts'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ count: 0, urgent: 0 }, { status: 401 })
    const alerts = await fetchAllAlerts(supabase)
    return NextResponse.json({ count: alerts.length, urgent: alerts.filter(a => a.urgent).length })
  } catch {
    return NextResponse.json({ count: 0, urgent: 0 }, { status: 500 })
  }
}
