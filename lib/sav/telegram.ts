// Notification Telegram pour les tickets SAV — envoyée au super-admin uniquement.
// Configuré via TELEGRAM_BOT_TOKEN et TELEGRAM_CHAT_ID (voir .env.local).
// Non bloquant : si la config manque ou l'API échoue, on log et on continue.

import 'server-only'

interface TelegramTicket {
  module?: string | null
  section?: string | null
  pagePath?: string | null
  reporterName?: string | null
  reporterRole?: string | null
  description: string
}

interface TelegramPhoto {
  bytes: ArrayBuffer
  filename: string
  contentType: string
}

function buildCaption(t: TelegramTicket): string {
  const context = [t.module, t.section].filter(Boolean).join(' › ') || '—'
  const who = [t.reporterName, t.reporterRole && `(${t.reporterRole})`]
    .filter(Boolean)
    .join(' ') || 'Utilisateur'
  const when = new Date().toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
  return [
    '🐛 *Nouveau ticket SAV*',
    `📍 ${context}`,
    t.pagePath ? `🔗 \`${t.pagePath}\`` : null,
    `👤 ${who}`,
    `🕐 ${when}`,
    '',
    `📝 ${t.description}`,
  ].filter(Boolean).join('\n')
}

export async function sendSavTelegram(
  ticket: TelegramTicket,
  photos?: TelegramPhoto[] | null,
): Promise<void> {
  // .trim() défensif : sur Vercel, un espace ou retour à la ligne collé par
  // erreur dans la valeur casse l'appel Telegram (404 token / 400 chat not found).
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim()
  if (!token || !chatId) {
    console.warn('[SAV] Telegram non configuré (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID manquants) — ticket enregistré sans notification.')
    return
  }

  const caption = buildCaption(ticket)
  const list = (photos ?? []).filter(Boolean)

  try {
    if (list.length === 0) {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: caption, parse_mode: 'Markdown' }),
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) console.error('[SAV] Telegram sendMessage échec:', await res.text())
      return
    }

    if (list.length === 1) {
      // sendPhoto : la légende est limitée à 1024 caractères par Telegram.
      const photo = list[0]
      const form = new FormData()
      form.append('chat_id', chatId)
      form.append('caption', caption.slice(0, 1024))
      form.append('parse_mode', 'Markdown')
      form.append('photo', new Blob([photo.bytes], { type: photo.contentType }), photo.filename)
      const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) console.error('[SAV] Telegram sendPhoto échec:', await res.text())
      return
    }

    // Plusieurs photos → album (sendMediaGroup, 2 à 10 par lot). La légende va
    // uniquement sur la 1ʳᵉ photo du 1ᵉʳ lot. Au-delà de 10, on envoie plusieurs
    // albums à la suite.
    for (let start = 0; start < list.length; start += 10) {
      const chunk = list.slice(start, start + 10)
      const form = new FormData()
      form.append('chat_id', chatId)
      const media = chunk.map((p, i) => {
        const key = `photo${start + i}`
        form.append(key, new Blob([p.bytes], { type: p.contentType }), p.filename)
        return {
          type: 'photo' as const,
          media: `attach://${key}`,
          ...(start === 0 && i === 0
            ? { caption: caption.slice(0, 1024), parse_mode: 'Markdown' }
            : {}),
        }
      })
      form.append('media', JSON.stringify(media))
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMediaGroup`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(30000),
      })
      if (!res.ok) console.error('[SAV] Telegram sendMediaGroup échec:', await res.text())
    }
  } catch (err) {
    console.error('[SAV] Telegram exception:', err)
  }
}
