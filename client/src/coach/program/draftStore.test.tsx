import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setRowMode } from './ops';
import { createFixturesProgramPort } from './__fixtures__/programPort';
import { fixtureWorldLite } from './__fixtures__/fixtures';
import { useProgramDraft } from './draftStore';

const OPEN = { injury: 'off', restrictions: [] } as const;
const cid = 'c1';
const mk = (
  o: Parameters<typeof createFixturesProgramPort>[0] extends infer T ? Partial<T> : never = {},
) => createFixturesProgramPort({ world: fixtureWorldLite(), ...o });

describe('program draft store', () => {
  it('renders from the cache at once when warm, and from skeletons when cold', async () => {
    const warmPort = mk({ warm: true });
    const warm = renderHook(() => useProgramDraft(cid, OPEN, warmPort));
    expect(warm.result.current.bundle).not.toBeNull();
    await waitFor(() => expect(warm.result.current.bundle).not.toBeNull());
    const coldPort = mk({ delayMs: 30 });
    const cold = renderHook(() => useProgramDraft(cid, OPEN, coldPort));
    expect(cold.result.current.loading).toBe(true);
    expect(cold.result.current.bundle).toBeNull();
    await waitFor(() => expect(cold.result.current.bundle).not.toBeNull());
  });

  it('edits mark the draft dirty and the check follows the draft', async () => {
    const port = mk({ warm: true });
    const { result } = renderHook(() => useProgramDraft(cid, OPEN, port));
    await waitFor(() => expect(result.current.check).not.toBeNull());
    const before = result.current.check!.counts.fix;
    expect(before).toBeGreaterThan(0);
    const row = result.current.draft!.items.find((i) => i.kind === 'strength')!;
    act(() => result.current.edit((d) => setRowMode(d, row.id, true)));
    expect(result.current.dirty).toBe(true);
    expect(result.current.draft!.items.find((i) => i.id === row.id)!.bare).toBe(true);
  });

  it('a stale save is a conflict and nothing is overwritten', async () => {
    const port = mk({ warm: true });
    const { result } = renderHook(() => useProgramDraft(cid, OPEN, port));
    await waitFor(() => expect(result.current.bundle).not.toBeNull());
    const row = result.current.draft!.items.find((i) => i.kind === 'strength')!;
    act(() => result.current.edit((d) => setRowMode(d, row.id, true)));
    port.bumpRev(cid);
    await act(async () => {
      await result.current.saveDraft();
    });
    expect(result.current.save).toMatchObject({ kind: 'error', code: 'conflict' });
    expect(result.current.dirty).toBe(true);
    expect(result.current.draft!.items.find((i) => i.id === row.id)!.bare).toBe(true);
  });

  it('save then send moves the version: the draft becomes live', async () => {
    const port = mk({ warm: true });
    const { result } = renderHook(() => useProgramDraft(cid, OPEN, port));
    await waitFor(() => expect(result.current.bundle).not.toBeNull());
    const live = result.current.bundle!.liveVersion;
    await act(async () => {
      await result.current.saveDraft();
    });
    expect(result.current.save.kind).toBe('saved');
    await act(async () => {
      await result.current.send();
    });
    expect(result.current.save).toMatchObject({ kind: 'sent', version: live + 1 });
    expect(result.current.bundle!.liveVersion).toBe(live + 1);
    expect(result.current.bundle!.draftVersion).toBe(live + 2);
  });

  it('offline keeps the edits and names the error', async () => {
    const port = mk({ warm: true, failNext: 'offline' });
    const { result } = renderHook(() => useProgramDraft(cid, OPEN, port));
    await waitFor(() => expect(result.current.bundle).not.toBeNull());
    act(() => result.current.setTrainerDays(['Mon']));
    await act(async () => {
      await result.current.saveDraft();
    });
    expect(result.current.save).toMatchObject({ kind: 'error', code: 'offline' });
    expect(result.current.trainerDays).toEqual(['Mon']);
  });

  it('two screens read one draft (editor and check never disagree)', async () => {
    const port = mk({ warm: true });
    const a = renderHook(() => useProgramDraft(cid, OPEN, port));
    const b = renderHook(() => useProgramDraft(cid, OPEN, port));
    await waitFor(() => expect(a.result.current.bundle).not.toBeNull());
    const row = a.result.current.draft!.items.find((i) => i.kind === 'strength')!;
    act(() => a.result.current.edit((d) => setRowMode(d, row.id, true)));
    expect(b.result.current.draft!.items.find((i) => i.id === row.id)!.bare).toBe(true);
  });
});
