import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '../api';
import { CATALOG as catalog } from './catalog';
import { startCatalogProgram, type StartDeps } from './startProgram';

const entry = catalog.find((e) => e.activities.length > 0) ?? catalog[0]!;

vi.mock('../views/programs/activitiesVault', () => ({
  sealActivitiesInDoc: async (d: Record<string, unknown>) => {
    const { activities, ...rest } = d;
    return activities ? { ...rest, activitiesEnc: { sealed: true } } : rest;
  },
}));

function deps(
  over: Partial<StartDeps> = {},
): StartDeps & { created: Array<Record<string, unknown>> } {
  const created: Array<Record<string, unknown>> = [];
  return {
    uid: () => 'u1',
    now: () => 1000,
    exists: async () => false,
    create: async (_id, data) => void created.push(data),
    activate: async () => undefined,
    ...over,
    created,
  };
}

describe('startCatalogProgram', () => {
  it('creates a draft with origin, sealed activities, then activates', async () => {
    const order: string[] = [];
    const d = deps({
      create: async () => void order.push('create'),
      activate: async () => void order.push('activate'),
    });
    const r = await startCatalogProgram(entry, d);
    expect(r).toEqual({ kind: 'started', id: `tl-u1-${entry.id}` });
    expect(order).toEqual(['create', 'activate']);
  });

  it('writes status draft, origin, and never plaintext activities', async () => {
    const d = deps();
    await startCatalogProgram(entry, d);
    const data = d.created[0]!;
    expect(data.status).toBe('draft');
    expect(data.origin).toEqual({ v: 1, id: entry.id });
    expect(data.activities).toBeUndefined();
    if (entry.activities.length) expect(data.activitiesEnc).toBeDefined();
  });

  it('is idempotent: an existing doc is not rewritten, activation still runs', async () => {
    const d = deps({ exists: async () => true });
    const r = await startCatalogProgram(entry, d);
    expect(d.created).toHaveLength(0);
    expect(r.kind).toBe('started');
  });

  it('reports held when a trainer program holds the slot', async () => {
    const d = deps({
      activate: async () => {
        throw new HttpError(412, 'trainer-program');
      },
    });
    expect(await startCatalogProgram(entry, d)).toEqual({ kind: 'held' });
  });

  it('queues when offline during activation', async () => {
    const d = deps({
      activate: async () => {
        throw new HttpError(503, 'offline');
      },
    });
    expect((await startCatalogProgram(entry, d)).kind).toBe('queued');
  });

  it('fails without a user, on create error and on other activation errors', async () => {
    expect((await startCatalogProgram(entry, deps({ uid: () => null }))).kind).toBe('failed');
    expect(
      (
        await startCatalogProgram(
          entry,
          deps({
            create: async () => {
              throw new Error('x');
            },
          }),
        )
      ).kind,
    ).toBe('failed');
    expect(
      (
        await startCatalogProgram(
          entry,
          deps({
            activate: async () => {
              throw new HttpError(500, 'boom');
            },
          }),
        )
      ).kind,
    ).toBe('failed');
  });
});
