'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    const isLocalDev =
      location.hostname === 'localhost' || location.hostname === '127.0.0.1'

    // En développement, le service worker sert d'anciens chunks Turbopack après
    // chaque rebuild ("module factory not available"). On le désinscrit et on
    // purge les caches pour éliminer ce churn. Le SW reste actif en production.
    if (isLocalDev) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister())
      })
      if (window.caches) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)))
      }
      return
    }

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        // Vérifier les mises à jour toutes les 60 minutes
        setInterval(() => registration.update(), 60 * 60 * 1000)

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
      })
      .catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[SW] Enregistrement échoué :', err)
        }
      })
  }, [])

  return null
}
