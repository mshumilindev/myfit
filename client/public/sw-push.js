/* global self, URL */
/**
 * Imported into the generated service worker (workbox `importScripts`).
 * Shows Spotter's web pushes (FCM data messages) and opens the right screen on tap.
 * Every push shows a notification — iOS revokes silent push subscriptions.
 */

self.addEventListener('push', (event) => {
  let d = {};
  try {
    const json = event.data ? event.data.json() : {};
    d = json.data || json;
  } catch {
    d = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(d.title || 'Spotter', {
        body: d.body || '',
        tag: d.tag || undefined,
        icon: '/brand/v2/icon-192.png',
        badge: '/brand/v2/icon-192.png',
        data: { url: d.url || '/' },
      });
      const badge = Number(d.badge);
      if (badge > 0 && self.navigator.setAppBadge) {
        try {
          await self.navigator.setAppBadge(badge);
        } catch {
          /* ignore */
        }
      }
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(
    (event.notification.data && event.notification.data.url) || '/',
    self.location.origin,
  ).href;
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of wins) {
        if ('focus' in w) {
          await w.focus();
          if (target !== self.location.origin + '/') {
            try {
              await w.navigate(target);
            } catch {
              /* cross-origin or unsupported — focusing is enough */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
