import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToSubscription, type PushPayload } from './sendPush'

export async function broadcastPushToManagers(payload: PushPayload): Promise<void> {
  try {
    const supabase = createAdminClient()

    const { data: managers } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['gerant', 'associe'])

    if (!managers?.length) return

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', managers.map(m => m.id))

    if (!subs?.length) return

    const expired: string[] = []
    await Promise.all(subs.map(async sub => {
      const result = await sendPushToSubscription(sub, payload)
      if (result.expired) expired.push(sub.id)
    }))

    if (expired.length) {
      await supabase.from('push_subscriptions').delete().in('id', expired)
    }
  } catch {
    // push non bloquant
  }
}
