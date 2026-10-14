/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google Places API key (optional). Enables the Google provider + photos. */
  readonly VITE_GOOGLE_PLACES_KEY?: string;
  /** Foursquare Places API key (optional). Enables the Foursquare provider. */
  readonly VITE_FOURSQUARE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Build identifier injected by vite.config.ts (compared with /version.json). */
declare const __BUILD_ID__: string;
