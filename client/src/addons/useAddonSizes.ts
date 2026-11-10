import { useEffect, useState } from 'react';

export type AddonSizes = Readonly<Record<string, number>>;

let cached: AddonSizes | null | undefined;
let inflight: Promise<AddonSizes | null> | null = null;

/** The sizes written by the last build (`addonSizes.ts`). Absent in dev and offline-before-first-load: then no size is shown. */
function load(): Promise<AddonSizes | null> {
  inflight ??= fetch(`${import.meta.env.BASE_URL}addon-sizes.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? (r.json() as Promise<AddonSizes>) : null))
    .catch(() => null)
    .then((v) => {
      cached = v;
      if (v === null) inflight = null; // not measured yet (dev server still building): ask again next time
      return v;
    });
  return inflight;
}

export function useAddonSizes(): AddonSizes | null {
  const [v, setV] = useState<AddonSizes | null>(cached ?? null);
  useEffect(() => {
    let live = true;
    void load().then((r) => live && setV(r));
    return () => {
      live = false;
    };
  }, []);
  return v;
}

/** "42 KB" / "1.3 MB": what installing it downloads. */
export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
