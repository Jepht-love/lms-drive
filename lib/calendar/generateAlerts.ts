import { createAdminClient } from '@/lib/supabase/admin'
import { ALERT_RULES } from './constants'
import type { CalendarEvent } from '@/types/calendar'

/**
 * calendar_alerts n'a aucune policy RLS d'INSERT/DELETE (génération système
 * uniquement) → client admin obligatoire ici, pas le client de session.
 */
export async function generateAlertsForEvent(event: Pick<CalendarEvent, 'id' | 'event_type' | 'start_at'>): Promise<void> {
  const admin = createAdminClient()

  await admin.from('calendar_alerts').delete().eq('event_id', event.id)

  const alertsToInsert: { event_id: string; alert_type: string; trigger_at: string }[] = []
  for (const [alertType, rule] of Object.entries(ALERT_RULES)) {
    if (!rule.eventTypes.includes(event.event_type)) continue
    const triggerAt = new Date(event.start_at).getTime() + rule.offsetMinutes * 60_000
    if (triggerAt > Date.now()) {
      alertsToInsert.push({
        event_id: event.id,
        alert_type: alertType,
        trigger_at: new Date(triggerAt).toISOString(),
      })
    }
  }

  if (alertsToInsert.length > 0) {
    await admin.from('calendar_alerts').insert(alertsToInsert)
  }
}
