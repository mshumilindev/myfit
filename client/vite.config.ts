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
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Spotter',
        short_name: 'Spotter',
        description: 'Everything you lift, in one place.',
        lang: 'en',
        start_url: '/',
        display: 'standalone',
        background_color: '#16171a',
        theme_color: '#16171a',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // App shell is precached; API goes network-only (the app has its own
        // offline queue in localStorage, so we must never serve stale API data).
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
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
