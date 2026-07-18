import http2 from 'node:http2'
import jwt from 'jsonwebtoken'
import { createAdminClient } from '@/lib/supabase/admin'

// Envoi APNs token-based (.p8) en HTTP/2 natif, SANS ÉTAT : une connexion
// fraîche par lot d'envoi, fermée ensuite. Contrairement à node-apn (connexion
// HTTP/2 persistante), ce modèle est fiable en serverless (Vercel).

type ApnsPayload = { title: string; body: string; url?: string }

// Le JWT APNs est valable 1h ; Apple limite sa regénération. On le met en cache.
let cachedJwt: { token: string; iat: number } | null = null

function getJwt(): string | null {
  const key = process.env.APNS_KEY
  const keyId = process.env.APNS_KEY_ID
  const teamId = process.env.APNS_TEAM_ID
  if (!key || !keyId || !teamId) {
    console.error('[APNs] variables d\'env manquantes:', {
      APNS_KEY: !!key, APNS_KEY_ID: !!keyId, APNS_TEAM_ID: !!teamId,
    })
    return null
  }

  const now = Math.floor(Date.now() / 1000)
  // Réutilise le JWT tant qu'il a moins de ~45 min (Apple rejette > 1h).
  if (cachedJwt && now - cachedJwt.iat < 2700) return cachedJwt.token

  const privateKey = key.replace(/\\n/g, '\n')
  try {
    const token = jwt.sign({ iss: teamId, iat: now }, privateKey, {
      algorithm: 'ES256',
      keyid: keyId,
    })
    cachedJwt = { token, iat: now }
    return token
  } catch (e) {
    // Cause n°1 : APNS_KEY mal formée (sans lignes BEGIN/END, retours à la ligne
    // perdus, ou pas une clé EC .p8). Sans ce log, l'erreur était avalée
    // silencieusement et aucun envoi n'aboutissait sans trace.
    console.error('[APNs] signature JWT échouée (APNS_KEY mal formée ?):', (e as Error).message)
    return null
  }
}

export async function sendApnsToTokens(
  tokens: string[],
  payload: ApnsPayload
): Promise<void> {
  if (!tokens.length) return
  const token = getJwt()
  if (!token) return

  const host = process.env.APNS_PRODUCTION === 'true'
    ? 'https://api.push.apple.com'
    : 'https://api.sandbox.push.apple.com'
  const topic = process.env.APNS_BUNDLE_ID ?? 'com.fleetlive.lmsdrive'

  const body = JSON.stringify({
    aps: { alert: { title: payload.title, body: payload.body }, sound: 'default' },
    url: payload.url ?? '/',
  })

  const client = http2.connect(host)
  const deadTokens: string[] = []
  let sent = 0

  try {
    await new Promise<void>((resolve) => {
      let pending = tokens.length
      const done = () => { if (--pending <= 0) resolve() }

      client.on('error', (err) => {
        console.error('[APNs] connexion échouée:', (err as Error).message)
        resolve()
      })

      for (const device of tokens) {
        const req = client.request({
          ':method': 'POST',
          ':path': `/3/device/${device}`,
          'authorization': `bearer ${token}`,
          'apns-topic': topic,
          'apns-push-type': 'alert',
          'content-type': 'application/json',
        })

        let status = 0
        let respBody = ''
        req.on('response', (headers) => { status = Number(headers[':status']) })
        req.setEncoding('utf8')
        req.on('data', (chunk) => { respBody += chunk })
        req.on('end', () => {
          if (status === 200) {
            sent++
          } else {
            let reason = ''
            try { reason = JSON.parse(respBody).reason } catch {}
            console.error(`[APNs] échec ${status} reason=${reason} device=${device.slice(0, 8)}…`)
            if (reason === 'BadDeviceToken' || reason === 'Unregistered') deadTokens.push(device)
          }
          done()
        })
        req.on('error', (err) => {
          console.error('[APNs] requête échouée:', (err as Error).message)
          done()
        })
        req.write(body)
        req.end()
      }
    })
  } finally {
    client.close()
  }

  if (sent) console.log(`[APNs] envoyés: ${sent}/${tokens.length}`)

  if (deadTokens.length) {
    const admin = createAdminClient()
    await admin.from('apns_tokens').delete().in('token', deadTokens)
  }
}
