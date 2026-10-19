/** `useProgramDraft`: screens share one draft per client and port, the check follows the draft and the client's restrictions. */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { configureProgramData } from './config';
import { useProgramDraft } from './draftStore';
import { createFixturesProgramPort } from './__fixtures__/programPort';
import { fixtureWorldLite } from './__fixtures__/fixtures';

const OPEN = { injury: 'off', restrictions: [] } as const;
const mk = () => createFixturesProgramPort({ world: fixtureWorldLite(), warm: true });
afterEach(() => configureProgramData());

describe('useProgramDraft', () => {
  it('without a port argument it reads the configured program port', async () => {
    configureProgramData({ port: mk() });
    const { result } = renderHook(() => useProgramDraft('c1', OPEN));
    await waitFor(() => expect(result.current.bundle?.clientId).toBe('c1'));
  });

  it('two clients on one port keep separate drafts; two screens on one client share one', async () => {
    const port = mk();
    const a1 = renderHook(() => useProgramDraft('c1', OPEN, port));
    const a2 = renderHook(() => useProgramDraft('c1', OPEN, port));
    const b = renderHook(() => useProgramDraft('c2', OPEN, port));
    await waitFor(() => expect(b.result.current.bundle?.clientId).toBe('c2'));
    act(() => a1.result.current.edit((d) => ({ ...d, name: 'Only c1' })));
    expect(a2.result.current.draft!.name).toBe('Only c1');
    expect(b.result.current.draft!.name).not.toBe('Only c1');
    expect(a2.result.current.dirty).toBe(true);
    expect(b.result.current.dirty).toBe(false);
  });

  it('undoLast steps back a labelled edit', async () => {
    const port = mk();
    const { result } = renderHook(() => useProgramDraft('c1', OPEN, port));
    await waitFor(() => expect(result.current.draft).not.toBeNull());
    const before = result.current.draft!.name;
    act(() => result.current.edit((d) => ({ ...d, name: 'Renamed' }), 'rename'));
    expect(result.current.undo.map((u) => u.label)).toEqual(['rename']);
    act(() => result.current.undoLast());
    expect(result.current.draft!.name).toBe(before);
  });

  it('restrictions are checked only when the client shared injuries: the same draft has a restriction finding at "effects" and none at "off"', async () => {
    const port = mk();
    const restriction = { restrictions: ['no overhead movement'] };
    const hidden = renderHook(() => useProgramDraft('c1', { injury: 'off', ...restriction }, port));
    await waitFor(() => expect(hidden.result.current.check).not.toBeNull());
    expect(hidden.result.current.check!.findings.some((f) => f.kind === 'restriction')).toBe(false);
    const shared = renderHook(() =>
      useProgramDraft('c1', { injury: 'effects', ...restriction }, port),
    );
    await waitFor(() => expect(shared.result.current.check).not.toBeNull());
    expect(
      shared.result.current.check!.findings.some(
        (f) => f.kind === 'restriction' && f.sev === 'fix',
      ),
    ).toBe(true);
  });

  it('the last screen to leave stops the store, and coming back starts again from the cache without a blank', async () => {
    const port = mk();
    const first = renderHook(() => useProgramDraft('c1', OPEN, port));
    await waitFor(() => expect(first.result.current.bundle).not.toBeNull());
    first.unmount();
    const again = renderHook(() => useProgramDraft('c1', OPEN, port));
    expect(again.result.current.bundle).not.toBeNull();
    expect(again.result.current.loading).toBe(false);
  });

  it('a load in flight is aborted only when the LAST screen of that client leaves', async () => {
    const base = mk();
    const signals: AbortSignal[] = [];
    const port = {
      ...base,
      load: (c: string, o: { signal: AbortSignal }) => {
        signals.push(o.signal);
        return base.load(c, o);
      },
    } as typeof base;
    const a = renderHook(() => useProgramDraft('c1', OPEN, port));
    const b = renderHook(() => useProgramDraft('c1', OPEN, port));
    const live = () => signals[signals.length - 1];
    a.unmount();
    expect(live().aborted).toBe(false);
    b.unmount();
    expect(live().aborted).toBe(true);
  });
});
