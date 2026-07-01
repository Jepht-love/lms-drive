'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    const isLocalDev =
      location.hostname === 'localhost' || location.hostname === '127.0.0.1'

    if (isLocalDev) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister())
      })
      if (window.caches) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)))
      }
      return
    }

    // Recharge la page dès que le nouveau SW prend le contrôle —
    // sans ça, les vieux chunks JS restent en mémoire même après l'activation.
    let reloading = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    })

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        // Vérifier une mise à jour toutes les 5 minutes (au lieu d'1h)
        setInterval(() => registration.update(), 5 * 60 * 1000)

        // iOS gèle setInterval en arrière-plan : une PWA installée reprend au
        // lieu de recharger, donc le timer ne se relance jamais et le SW reste
        // bloqué sur l'ancien code. On force une vérification à chaque retour au
        // premier plan → nouveau SW détecté → skipWaiting → controllerchange →
        // reload. C'est ce qui rend les déploiements visibles sans fermeture manuelle.
        const checkOnFocus = () => {
          if (document.visibilityState === 'visible') registration.update()
        }
        document.addEventListener('visibilitychange', checkOnFocus)
        window.addEventListener('focus', checkOnFocus)

        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' })
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })

        // Re-sync l'abonnement push si la permission est déjà accordée.
        // Couvre le cas où la subscription a expiré et été supprimée de la DB
        // par broadcastPush (erreur 410/404) — l'utilisateur ne revoit jamais
        // la bannière (Notification.permission resté 'granted') et ne reçoit
        // plus rien. Ce bloc re-souscrit et re-sync à chaque ouverture de l'app.
        if ('PushManager' in window && 'Notification' in window && Notification.permission === 'granted') {
          const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
          if (vapidKey) {
            navigator.serviceWorker.ready.then(async reg => {
              try {
                let sub = await reg.pushManager.getSubscription()
                if (!sub) {
                  const padding = '='.repeat((4 - (vapidKey.length % 4)) % 4)
                  const base64 = (vapidKey + padding).replace(/-/g, '+').replace(/_/g, '/')
                  const rawData = window.atob(base64)
                  const appKey = new Uint8Array([...rawData].map(c => c.charCodeAt(0)))
                  sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey as BufferSource })
                }
                const json = sub.toJSON()
                if (json.endpoint && json.keys) {
                  await fetch('/api/push/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
                  })
                }
              } catch {
                // non bloquant
              }
            })
          }
        }

      })
      .catch(() => {})
  }, [])

  return null
}
