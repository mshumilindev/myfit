import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
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
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // Sends already-open pages to the new build (public/sw-refresh.js).
        importScripts: ['/sw-refresh.js'],
        globIgnores: ['sw-refresh.js'],
        // App shell is precached; API goes network-only (the app has its own
        // offline queue in localStorage, so we must never serve stale API data).
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4477',
    },
  },
});
