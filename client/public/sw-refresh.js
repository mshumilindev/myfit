/* global self, caches, console, Response */
/**
 * Imported into the generated service worker (workbox `importScripts`).
 *
 * An open page keeps running the bundle it loaded with, and an iOS home-screen
 * app can stay suspended for days — so without this a deploy only showed up
 * after the user killed the app twice. A worker that replaces an older one
 * sends every open window to the new build itself.
 */

const UPDATE_MARK_CACHE = 'spotter-update-mark';
const UPDATE_MARK_KEY = '/__replacing__';

self.addEventListener('install', (event) => {
  // No previous worker means a first install — nothing stale to refresh.
  if (!self.registration.active) return;
  event.waitUntil(
    caches.open(UPDATE_MARK_CACHE).then((cache) => cache.put(UPDATE_MARK_KEY, new Response('1'))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(UPDATE_MARK_CACHE);
      const replacing = await cache.match(UPDATE_MARK_KEY);
      if (!replacing) return;
      await cache.delete(UPDATE_MARK_KEY);
      await self.clients.claim();
      for (const client of await self.clients.matchAll({ type: 'window' })) {
        try {
          await client.navigate(client.url);
        } catch (err) {
          // Safari < 16 and some webviews: the page reloads itself on
          // controllerchange instead (src/pwaUpdate.ts).
          console.warn('sw-refresh: could not navigate client', err);
        }
      }
    })(),
  );
});
