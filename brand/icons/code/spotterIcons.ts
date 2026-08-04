export const spotterIcons = {
  glyph: {
    24: new URL('../mobile-ui/spotter-muscles-24.png', import.meta.url).href,
    32: new URL('../mobile-ui/spotter-muscles-32.png', import.meta.url).href,
    48: new URL('../mobile-ui/spotter-muscles-48.png', import.meta.url).href,
    64: new URL('../mobile-ui/spotter-muscles-64.png', import.meta.url).href,
    96: new URL('../mobile-ui/spotter-muscles-96.png', import.meta.url).href,
    128: new URL('../mobile-ui/spotter-muscles-128.png', import.meta.url).href,
    192: new URL('../mobile-ui/spotter-muscles-192.png', import.meta.url).href,
    256: new URL('../mobile-ui/spotter-muscles-256.png', import.meta.url).href,
    512: new URL('../mobile-ui/spotter-muscles-512.png', import.meta.url).href,
  },
  pwa: {
    192: new URL('../web/spotter-pwa-192.png', import.meta.url).href,
    512: new URL('../web/spotter-pwa-512.png', import.meta.url).href,
  },
  maskable: {
    192: new URL('../web/spotter-maskable-192.png', import.meta.url).href,
    512: new URL('../web/spotter-maskable-512.png', import.meta.url).href,
  },
} as const;
