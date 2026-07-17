import apn from 'apn'
import { createAdminClient } from '@/lib/supabase/admin'

let provider: apn.Provider | null = null

function getProvider(): apn.Provider | null {
  if (provider) return provider
  const key = process.env.APNS_KEY
  const keyId = process.env.APNS_KEY_ID
  const teamId = process.env.APNS_TEAM_ID
  if (!key || !keyId || !teamId) {
    console.error('[APNs] variables d\'env manquantes:', {
      APNS_KEY: !!key, APNS_KEY_ID: !!keyId, APNS_TEAM_ID: !!teamId,
    })
    return null
  }

  // Passerelle APNs : sandbox pour un build Development (câble/Xcode Debug),
  // production pour un build TestFlight/App Store. Piloté par APNS_PRODUCTION
  // (défaut sandbox = false, plus sûr en test).
  const isProduction = process.env.APNS_PRODUCTION === 'true'

  provider = new apn.Provider({
    token: {
      key: Buffer.from(key.replace(/\\n/g, '\n')),
      keyId,
      teamId,
    },
    production: isProduction,
  })
  return provider
}

export async function sendApnsToTokens(
  tokens: string[],
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  if (!tokens.length) return
  const prov = getProvider()
  if (!prov) return

  const notification = new apn.Notification()
  notification.alert = { title: payload.title, body: payload.body }
  notification.sound = 'default'
  notification.topic = process.env.APNS_BUNDLE_ID ?? 'com.fleetlive.lmsdrive'
  notification.expiry = Math.floor(Date.now() / 1000) + 3600
  if (payload.url) notification.payload = { url: payload.url }

  try {
    const result = await prov.send(notification, tokens)

    // Log de diagnostic (visible dans les logs Vercel).
    if (result.failed?.length) {
      console.error('[APNs] échecs:', JSON.stringify(result.failed.map(f => ({
        device: f.device?.slice(0, 8) + '…',
        status: f.status,
        reason: f.response?.reason,
      }))))
    }
    if (result.sent?.length) {
      console.log(`[APNs] envoyés: ${result.sent.length}`)
    }

    const deadTokens = (result.failed ?? [])
      .filter(f => f.response?.reason === 'BadDeviceToken' || f.response?.reason === 'Unregistered')
      .map(f => f.device)
    if (deadTokens.length) {
      const admin = createAdminClient()
      await admin.from('apns_tokens').delete().in('token', deadTokens)
    }
  } catch (err) {
    console.error('[APNs] exception:', err)
  }
}
