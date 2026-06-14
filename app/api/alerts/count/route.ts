import { fetchAllAlerts } from '@/lib/utils/alerts'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const alerts = await fetchAllAlerts()
    return NextResponse.json({ count: alerts.length, urgent: alerts.filter(a => a.urgent).length })
  } catch {
    return NextResponse.json({ count: 0, urgent: 0 }, { status: 500 })
  }
}
