/**
 * Single source of truth for the installers served from Cloud Storage `downloads/` (storage.rules: public read,
 * no client writes). Links carry no download token: replacing a file in the bucket never breaks the landing, and
 * only this map knows the object names.
 */
export const STORAGE_BUCKET = 'spotter-64c3b.firebasestorage.app';

export type DownloadKind = 'win' | 'mac' | 'android';

const OBJECT: Record<DownloadKind, string> = {
  win: 'Spotter-Setup.exe',
  mac: 'Spotter.dmg',
  android: 'Spotter.apk',
};

export function downloadUrl(kind: DownloadKind): string {
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(`downloads/${OBJECT[kind]}`)}?alt=media`;
}
