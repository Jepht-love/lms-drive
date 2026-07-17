import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToSubscription, type PushPayload } from './sendPush'
import { sendApnsToTokens } from './sendApns'

export async function broadcastPushToManagers(payload: PushPayload): Promise<void> {
  try {
    const supabase = createAdminClient()

    const { data: managers } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['gerant', 'associe'])

    if (!managers?.length) return

    const managerIds = managers.map(m => m.id)

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
    const { data: apnsRows } = await supabase
      .from('apns_tokens')
      .select('token')
      .in('user_id', managerIds)

    if (apnsRows?.length) {
      await sendApnsToTokens(
        apnsRows.map(r => r.token),
        { title: payload.title, body: payload.body, url: payload.url }
      )
    }
  } catch {
    // push non bloquant
  }
}
