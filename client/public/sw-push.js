/* global self, URL */
/**
 * Imported into the generated service worker (workbox `importScripts`).
 * Shows Spotter's web pushes (FCM data messages) and opens the right screen on tap.
 * Every push shows a notification — iOS revokes silent push subscriptions.
 */

/* Q-17 quiet hours: the page keeps the setting in IndexedDB `spotter.prefs`. A Coach chat push inside the window still
   shows (iOS revokes silent subscriptions) but without sound or vibration. */
function readQuiet() {
  return new Promise((resolve) => {
    try {
      const r = self.indexedDB.open('spotter.prefs', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onerror = () => resolve(null);
      r.onsuccess = () => {
        try {
          const g = r.result.transaction('kv', 'readonly').objectStore('kv').get('quiet');
          g.onsuccess = () => resolve(g.result || null);
          g.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      };
    } catch {
      resolve(null);
    }
  });
}
function inQuiet(q, now) {
  const c = q || { on: true, from: 1320, to: 420 };
  if (!c.on || c.from === c.to) return false;
  const m = now.getHours() * 60 + now.getMinutes();
  return c.from < c.to ? m >= c.from && m < c.to : m >= c.from || m < c.to;
}

self.addEventListener('push', (event) => {
  let d = {};
  try {
    const json = event.data ? event.data.json() : {};
    d = json.data || json;
  } catch {
    d = { body: event.data ? event.data.text() : '' };
  }
  // SPO-237: the server's silent `sync` push (a manager joined the team) carries no text. It is handed to the open page,
  // which delegates the schedule keys; with no page open the next start does it. Nothing is shown. (Safari may revoke a
  // subscription that keeps receiving silent pushes; the sync push is rare: once per client per joining manager.)
  if (d.type === 'sync') {
    event.waitUntil(
      (async () => {
        const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const w of wins) w.postMessage({ type: 'coach-sync' });
      })(),
    );
    return;
  }
  event.waitUntil(
    (async () => {
      const chat = typeof d.tag === 'string' && d.tag.indexOf('coach-chat') === 0;
      const quiet = chat ? inQuiet(await readQuiet(), new Date()) : false;
      await self.registration.showNotification(d.title || 'Spotter', {
        body: d.body || '',
        tag: d.tag || undefined,
        silent: quiet || undefined,
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
