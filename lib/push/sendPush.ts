import webpush from 'web-push'

webpush.setVapidDetails(
  'mailto:akpadjijepht@gmail.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export type PushPayload = {
  title: string
  body: string
  url?: string
  icon?: string
  badge?: string
}

export type StoredSubscription = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

export async function sendPushToSubscription(
  sub: StoredSubscription,
  payload: PushPayload
): Promise<{ ok: boolean; expired?: boolean }> {
  const subscription = {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.p256dh, auth: sub.auth },
  }
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload))
    return { ok: true }
  } catch (err: any) {
    const expired = err?.statusCode === 410 || err?.statusCode === 404
    return { ok: false, expired }
  }
}
