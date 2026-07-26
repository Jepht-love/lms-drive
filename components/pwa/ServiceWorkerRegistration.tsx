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

    // Toutes les ressources allouées ici (1 timer + 4 écouteurs) sont libérées
    // par le cleanup en fin d'effet. Sans lui, un remontage du composant (Fast
    // Refresh, StrictMode, changement de groupe de routes) empile les
    // `setInterval` et les écouteurs : plusieurs `registration.update()` en
    // parallèle et des rechargements de page en double.
    // Les écouteurs sont posés au niveau de l'effet — et non dans le `.then()` —
    // pour que le cleanup puisse les retirer directement, `registration` étant
    // simplement mémorisé dans `reg` quand l'enregistrement aboutit.
    let cancelled = false
    let reg: ServiceWorkerRegistration | undefined
    let updateTimer: ReturnType<typeof setInterval> | undefined

    // Recharge la page dès que le nouveau SW prend le contrôle —
    // sans ça, les vieux chunks JS restent en mémoire même après l'activation.
    let reloading = false
    const onControllerChange = () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    }

    // iOS gèle setInterval en arrière-plan : une PWA installée reprend au
    // lieu de recharger, donc le timer ne se relance jamais et le SW reste
    // bloqué sur l'ancien code. On force une vérification à chaque retour au
    // premier plan → nouveau SW détecté → skipWaiting → controllerchange →
    // reload. C'est ce qui rend les déploiements visibles sans fermeture manuelle.
    const checkOnFocus = () => {
      if (document.visibilityState === 'visible') reg?.update()
    }

    const onUpdateFound = () => {
      const newWorker = reg?.installing
      newWorker?.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          newWorker.postMessage({ type: 'SKIP_WAITING' })
        }
      })
    }

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    document.addEventListener('visibilitychange', checkOnFocus)
    window.addEventListener('focus', checkOnFocus)

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        if (cancelled) return
        reg = registration

        // Vérifier une mise à jour toutes les 5 minutes (au lieu d'1h)
        updateTimer = setInterval(() => registration.update(), 5 * 60 * 1000)

        registration.addEventListener('updatefound', onUpdateFound)

        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' })
        }

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

    return () => {
      cancelled = true
      clearInterval(updateTimer)
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      document.removeEventListener('visibilitychange', checkOnFocus)
      window.removeEventListener('focus', checkOnFocus)
      reg?.removeEventListener('updatefound', onUpdateFound)
    }
  }, [])

  return null
}
