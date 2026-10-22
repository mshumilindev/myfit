import { describe, expect, it, vi } from 'vitest';
import { EXPORT_CATEGORIES } from './exportModel';
import { sources } from './fixtures.testutil';
import { ExportAborted, runExport, type ExportProgress } from './runExport';
import { crc32 } from './zip';
import { readZip, text } from './zipRead.testutil';

const NOW = new Date(2026, 9, 22, 12, 0, 0);
const tick = async () => undefined;

describe('runExport', () => {
  it('writes a ZIP named spotter-export-<date> with README, manifest and the parts', async () => {
    const r = await runExport({
      categories: EXPORT_CATEGORIES,
      sources: sources(),
      now: NOW,
      tick,
    });
    expect(r.filename).toBe('spotter-export-2026-10-22.zip');
    const files = readZip(r.parts);
    const names = files.map((f) => f.name);
    const root = 'spotter-export-2026-10-22/';
    expect(names).toContain(`${root}README.txt`);
    expect(names).toContain(`${root}manifest.json`);
    expect(names).toContain(`${root}training/workouts.json`);
    expect(names).toContain(`${root}training/README.txt`);
    expect(names.every((n) => n.startsWith(root))).toBe(true);
    for (const f of files) expect(f.crc).toBe(crc32(f.data));
    const manifest = JSON.parse(text(files.find((f) => f.name.endsWith('manifest.json'))));
    expect(manifest.encrypted).toBe(false);
    expect(manifest.builtOn).toBe('this device');
    expect(manifest.notRequested).toEqual([]);
    expect(text(files.find((f) => f.name === `${root}README.txt`))).toContain('NOT encrypted');
  });

  it('puts only the requested parts in the file and lists the rest as not requested', async () => {
    const r = await runExport({ categories: ['training'], sources: sources(), now: NOW, tick });
    const names = readZip(r.parts).map((f) => f.name.replace('spotter-export-2026-10-22/', ''));
    expect(names.filter((n) => n.includes('/')).every((n) => n.startsWith('training/'))).toBe(true);
    expect(names.some((n) => n.startsWith('body/') || n.startsWith('account/'))).toBe(false);
    expect(r.manifest.notRequested).toEqual(['account', 'body', 'atlas', 'sharing']);
    const all = readZip(r.parts)
      .map((f) => text(f))
      .join('\n');
    expect(all).not.toContain('Oats'); // nutrition is in "body"
    expect(all).not.toContain('tester'); // account is not requested
    expect(all).not.toContain('hello'); // Atlas chat is not requested
  });

  it('the manifest lists what is unavailable, with the reason', async () => {
    const r = await runExport({
      categories: ['body', 'account'],
      sources: sources({ nutrition: null, consents: null }),
      now: NOW,
      tick,
    });
    const body = r.manifest.categories.find((c) => c.id === 'body')!;
    expect(body.notIncluded.map((m) => m.reason)).toEqual(['not-loaded']);
    const account = r.manifest.categories.find((c) => c.id === 'account')!;
    expect(account.notIncluded.some((m) => m.reason === 'server-only')).toBe(true);
    expect(account.notIncluded.some((m) => m.item === 'Consent history')).toBe(true);
    const readme = text(readZip(r.parts).find((f) => f.name.endsWith('body/README.txt')));
    expect(readme).toContain('Not included here');
  });

  it("says when the data is only this device's copy", async () => {
    const r = await runExport({
      categories: ['training'],
      sources: sources({ storeSynced: false }),
      now: NOW,
      tick,
    });
    expect(r.manifest.deviceCopyOnly).toBe(true);
    expect(
      text(readZip(r.parts).find((f) => f.name === 'spotter-export-2026-10-22/README.txt')),
    ).toContain('may be incomplete');
  });

  it('reports progress per part, then packing, and yields between slices', async () => {
    const seen: ExportProgress[] = [];
    const t = vi.fn(async () => undefined);
    await runExport({
      categories: ['training', 'atlas'],
      sources: sources(),
      now: NOW,
      tick: t,
      onProgress: (p) => seen.push(p),
    });
    expect(seen).toEqual([
      { id: 'training', state: 'working' },
      { id: 'training', state: 'done' },
      { id: 'atlas', state: 'working' },
      { id: 'atlas', state: 'done' },
      { id: null, state: 'packing' },
    ]);
    expect(t).toHaveBeenCalled();
  });

  it('a long history is written in slices and stays valid JSON / CSV', async () => {
    const many = Array.from({ length: 1234 }, (_, i) => ({
      id: `n${i}`,
      date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
      bedtime: 1,
      wake: 2,
      source: 'live' as const,
    }));
    const base = sources();
    const s = sources({ store: { ...base.store!, sleeps: many } });
    const t = vi.fn(async () => undefined);
    const r = await runExport({ categories: ['body'], sources: s, now: NOW, tick: t });
    const f = readZip(r.parts);
    const json = JSON.parse(text(f.find((x) => x.name.endsWith('body/sleep.json'))));
    expect(json).toHaveLength(1234);
    const csv = text(f.find((x) => x.name.endsWith('body/sleep.csv')))
      .trim()
      .split('\r\n');
    expect(csv).toHaveLength(1235);
    expect(t.mock.calls.length).toBeGreaterThan(6);
  });

  it('CSV files start with a UTF-8 byte order mark, JSON and README files do not', async () => {
    const r = await runExport({
      categories: EXPORT_CATEGORIES,
      sources: sources(),
      now: NOW,
      tick,
    });
    const files = readZip(r.parts);
    const csvs = files.filter((f) => f.name.endsWith('.csv'));
    expect(csvs.length).toBeGreaterThan(3);
    for (const f of csvs) expect([...f.data.slice(0, 3)], f.name).toEqual([0xef, 0xbb, 0xbf]);
    for (const f of files.filter((x) => !x.name.endsWith('.csv')))
      expect([...f.data.slice(0, 3)], f.name).not.toEqual([0xef, 0xbb, 0xbf]);
    // the quoted-formula cell of the fixture survives after the mark
    const sets = files.find((f) => f.name.endsWith('training/sets.csv'))!;
    expect(new TextDecoder('utf-8', { ignoreBOM: true }).decode(sets.data)).toMatch(
      /^\uFEFF[^\n]*\r\n/,
    );
    expect(text(sets)).toContain("'=Push");
  });

  it('the README explains the BOM, the apostrophe, hidden-in-app parts and typed free text', async () => {
    const r = await runExport({ categories: ['training'], sources: sources(), now: NOW, tick });
    const readme = text(readZip(r.parts).find((f) => f.name.endsWith('2026-10-22/README.txt')));
    expect(readme).toMatch(/byte order mark/);
    expect(readme).toMatch(/leading apostrophe/);
    expect(readme).toMatch(/hidden in the app because consent is off/);
    expect(readme).toMatch(/health details you typed/);
  });

  it('can be cancelled', async () => {
    const ctl = new AbortController();
    const p = runExport({
      categories: EXPORT_CATEGORIES,
      sources: sources(),
      now: NOW,
      tick,
      signal: ctl.signal,
      onProgress: (x) => {
        if (x.id === 'account' && x.state === 'done') ctl.abort();
      },
    });
    await expect(p).rejects.toBeInstanceOf(ExportAborted);
  });

  // Manual check against real unzip tools: SPOTTER_ZIP_OUT=/tmp/x.zip npx vitest run src/legal/export/runExport.test.ts
  it.runIf(process.env.SPOTTER_ZIP_OUT)('writes the archive for an external unzip', async () => {
    const { writeFileSync } = await import('node:fs');
    const r = await runExport({
      categories: EXPORT_CATEGORIES,
      sources: sources(),
      now: NOW,
      tick,
    });
    writeFileSync(process.env.SPOTTER_ZIP_OUT as string, Buffer.concat(r.parts));
  });
});
