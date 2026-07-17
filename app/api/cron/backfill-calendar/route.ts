import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncReservationToCalendar } from '@/lib/calendar/syncRental'

// Backfill ponctuel : re-synchronise toutes les réservations à venir vers le
// calendrier. Matérialise les tâches (dont « Lavage avant location ») manquantes
// pour les résas confirmées AVANT l'ajout de la logique de création de tâche.
// Idempotent (upsert). Protégé par CRON_SECRET.
// Usage : GET /api/cron/backfill-calendar?secret=<CRON_SECRET>
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  const querySecret = request.nextUrl.searchParams.get('secret')
  const validSecret = process.env.CRON_SECRET
  const authorized = auth === `Bearer ${validSecret}` || querySecret === validSecret
  if (!authorized) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: reservations, error } = await supabase
    .from('reservations')
    .select('id')
    .in('status', ['option', 'confirmee'])
    .gte('start_datetime', new Date().toISOString())

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let synced = 0
  const failed: string[] = []
  for (const r of reservations ?? []) {
    try {
      await syncReservationToCalendar(r.id)
      synced++
    } catch (e) {
      failed.push(r.id)
    }
  }

  return NextResponse.json({
    ok: true,
    total: reservations?.length ?? 0,
    synced,
    failed: failed.length,
  })
}
