// NagarMind Service Worker — v2
const CACHE_NAME = 'nagarmind-v2'

// Only precache the actual HTML entry point — NOT SPA routes
const PRECACHE_URLS = ['/']

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

// ── Activate — delete old caches ──────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)

  // 1. Never intercept API calls, WebSocket upgrades, or cross-origin requests
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/ws/') ||
    request.method !== 'GET' ||
    url.origin !== self.location.origin
  ) {
    return
  }

  // 2. Static assets (images, fonts, icons) — cache-first
  if (
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|woff2?|ico)$/)
  ) {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then(c => c.put(request, clone))
          }
          return res
        })
      })
    )
    return
  }

  // 3. JS/CSS bundles (Vite hashed filenames) — cache-first
  if (url.pathname.match(/\.(js|css)$/) && url.pathname.includes('assets')) {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then(c => c.put(request, clone))
          }
          return res
        })
      })
    )
    return
  }

  // 4. HTML navigation requests — network-first, fallback to cached '/'
  //    This is the key fix: SPA routes like /citizen/auth, /officer/auth
  //    all fall back to index.html so React Router handles them correctly
  if (request.mode === 'navigate' || request.destination === 'document') {
    e.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then(c => c.put(request, clone))
          }
          return res
        })
        .catch(() => caches.match('/').then(r => r || caches.match(request)))
    )
    return
  }

  // 5. Everything else — network-first, silent fallback
  e.respondWith(
    fetch(request).catch(() => caches.match(request))
  )
})

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', e => {
  const data = e.data?.json() || {}
  e.waitUntil(
    self.registration.showNotification(data.title || 'NagarMind', {
      body:    data.message || 'You have a new update',
      icon:    '/icon-192.png',
      badge:   '/icon-192.png',
      tag:     data.complaint_id || 'nagarmind',
      data:    { url: data.url || '/citizen/complaints' },
      vibrate: [200, 100, 200],
      actions: [
        { action: 'view',    title: 'View'    },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    })
  )
})

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close()
  if (e.action === 'dismiss') return

  const targetUrl = e.notification.data?.url || '/citizen/complaints'

  e.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // If app is already open, focus it and navigate
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus()
            client.navigate(targetUrl)
            return
          }
        }
        // Otherwise open a new tab
        return clients.openWindow(targetUrl)
      })
  )
})