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
    // Un échec d'envoi était totalement muet : ni l'utilisateur ni nous ne
    // savions qu'une notification n'était pas partie, et il n'y avait aucun
    // moyen de diagnostiquer « je n'ai rien reçu ». On trace le service
    // destinataire et le code renvoyé, jamais l'adresse complète, qui est un
    // identifiant personnel. Un abonnement périmé (410/404) est normal : il est
    // nettoyé par l'appelant, on le dit sans en faire une erreur.
    const service = (() => { try { return new URL(sub.endpoint).host } catch { return 'inconnu' } })()
    const code = err?.statusCode ?? 'sans code'
    if (expired) {
      console.log(`[push] abonnement périmé (${code}) sur ${service}, il sera retiré`)
    } else {
      console.error(`[push] envoi refusé par ${service} (${code}) : ${err?.body ?? err?.message ?? 'raison inconnue'}`)
    }
    return { ok: false, expired }
  }
}
