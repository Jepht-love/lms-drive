import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToSubscription, type PushPayload } from './sendPush'
import { sendApnsToTokens } from './sendApns'
import { businessNow } from '@/lib/calendar/dateUtils'
import type { NotificationType } from './notificationTypes'

// Diffuse une notification push aux managers. Si un `type` est fourni, l'envoi
// est filtré par destinataire : seul un manager qui a laissé ce type activé
// dans ses réglages ET qui est dans sa plage horaire de réception le reçoit.
// Sans `type` (rétro-compat), l'envoi part à tous les managers, sans filtre.
export async function broadcastPushToManagers(
  payload: PushPayload,
  type?: NotificationType,
): Promise<void> {
  try {
    const supabase = createAdminClient()

    const { data: managers } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['gerant', 'associe'])

    if (!managers?.length) return
    let managerIds = managers.map(m => m.id)

    // Filtrage par réglages utilisateur (défaut : activé, fenêtre 7h-22h).
    if (type) {
      const { data: settingsRows } = await supabase
        .from('notification_settings')
        .select('*')
        .in('user_id', managerIds)
      const byUser = new Map((settingsRows ?? []).map((s: any) => [s.user_id, s]))
      const hour = businessNow().getHours()
      managerIds = managerIds.filter(uid => {
        const s: any = byUser.get(uid)
        const enabled  = s ? s[type] !== false : true
        const wStart   = s?.alert_window_start ?? 7
        const wEnd     = s?.alert_window_end ?? 22
        const inWindow = hour >= wStart && hour < wEnd
        return enabled && inWindow
      })
    }

    if (!managerIds.length) return

    // Web push (navigateur / PWA)
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', managerIds)

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

    // APNs (app iOS native)
    const { data: apnsRows, error: apnsErr } = await supabase
      .from('apns_tokens')
      .select('token')
      .in('user_id', managerIds)

    console.log(`[APNs] broadcast${type ? ` (${type})` : ''}: ${managerIds.length} managers, ${apnsRows?.length ?? 0} tokens APNs`, apnsErr ?? '')

    if (apnsRows?.length) {
      await sendApnsToTokens(
        apnsRows.map(r => r.token),
        { title: payload.title, body: payload.body, url: payload.url }
      )
    }
  } catch (e) {
    // Push non bloquant, mais on trace : un catch muet ici masquait toute panne
    // (clé APNs invalide, réseau…) et rendait le diagnostic impossible.
    console.error('[APNs/push] broadcast échoué:', (e as Error).message)
  }
}
