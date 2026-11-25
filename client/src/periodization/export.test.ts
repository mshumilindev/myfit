/** Typed maxes in the data export (Art. 15 / 20, R66): never silently empty, never silently left out. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../firebase', () => ({ db: {}, auth: { currentUser: null }, app: {} }));
vi.mock('firebase/auth', () => ({ onAuthStateChanged: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  doc: () => ({}),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  onSnapshot: () => () => undefined,
}));

import { addonExportParts } from '../legal/export/addonExport';
import { periodizationHost } from '../periodizationApi';
import '../periodizationRt';
import { seedMaxes, startMaxesSync } from './maxesSync';

await import('./periodizationBoot'); // fills the host, like the lazy chunk does
const loadedExport = periodizationHost.exportFiles;

beforeEach(() => {
  periodizationHost.exportFiles = loadedExport;
  startMaxesSync('u1')(); // clears the store and the loaded flag
});

describe('Advanced training in the data export', () => {
  it('names the maxes as not included while the chunk is not loaded', () => {
    periodizationHost.exportFiles = null;
    const p = addonExportParts();
    expect(p.files).toEqual([]);
    expect(
      p.missing.some((m) => m.item.includes('typed maxes') && m.reason === 'feature-off'),
    ).toBe(true);
  });
  it('before the stored document is read: says it is still loading instead of an empty file', () => {
    const p = addonExportParts();
    expect(p.files).toEqual([]);
    expect(p.missing.some((m) => m.reason === 'not-loaded' && m.item.includes('maxes'))).toBe(true);
  });
  it('once read: maxes.json with every typed max', () => {
    seedMaxes({ updatedAt: 3, maxes: { squat: { name: 'Squat', kg: 150, at: 3 } } });
    const p = addonExportParts();
    expect(p.files.map((f) => f.name)).toEqual(['maxes.json']);
    expect(p.files[0].rows).toBe(1);
    expect(p.missing.some((m) => m.item.includes('maxes'))).toBe(false);
  });
});
