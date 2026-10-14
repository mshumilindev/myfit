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
      // NEVER wait for the navigations: for a hidden tab or a suspended home-screen app `client.navigate` can stay
      // pending, and a worker that never finishes `activating` blocks every later update on that device.
      void self.clients.matchAll({ type: 'window' }).then((all) => {
        for (const client of all) {
          // a page that is not on screen keeps running until it is opened again; the plate / build check (src/pwaUpdate.ts)
          // offers the reload then, instead of reloading something nobody is looking at
          if (client.visibilityState && client.visibilityState !== 'visible') continue;
          try {
            Promise.resolve(client.navigate(client.url)).catch((err) => {
              console.warn('sw-refresh: could not navigate client', err);
            });
          } catch (err) {
            console.warn('sw-refresh: could not navigate client', err);
          }
        }
      });
    })(),
  );
});
