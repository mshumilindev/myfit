import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/** Identifies this build; the page compares it with /version.json to learn that a newer one is live. */
const BUILD_ID = Date.now().toString(36);

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  build: {
    rollupOptions: {
      output: {
        // Atlas's knowledge base as a main-thread chunk exists only for browsers
        // without module workers — named so the service worker can skip it.
        chunkFileNames: (c) =>
          c.facadeModuleId?.replace(/\\/g, '/').endsWith('/atlas/kb/index.ts')
            ? 'assets/atlas-kb-[hash].js'
            : 'assets/[name]-[hash].js',
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/@phosphor-icons')) {
            return 'vendor-icons';
          }
        },
      },
    },
  },
  plugins: [
    react(),
    {
      name: 'spotter-version-file',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ build: BUILD_ID }),
        });
      },
    },
    {
      // Preload the self-hosted wordmark font (header, first paint) so the script face does not pop in after the
      // fallback. Hashed name, so the tag is written from the built bundle, not by hand in index.html.
      name: 'spotter-preload-wordmark-font',
      transformIndexHtml: {
        order: 'post',
        handler(_html, ctx) {
          const file = Object.keys(ctx.bundle ?? {}).find((f) =>
            /^assets\/kaushan-script-latin-400-normal-.*\.woff2$/.test(f),
          );
          if (!file) return [];
          return [
            {
              tag: 'link',
              attrs: {
                rel: 'preload',
                as: 'font',
                type: 'font/woff2',
                href: `/${file}`,
                crossorigin: '',
              },
              injectTo: 'head',
            },
          ];
        },
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      // The injected registerSW.js only registers; it never reloads a page that
      // is already running an old bundle. src/pwaUpdate.ts does both.
      injectRegister: false,
      includeAssets: [
        'favicon.ico',
        'favicon/**/*',
        'apple-touch-icon.png',
        'apple-touch-icon-precomposed.png',
        'icons/*.png',
        'brand/v2/**/*',
      ],
      manifest: {
        // New id forces OS / browser to treat this as a fresh installable app
        // (home-screen icons were stuck on the legacy blue barbell).
        id: '/v2',
        name: 'Spotter',
        short_name: 'Spotter',
        description: 'Everything you lift, in one place.',
        lang: 'en',
        dir: 'ltr',
        start_url: '/?homescreen=v2',
        scope: '/',
        display: 'standalone',
        // No minimal-ui fallback: a browser that picks it reserves room for a
        // toolbar the window never draws.
        display_override: ['standalone'],
        orientation: 'portrait-primary',
        background_color: '#fbf3e6',
        theme_color: '#16171a',
        categories: ['health', 'fitness', 'lifestyle'],
        icons: [
          {
            src: '/brand/v2/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/brand/v2/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/brand/v2/maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/brand/v2/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Explicit because injectRegister: false turns off the plugin's
        // autoUpdate defaults — without these a new build waits forever.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Atlas's understanding worker (~2.8 MB, the whole knowledge base) must be
        // precached or the chat can't understand anything offline.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Sends already-open pages to the new build (public/sw-refresh.js).
        importScripts: ['/sw-refresh.js', '/sw-push.js'],
        // Not for everyone: the no-worker fallback base, and the pl / lt / et answer
        // dictionaries (only their users fetch them — then kept, see runtimeCaching).
        globIgnores: [
          'sw-refresh.js',
          'sw-push.js',
          'assets/atlas-kb-*.js',
          'assets/atlasDict.*.js',
          // Landing-page fonts: loaded by the lazy landing chunk, cached on first use (runtimeCaching below).
          'assets/{inter-tight,manrope,jetbrains-mono}-*.woff2',
        ],
        // App shell is precached; API goes network-only (the app has its own
        // offline queue in localStorage, so we must never serve stale API data).
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // Only the app SHELL is precached (~5 MB: index.html, the entry chunks, fonts, install icons). The whole build was
        // 22 MB in ~490 requests; installing it on a phone could be cut short (the OS suspends the app), the new worker
        // then never took over and the device sat on an old build for days. Everything else is cached the first time it
        // is used (runtimeCaching below), so a screen opened once works offline afterwards.
        globPatterns: [
          'index.html',
          'manifest.webmanifest',
          'assets/index-*.{js,css}',
          'assets/vendor-*.js',
          'assets/*.woff2',
          'icon-*.png',
          'favicon*',
          'apple-touch-icon.png',
        ],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/assets\/(atlasDict\.|atlas-kb-)/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'atlas-lazy', expiration: { maxEntries: 6 } },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
          // Hashed build files never change under their name: the first copy is the right one forever.
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /^\/assets\/.+\.(js|css|woff2)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'spotter-assets',
              expiration: {
                maxEntries: 400,
                maxAgeSeconds: 60 * 24 * 3600,
                purgeOnQuotaError: true,
              },
            },
          },
          // Pictures keep their names across deploys: show the saved one, refresh it in the background.
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /\.(png|webp|jpe?g|svg|gif|ico)$/.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'spotter-img',
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 30 * 24 * 3600,
                purgeOnQuotaError: true,
              },
            },
          },
        ],
      },
    }),
  ],
  // Pre-bundle at server start, not on first visit: `body-muscles` is only reached through lazy Coach/Programs
  // chunks, and a dependency discovered late re-optimises the cache while open tabs still hold the old hash
  // (the stale `504 Outdated Optimize Dep` that left lazy screens blank).
  optimizeDeps: { include: ['body-muscles'] },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4477',
    },
  },
});
