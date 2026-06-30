'use client'

import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)))
}

async function syncSubscription(sub: PushSubscription) {
  const json = sub.toJSON()
  if (!json.endpoint || !json.keys) return
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  }).catch(() => {})
}

export default function PushPermissionBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Afficher seulement si :
    // - push supporté
    // - permission pas encore accordée ou refusée
    // - SW enregistré (= mode standalone depuis l'écran d'accueil)
    if (!('Notification' in window)) return
    if (!('PushManager' in window)) return
    if (Notification.permission !== 'default') return
    if (!('serviceWorker' in navigator)) return

    // Petit délai pour laisser la page se charger
    const t = setTimeout(() => setVisible(true), 2500)
    return () => clearTimeout(t)
  }, [])

  if (!visible) return null

  async function handleEnable() {
    setVisible(false)
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) return

    try {
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      if (existing) { await syncSubscription(existing); return }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      })
      await syncSubscription(subscription)
    } catch {
      // navigateur non supporté
    }
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[9998] md:left-auto md:right-6 md:w-96">
      <div className="bg-[#111111] text-white rounded-2xl shadow-2xl p-4 flex items-start gap-3">
        <div className="mt-0.5 shrink-0 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
          <Bell className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-snug">Activer les notifications</p>
          <p className="text-xs text-white/60 mt-0.5 leading-snug">
            Recevez les alertes d'échéances, retours tardifs et départs imminents.
          </p>
          <button
            onClick={handleEnable}
            className="mt-2.5 text-xs font-semibold bg-white text-[#111111] rounded-lg px-3 py-1.5 hover:bg-white/90 transition-colors"
          >
            Activer
          </button>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="shrink-0 text-white/40 hover:text-white/80 transition-colors mt-0.5"
          aria-label="Fermer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
