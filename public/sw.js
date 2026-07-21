/**
 * LMS Drive — Service Worker
 *
 * En DEV (localhost) : kill-switch. Le SW se désinstalle, purge tous les caches
 * et recharge les onglets. Cela élimine définitivement le bug des chunks
 * Turbopack périmés ("module factory not available") — le navigateur re-télécharge
 * toujours sw.js au reload, donc ce nettoyage s'applique sans manipulation manuelle.
 *
 * En PROD : cache PWA classique (statiques cache-first, pages network-first).
 */

const isLocalDev =
  self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1'

// ═══════════════════════════════════════════════════════════════════════════
// DEV — Kill-switch auto-désinstallant
// ═══════════════════════════════════════════════════════════════════════════
if (isLocalDev) {
  self.addEventListener('install', () => self.skipWaiting())

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      (async () => {
        // Purge tous les caches
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
        // Se désinscrit
        await self.registration.unregister()
        // Recharge tous les onglets contrôlés → repartent sans SW, chunks frais
        const clients = await self.clients.matchAll({ type: 'window' })
        clients.forEach((client) => client.navigate(client.url))
      })()
    )
  })

  // Pas de handler fetch → toutes les requêtes passent directement au réseau.
} else {
  // ═════════════════════════════════════════════════════════════════════════
  // PROD — Cache PWA
  // ═════════════════════════════════════════════════════════════════════════
  const CACHE_VERSION = 'v95'
  const STATIC_CACHE = `lms-static-${CACHE_VERSION}`
  const PAGES_CACHE = `lms-pages-${CACHE_VERSION}`
  const ALL_CACHES = [STATIC_CACHE, PAGES_CACHE]

  const PRECACHE_PAGES = [
    '/', '/menu', '/offline',
    '/reservations', '/vehicles', '/clients',
    '/calendrier', '/alertes', '/incidents',
    '/maintenance', '/documents', '/equipe',
  ]

  self.addEventListener('install', (event) => {
    event.waitUntil(
      caches
        .open(PAGES_CACHE)
        .then((cache) => cache.addAll(PRECACHE_PAGES).catch(() => {}))
        .then(() => self.skipWaiting())
    )
  })

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches
        .keys()
        .then((keys) =>
          Promise.all(keys.filter((key) => !ALL_CACHES.includes(key)).map((key) => caches.delete(key)))
        )
        .then(() => self.clients.claim())
        .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
        .then((clients) => {
          // Force le rechargement de toutes les pages ouvertes pour appliquer
          // le nouveau code JS immédiatement, sans fermeture manuelle de la PWA.
          clients.forEach((client) => { try { client.navigate(client.url) } catch {} })
        })
    )
  })

  self.addEventListener('fetch', (event) => {
    const { request } = event
    const url = new URL(request.url)

    if (request.method !== 'GET') return
    if (!url.protocol.startsWith('http')) return
    if (url.pathname.startsWith('/api/')) return
    if (url.hostname.includes('supabase.co')) return

    if (url.pathname.startsWith('/_next/static/')) {
      event.respondWith(cacheFirst(request, STATIC_CACHE))
      return
    }
    if (
      url.pathname.startsWith('/_next/image') ||
      /\.(png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf)$/.test(url.pathname)
    ) {
      event.respondWith(cacheFirst(request, STATIC_CACHE))
      return
    }
    if (request.mode === 'navigate') {
      event.respondWith(networkFirstWithOfflineFallback(request))
      return
    }
  })

  async function cacheFirst(request, cacheName) {
    const cached = await caches.match(request)
    if (cached) return cached
    try {
      const response = await fetch(request)
      if (response.ok) {
        const cache = await caches.open(cacheName)
        cache.put(request, response.clone())
      }
      return response
    } catch {
      return new Response('Ressource indisponible hors-ligne', { status: 503 })
    }
  }

  async function networkFirstWithOfflineFallback(request) {
    try {
      const response = await fetch(request)
      if (response.ok) {
        const cache = await caches.open(PAGES_CACHE)
        cache.put(request, response.clone())
      }
      return response
    } catch {
      const cached = await caches.match(request)
      if (cached) return cached
      const root = await caches.match('/')
      if (root) return root
      const offline = await caches.match('/offline')
      return (
        offline ??
        new Response(
          '<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>Hors-ligne</h2><p>LMS Drive n\'est pas disponible sans réseau pour cette page.</p><a href="/">Retour à l\'accueil</a></body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        )
      )
    }
  }

  self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
  })

  // ── Push notifications ──────────────────────────────────────────────────────
  self.addEventListener('push', (event) => {
    if (!event.data) return
    let payload
    try { payload = event.data.json() } catch { payload = { title: 'LMS Drive', body: event.data.text() } }

    const { title = 'LMS Drive', body = '', url = '/', icon = '/logo.png', badge = '/logo.png' } = payload

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon,
        badge,
        data: { url },
        vibrate: [150, 50, 150],
        requireInteraction: false,
      })
    )
  })

  self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    const url = event.notification.data?.url ?? '/'
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        const existing = clients.find((c) => c.url.includes(self.location.origin))
        if (existing) { existing.focus(); existing.navigate(url) }
        else self.clients.openWindow(url)
      })
    )
  })
}
