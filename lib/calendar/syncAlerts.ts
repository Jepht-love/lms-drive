import { createAdminClient } from '@/lib/supabase/admin'
import type { AppAlert } from '@/lib/utils/alerts'

const ALERT_DURATION_MINUTES = 60

/**
 * Reflète les alertes urgentes/importantes du tableau de bord (/alertes) sur le
 * calendrier, catégorisées simplement comme une tâche (même event_type que
 * "Lavage avant location") — pour que tout ce qui demande une action vive au
 * même endroit que les départs/retours. Idempotent via calendar_events.source_key
 * (migration 026) ; supprime la tâche dès que l'alerte sous-jacente se résout.
 */
export async function syncAlertsToCalendar(
  supabase: ReturnType<typeof createAdminClient>,
  alerts: AppAlert[],
): Promise<void> {
  // 'retard' et 'lavage' sont déjà représentés sur le calendrier par les
  // événements liés à la réservation elle-même (retour_vehicule passe en
  // en_cours quand en retard ; syncWashTask crée déjà sa propre tâche lavage,
  // avec un déclencheur plus précis que l'alerte de tableau de bord) — les
  // resynchroniser ici créerait un doublon visuel sur la même réservation.
  const ALREADY_ON_CALENDAR_TYPES = ['retard', 'lavage']
  const actionable = alerts.filter(a =>
    (a.category === 'urgent' || a.category === 'important') &&
    !ALREADY_ON_CALENDAR_TYPES.includes(a.type),
  )

  const { data: existing } = await supabase
    .from('calendar_events')
    .select('id, source_key')
    .not('source_key', 'is', null)

  const existingByKey = new Map((existing ?? []).map(e => [e.source_key as string, e.id as string]))
  const seenKeys = new Set<string>()

  for (const alert of actionable) {
    seenKeys.add(alert.id)
    const startAt = alert.date ? new Date(alert.date) : new Date()
    const endAt = new Date(startAt.getTime() + ALERT_DURATION_MINUTES * 60_000)

    const payload = {
      title: `${alert.label} — ${alert.sublabel}`,
      event_type: 'tache' as const,
      status: 'a_faire' as const,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      source_key: alert.id,
      reservation_id: alert.reservationId ?? null,
      vehicle_ids: alert.vehicleId ? [alert.vehicleId] : null,
      notes: alert.href,
    }

    const existingId = existingByKey.get(alert.id)
    if (existingId) {
      await supabase.from('calendar_events').update(payload).eq('id', existingId)
    } else {
      await supabase.from('calendar_events').insert(payload)
    }
  }

  const staleIds = [...existingByKey.entries()]
    .filter(([key]) => !seenKeys.has(key))
    .map(([, eventId]) => eventId)
  if (staleIds.length > 0) {
    await supabase.from('calendar_events').delete().in('id', staleIds)
  }
}
