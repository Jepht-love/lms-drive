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
  photo?: TelegramPhoto | null,
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

  try {
    if (photo) {
      // sendPhoto : la légende est limitée à 1024 caractères par Telegram.
      const form = new FormData()
      form.append('chat_id', chatId)
      form.append('caption', caption.slice(0, 1024))
      form.append('parse_mode', 'Markdown')
      form.append('photo', new Blob([photo.bytes], { type: photo.contentType }), photo.filename)
      const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) console.error('[SAV] Telegram sendPhoto échec:', await res.text())
    } else {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: caption, parse_mode: 'Markdown' }),
      })
      if (!res.ok) console.error('[SAV] Telegram sendMessage échec:', await res.text())
    }
  } catch (err) {
    console.error('[SAV] Telegram exception:', err)
  }
}
