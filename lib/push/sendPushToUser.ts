import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToSubscription, type PushPayload } from './sendPush'
import { sendApnsToTokens } from './sendApns'
import { businessNow } from '@/lib/calendar/dateUtils'
import type { NotificationType } from './notificationTypes'

/**
 * Envoie une notification à UNE personne précise.
 *
 * Jusqu'ici l'application ne savait que diffuser à tous les gérants et associés
 * (`broadcastPushToManagers`). Conséquence constatée par Jeff le 27/07/2026 en
 * testant sur trois appareils : assigner un lavage à un associé n'envoyait rien
 * à l'intéressé, et le moindre changement de statut alertait tout le monde.
 *
 * Mêmes règles de respect du destinataire que la diffusion : le type de
 * notification doit être activé dans ses réglages, et l'heure doit tomber dans
 * sa plage de réception (7h-22h par défaut, à l'heure de l'agence).
 *
 * Non bloquant : une panne d'envoi ne doit jamais empêcher l'action métier
 * d'aboutir, mais elle est tracée — un catch muet rendrait le diagnostic
 * impossible.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  type?: NotificationType,
): Promise<void> {
  if (!userId) return
  try {
    const supabase = createAdminClient()

    if (type) {
      const { data: settings } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      const s = settings as any
      const enabled = s ? s[type] !== false : true
      const hour = businessNow().getHours()
      const inWindow = hour >= (s?.alert_window_start ?? 7) && hour < (s?.alert_window_end ?? 22)
      if (!enabled || !inWindow) return
    }

    // Web push (navigateur / application installée)
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)

    if (subs?.length) {
      const expired: string[] = []
      await Promise.all(subs.map(async sub => {
        const result = await sendPushToSubscription(sub, payload)
        if (result.expired) expired.push(sub.id)
      }))
      if (expired.length) {
        await supabase.from('push_subscriptions').delete().in('id', expired)
      }
    }

    // APNs (application iOS native)
    const { data: apnsRows } = await supabase
      .from('apns_tokens')
      .select('token')
      .eq('user_id', userId)

    console.log(`[push] envoi ciblé${type ? ` (${type})` : ''} → ${userId} : ${subs?.length ?? 0} navigateur(s), ${apnsRows?.length ?? 0} token(s) iOS`)

    if (apnsRows?.length) {
      await sendApnsToTokens(
        apnsRows.map(r => r.token),
        { title: payload.title, body: payload.body, url: payload.url },
      )
    }
  } catch (e) {
    console.error('[push] envoi ciblé échoué:', (e as Error).message)
  }
}
