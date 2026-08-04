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
        display_override: ['standalone', 'minimal-ui'],
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
