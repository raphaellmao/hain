// Wird vom Service Worker mitgeladen (workbox.importScripts in vite.config.ts):
// Tippen auf eine Benachrichtigung holt die App nach vorn.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => 'focus' in w)
      return open ? open.focus() : self.clients.openWindow(`${self.registration.scope}#/todos`)
    }),
  )
})

// Kalender fürs iPhone (siehe src/lib/calendar.ts): Unter …/kalender/ antwortet der
// Service Worker mit der Datei, die die App in den Cache gelegt hat.
const CALENDAR_PATH = new URL('kalender/', self.registration.scope).pathname

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin || !url.pathname.startsWith(CALENDAR_PATH)) return
  // Sonst griffe auch Workbox zu und lieferte die App aus
  event.stopImmediatePropagation()
  event.respondWith(
    caches
      .open('hain-kalender')
      .then((cache) => cache.match(url.pathname))
      .then((file) => file ?? Response.redirect(self.registration.scope, 302)),
  )
})
