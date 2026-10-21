import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shareEn as sh } from '../../i18n/coachShare.en';
import { setViewport } from '../testViewport';
import { FIXTURE_GYMS, createFixturesShareSource } from './__fixtures__/fixtures';
import { LibraryPeek } from './LibraryPeek';
import type { ShareSourcePort } from './port';
import type { ShareRef, ShareSource, Viewer } from './types';
import { lowerConsent } from './ShareStoryFrame';

const trainerView: Viewer = { side: 'trainer', clientId: 'c1' };
const clientView: Viewer = { side: 'client', clientId: 'c1' };
const EX: ShareRef = { kind: 'exercise', id: 'Barbell_Bench_Press_-_Medium_Grip' };

beforeEach(() => setViewport(1440));
afterEach(cleanup);

function show(
  target: ShareRef | null,
  over: {
    viewer?: Viewer;
    port?: ShareSourcePort;
    onShare?: (r: ShareRef) => void;
    onClose?: () => void;
    open?: boolean;
  } = {},
) {
  const onClose = over.onClose ?? vi.fn();
  render(
    <LibraryPeek
      open={over.open ?? true}
      onClose={onClose}
      target={target}
      viewer={over.viewer ?? trainerView}
      who="Oleh"
      onShare={over.onShare}
      port={over.port ?? createFixturesShareSource({ warm: true })}
    />,
  );
  return { onClose };
}

describe('LibraryPeek: nothing to show', () => {
  it('renders nothing while closed or without a target', () => {
    show(EX, { open: false });
    expect(document.body.textContent).toBe('');
    cleanup();
    show(null);
    expect(document.body.textContent).toBe('');
  });
});

describe('LibraryPeek: an exercise', () => {
  it('the trainer sees where it is in the client program and the client best results', async () => {
    show(EX);
    expect(await screen.findByText(sh.peekInProgram)).toBeTruthy();
    expect(await screen.findByText(sh.peekResults('Oleh'))).toBeTruthy();
  });

  it('the client sees the same exercise from their own side', async () => {
    show(EX, { viewer: clientView });
    expect(await screen.findByText(sh.peekInYourProgram)).toBeTruthy();
    expect((await screen.findAllByText(sh.peekFactBest)).length).toBeGreaterThan(0);
  });

  it('results of a client who does not share sets are locked with the reason, never numbers', async () => {
    show(EX, { port: createFixturesShareSource({ warm: true, patch: lowerConsent('sets') }) });
    expect(await screen.findByText(sh.peekLockedResults('Oleh'))).toBeTruthy();
    expect(screen.getByText(sh.peekLockedResultsWhy)).toBeTruthy();
  });

  it('an exercise not in any assigned program says so', async () => {
    show({ kind: 'exercise', id: 'Zottman_Curl' });
    expect(await screen.findByText(sh.peekNotInProgram)).toBeTruthy();
  });

  it('a trainer sees "no results yet" when the client has none for it', async () => {
    show({ kind: 'exercise', id: 'Zottman_Curl' });
    expect(await screen.findByText(sh.peekNoResults)).toBeTruthy();
  });
});

describe('LibraryPeek: other kinds', () => {
  it('equipment: the gyms that have it and the exercises that use it', async () => {
    show({ kind: 'equipment', id: 'barbell-olympic' });
    expect(await screen.findByText(sh.peekWhere)).toBeTruthy();
    expect(screen.getByText(sh.peekUses)).toBeTruthy();
    const gyms = FIXTURE_GYMS.filter((g) => g.equipmentIds.includes('barbell-olympic'));
    expect(gyms.length).toBeGreaterThan(0);
    for (const g of gyms) expect(screen.getByText(g.name)).toBeTruthy();
    for (const g of FIXTURE_GYMS.filter((x) => !x.equipmentIds.includes('barbell-olympic')))
      expect(screen.queryByText(g.name)).toBeNull();
  });

  it('equipment found in no gym says zero gyms', async () => {
    show({ kind: 'equipment', id: 'no-such-machine' });
    await waitFor(() =>
      expect(
        screen.queryByText(sh.peekGymsCount(0)) ||
          screen.queryByText(sh.peekGone(sh.kindLower.equipment)),
      ).toBeTruthy(),
    );
  });

  it('a gym lists its machines', async () => {
    show({ kind: 'gym', id: 'iron-yard' });
    expect((await screen.findAllByText(sh.peekFactMachines)).length).toBeGreaterThan(0);
  });

  it('a muscle: the weekly-sets verdict and the exercises for it', async () => {
    show({ kind: 'muscle', id: 'chest', ownerId: 'c1' });
    expect(await screen.findByText(sh.peekForMuscle)).toBeTruthy();
    const verdicts = Object.values(sh.peekVerdict);
    expect(verdicts.some((t) => screen.queryByText(t))).toBe(true);
  });

  it('a muscle of a client who hides sets is limited with the reason', async () => {
    show(
      { kind: 'muscle', id: 'chest', ownerId: 'c1' },
      { port: createFixturesShareSource({ warm: true, patch: lowerConsent('sets') }) },
    );
    expect((await screen.findAllByText(sh.peekLockedSets('Oleh'))).length).toBeGreaterThan(0);
  });
});

describe('LibraryPeek: states of the data', () => {
  it('an item that no longer exists is "gone" with a Done button', async () => {
    const { onClose } = show({ kind: 'exercise', id: 'deleted-exercise' });
    expect(await screen.findByText(sh.peekGone(sh.kindLower.exercise))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: sh.peekDone }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a loading skeleton, then retries after a failure', async () => {
    let fail = true;
    const port = createFixturesShareSource({ failWith: () => fail });
    show(EX, { port });
    expect(await screen.findByText(sh.pickFailed)).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: sh.pickRetry }));
    await waitFor(() => expect(screen.queryByText(sh.pickFailed)).toBeNull());
    expect(await screen.findByText(sh.peekInProgram)).toBeTruthy();
  });
});

describe('LibraryPeek: sharing', () => {
  it('offers Share in chat where the peek was opened from the picker, and passes the typed ref only', async () => {
    const onShare = vi.fn();
    show(EX, { onShare });
    fireEvent.click(await screen.findByRole('button', { name: sh.peekShare }));
    expect(onShare).toHaveBeenCalledWith(EX);
  });

  it('has no Share button when opened from a card (no onShare)', async () => {
    show(EX);
    await screen.findByText(sh.peekInProgram);
    expect(screen.queryByRole('button', { name: sh.peekShare })).toBeNull();
  });

  it('no Share for something the viewer is not allowed to see (locked)', async () => {
    const onShare = vi.fn();
    const locked: ShareSourcePort = createFixturesShareSource({
      warm: true,
      patch: (s: ShareSource) => ({ ...lowerConsent('sets')(s) }),
    });
    show(
      { kind: 'results', id: 'Barbell_Bench_Press_-_Medium_Grip', ownerId: 'c1' },
      { onShare, port: locked },
    );
    await waitFor(() => expect(document.body.textContent).toContain(sh.peekDone));
    expect(screen.queryByRole('button', { name: sh.peekShare })).toBeNull();
  });
});
