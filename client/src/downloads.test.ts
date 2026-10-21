import { describe, expect, it } from 'vitest';
import { downloadUrl, STORAGE_BUCKET } from './downloads';

describe('downloadUrl', () => {
  it('points at the downloads/ folder of the app bucket, token-free', () => {
    expect(downloadUrl('mac')).toBe(
      `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/downloads%2FSpotter.dmg?alt=media`,
    );
    expect(downloadUrl('win')).toContain('downloads%2FSpotter-Setup.exe');
    expect(downloadUrl('android')).toContain('downloads%2FSpotter.apk');
    for (const k of ['win', 'mac', 'android'] as const)
      expect(downloadUrl(k)).not.toContain('token=');
  });
});
