/** The refused-areas sync (SPO-408): validation, source unwrapping, the run outcomes, alerts, and the Cloudflare/KV call. */
import { describe, expect, it, vi } from 'vitest';
import {
  MAX_BYTES,
  STALE_DAYS,
  areasFromSource,
  isStale,
  syncOccupied,
  validateAreas,
  type JournalEntry,
  type OccupiedPorts,
  type Stats,
} from '../../functions/src/occupiedSyncCore';
import { configured, kvValueUrl, occupiedPorts } from '../../functions/src/occupiedSync';

vi.mock('../../functions/src/lib', () => ({ db: {} }));

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 30, 12);

const square = (x: number, y: number, s = 1) => [
  [
    [x, y],
    [x + s, y],
    [x + s, y + s],
    [x, y + s],
    [x, y],
  ],
];
const fc = (...polys: number[][][][]) =>
  JSON.stringify({
    type: 'FeatureCollection',
    features: polys.map((coordinates) => ({
      type: 'Feature',
      properties: { name: 'Occupied' },
      geometry: { type: 'Polygon', coordinates },
    })),
  });

const base = fc(square(30, 45), square(33, 46));

describe('validateAreas', () => {
  it('accepts well-formed areas and hashes them', () => {
    const v = validateAreas(base, null);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.stats.polygons).toBe(2);
      expect(v.hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it.each([
    ['empty', '', 'empty'],
    ['not json', '{oops', 'not-json'],
    ['no polygons', JSON.stringify({ type: 'FeatureCollection', features: [] }), 'no-polygons'],
    [
      'open ring',
      JSON.stringify({
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
          ],
        ],
      }),
      'bad-geometry',
    ],
    [
      'out of range',
      JSON.stringify({ type: 'Polygon', coordinates: square(500, 0) }),
      'bad-geometry',
    ],
    ['too large', ' '.repeat(MAX_BYTES + 1), 'too-large'],
  ])('rejects %s', (_n, raw, reason) => {
    expect(validateAreas(raw, null)).toEqual({ ok: false, reason });
  });

  it('rejects a sudden shrink or growth against the last version', () => {
    const prev = (validateAreas(base, null) as { ok: true; stats: Stats }).stats;
    expect(validateAreas(fc(square(30, 45)), prev)).toEqual({ ok: false, reason: 'sudden-change' });
    expect(validateAreas(fc(square(30, 45, 4), square(33, 46, 4)), prev)).toEqual({
      ok: false,
      reason: 'sudden-change',
    });
  });

  it('accepts a small change (an area freed at the edge)', () => {
    const prev = (validateAreas(base, null) as { ok: true; stats: Stats }).stats;
    expect(validateAreas(fc(square(30, 45), square(33, 46, 1.1)), prev).ok).toBe(true);
  });
});

describe('areasFromSource', () => {
  it('unwraps a map object, keeps only areas and filters by name', () => {
    const body = JSON.stringify({
      id: 1,
      map: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name: 'Occupied zone' },
            geometry: { type: 'Polygon', coordinates: square(30, 45) },
          },
          {
            type: 'Feature',
            properties: { name: 'Gains' },
            geometry: { type: 'Polygon', coordinates: square(10, 10) },
          },
          {
            type: 'Feature',
            properties: { name: 'Occupied point' },
            geometry: { type: 'Point', coordinates: [1, 1] },
          },
        ],
      },
    });
    const all = JSON.parse(areasFromSource(body)!) as { features: unknown[] };
    expect(all.features).toHaveLength(2);
    const some = JSON.parse(areasFromSource(body, 'occupied')!) as { features: unknown[] };
    expect(some.features).toHaveLength(1);
  });

  it('wraps a bare geometry and rejects non-json', () => {
    const one = JSON.parse(
      areasFromSource(JSON.stringify({ type: 'Polygon', coordinates: square(0, 0) }))!,
    ) as { features: unknown[] };
    expect(one.features).toHaveLength(1);
    expect(areasFromSource('<html>')).toBeNull();
  });
});

function ports(over: Partial<OccupiedPorts> = {}) {
  const log: JournalEntry[] = [];
  const alerts: string[] = [];
  const published: string[] = [];
  const p: OccupiedPorts = {
    fetchSource: async () => base,
    current: async () => null,
    publish: async (raw) => void published.push(raw),
    record: async (e) => void log.push(e),
    lastOk: async () => NOW - DAY,
    alert: (m) => void alerts.push(m),
    ...over,
  };
  return { p, log, alerts, published };
}

describe('syncOccupied', () => {
  it('publishes a first valid version and journals it', async () => {
    const { p, log, published, alerts } = ports();
    expect((await syncOccupied(p, NOW)).outcome).toBe('accepted');
    expect(published).toHaveLength(1);
    expect(log[0]).toMatchObject({ outcome: 'accepted', at: NOW });
    expect(alerts).toEqual([]);
  });

  it('writes nothing when the hash is unchanged', async () => {
    const first = ports();
    await syncOccupied(first.p, NOW);
    const hash = first.log[0]!.hash!;
    const stats = first.log[0]!.stats!;
    const { p, published, log } = ports({ current: async () => ({ hash, stats }) });
    expect((await syncOccupied(p, NOW)).outcome).toBe('unchanged');
    expect(published).toEqual([]);
    expect(log[0]!.outcome).toBe('unchanged');
  });

  it('keeps the last version and alerts on a rejected answer', async () => {
    const { p, published, alerts, log } = ports({ fetchSource: async () => '<html>' });
    expect(await syncOccupied(p, NOW)).toEqual({ outcome: 'rejected', reason: 'not-json' });
    expect(published).toEqual([]);
    expect(alerts[0]).toContain('rejected');
    expect(log[0]).toMatchObject({ outcome: 'rejected', reason: 'not-json' });
  });

  it('rejects a sudden change without publishing', async () => {
    const stats = (validateAreas(base, null) as { ok: true; stats: Stats }).stats;
    const { p, published, alerts } = ports({
      fetchSource: async () => fc(square(30, 45)),
      current: async () => ({ hash: 'old', stats }),
    });
    expect((await syncOccupied(p, NOW)).reason).toBe('sudden-change');
    expect(published).toEqual([]);
    expect(alerts[0]).toContain('sudden-change');
  });

  it('never throws: an unreachable source or KV is a failed run with an alert and no payload in it', async () => {
    const a = ports({ fetchSource: async () => Promise.reject(new Error('secret-in-message')) });
    expect((await syncOccupied(a.p, NOW)).outcome).toBe('failed');
    expect(a.alerts.join()).not.toContain('secret-in-message');
    const b = ports({ publish: async () => Promise.reject(new Error('kv-500')) });
    expect((await syncOccupied(b.p, NOW)).outcome).toBe('failed');
    expect(b.log).toEqual([]);
  });

  it('raises a stale alert after a failure when nothing was confirmed for days', async () => {
    const { p, alerts } = ports({
      fetchSource: async () => Promise.reject(new Error('x')),
      lastOk: async () => NOW - (STALE_DAYS + 1) * DAY,
    });
    await syncOccupied(p, NOW);
    expect(alerts.some((m) => m.includes('stale'))).toBe(true);
    const fresh = ports({ fetchSource: async () => Promise.reject(new Error('x')) });
    await syncOccupied(fresh.p, NOW);
    expect(fresh.alerts.some((m) => m.includes('stale'))).toBe(false);
  });

  it('treats a never-confirmed state as stale', () => {
    expect(isStale(null, NOW)).toBe(true);
    expect(isStale(NOW - DAY, NOW)).toBe(false);
  });
});

describe('Cloudflare wiring', () => {
  const cfg = {
    sourceUrl: 'https://src.test/a',
    namePattern: '',
    accountId: 'acc',
    namespaceId: 'ns',
    token: 't0k',
  };

  it('is off until every setting is present', () => {
    expect(configured(cfg)).toBe(true);
    for (const k of ['sourceUrl', 'accountId', 'namespaceId', 'token'] as const) {
      expect(configured({ ...cfg, [k]: '' })).toBe(false);
    }
  });

  it('PUTs the GeoJSON to the namespace key with the bearer token', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 200 }));
    await occupiedPorts(cfg, f as unknown as typeof fetch).publish(base);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(kvValueUrl('acc', 'ns'));
    expect(url).toMatch(/\/accounts\/acc\/storage\/kv\/namespaces\/ns\/values\/occupied-geojson$/);
    expect(init.method).toBe('PUT');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer t0k');
    expect(init.body).toBe(base);
  });

  it('turns a non-2xx from the source or KV into an error without the body', async () => {
    const f = vi.fn(async () => new Response('denied', { status: 403 }));
    const pp = occupiedPorts(cfg, f as unknown as typeof fetch);
    await expect(pp.publish(base)).rejects.toThrow('kv-403');
    await expect(pp.fetchSource()).rejects.toThrow('source-403');
  });
});
