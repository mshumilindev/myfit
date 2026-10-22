import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({ grant: vi.fn(), signOut: vi.fn() }));
vi.mock('../api', () => ({
  currentUid: () => 'u1',
  onAuthChange: () => () => undefined,
  signOut: h.signOut,
}));
vi.mock('./consentApi', async () => {
  const real = await vi.importActual<typeof import('./consentApi')>('./consentApi');
  return { ...real, grantConsent: h.grant };
});

import { legalUpdateTexts, LEGAL_UPDATE_LOCALES } from '../i18n/legalUpdate';
import {
  CHANGE_BULLETS,
  LEGAL_CHANGELOG,
  changelogGaps,
  type LegalChangelogEntry,
} from './changelog';
import {
  LEGAL_VERSIONS,
  RELEASED_VERSIONS,
  needsLegalGate,
  type ConsentRecord,
  type LegalCtx,
} from './consents';
import type { ConsentRecordsState } from './consentApi';
import { PolicyUpdateHost } from './PolicyUpdateHost';
import { pendingUpdates } from './policyUpdate';
import { CONSENT_QUEUE_KEY } from './signupConsents';

const OLD = '2026-10-21';
const NEW = '2026-12-01';
const NEWER = '2027-01-15';

function ctxOf(policy: string, log: LegalChangelogEntry[], terms = OLD): LegalCtx {
  return { versions: { ...LEGAL_VERSIONS, policy, terms }, changelog: log };
}
const editorial: LegalChangelogEntry = {
  doc: 'policy',
  version: NEW,
  kind: 'editorial',
  bullets: [],
};
const material: LegalChangelogEntry = {
  doc: 'policy',
  version: NEW,
  kind: 'material',
  bullets: ['recipient', 'retention'],
};

function rec(kind: ConsentRecord['kind'], version = OLD, at = 1): ConsentRecord {
  return { id: `${kind}-${version}`, kind, action: 'grant', version, at };
}
const REQUIRED = [rec('terms'), rec('policy-ack'), rec('age-18')];
const state = (over: Partial<ConsentRecordsState> = {}): ConsentRecordsState => ({
  records: REQUIRED,
  loading: false,
  confirmed: true,
  error: null,
  ...over,
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  h.grant.mockReset();
  h.grant.mockResolvedValue({ id: 'x', at: 2 });
  h.signOut.mockReset();
  vi.spyOn(window, 'open').mockReturnValue({ opener: 1 } as unknown as Window);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('pendingUpdates (pure)', () => {
  it('editorial bump of the policy: only the policy is affected, level editorial', () => {
    const u = pendingUpdates(REQUIRED, ctxOf(NEW, [editorial]));
    expect(u).toEqual([
      { doc: 'policy', kind: 'policy-ack', level: 'editorial', version: NEW, bullets: [] },
    ]);
  });

  it('a version bump re-asks only the affected document', () => {
    const terms: LegalChangelogEntry = { ...material, doc: 'terms', bullets: ['terms'] };
    const u = pendingUpdates(REQUIRED, ctxOf(OLD, [terms], NEW));
    expect(u.map((x) => x.doc)).toEqual(['terms']);
  });

  it('any material step on the way makes the whole move material; bullets are merged without repeats', () => {
    const later: LegalChangelogEntry = {
      doc: 'policy',
      version: NEWER,
      kind: 'editorial',
      bullets: ['recipient', 'transfer'],
    };
    const u = pendingUpdates(REQUIRED, ctxOf(NEWER, [material, later]));
    expect(u[0].level).toBe('material');
    expect(u[0].bullets).toEqual(['recipient', 'retention', 'transfer']);
  });

  it('nothing when current, and nothing for a withdrawn or missing document (the full gate owns those)', () => {
    expect(pendingUpdates(REQUIRED, ctxOf(OLD, []))).toEqual([]);
    const withdrawn = [
      ...REQUIRED,
      { ...rec('policy-ack', OLD, 9), id: 'w', action: 'withdraw' as const },
    ];
    expect(pendingUpdates(withdrawn, ctxOf(NEW, [editorial]))).toEqual([]);
    expect(pendingUpdates([], ctxOf(NEW, [editorial]))).toEqual([]);
  });

  it('a bump the changelog does not explain falls back to the full gate, never to silence', () => {
    const ctx = ctxOf(NEW, []);
    expect(pendingUpdates(REQUIRED, ctx)).toEqual([]);
    expect(needsLegalGate(REQUIRED, ctx)).toBe(true);
    expect(needsLegalGate(REQUIRED, ctxOf(NEW, [editorial]))).toBe(false);
  });
});

describe('changelog guard', () => {
  it('every released version after the first has an entry (bumping LEGAL_VERSIONS without one fails here)', () => {
    expect(changelogGaps(RELEASED_VERSIONS, LEGAL_CHANGELOG)).toEqual([]);
  });

  it('fails for a bump without an entry, a material entry without bullets, and an entry for an unreleased version', () => {
    const released = { terms: [OLD], policy: [OLD, NEW] };
    expect(changelogGaps(released, [])).toEqual([`policy@${NEW}: no changelog entry`]);
    expect(changelogGaps(released, [{ ...material, bullets: [] }])).toEqual([
      `policy@${NEW}: material entry without bullets`,
    ]);
    expect(changelogGaps(released, [editorial, { ...editorial, version: NEWER }])).toEqual([
      `policy@${NEWER}: entry for a version that is not released`,
    ]);
    expect(changelogGaps(released, [editorial])).toEqual([]);
  });

  it('every bullet key has a text in every locale that has its own', () => {
    for (const [loc, s] of Object.entries(LEGAL_UPDATE_LOCALES)) {
      for (const k of CHANGE_BULLETS) {
        expect(s?.bullets[k].title, `${loc}.${k}`).toBeTruthy();
        expect(s?.bullets[k].sub, `${loc}.${k}`).toBeTruthy();
      }
    }
    expect(legalUpdateTexts('lt').bannerRead).toBe(legalUpdateTexts('en').bannerRead);
  });
});

const host = (s: ConsentRecordsState, ctx: LegalCtx, hidden = false) =>
  render(<PolicyUpdateHost uid="u1" state={s} hidden={hidden} ctx={ctx} />);
const BANNER = 'We updated our Privacy Policy';

describe('PolicyUpdateHost', () => {
  it.each([
    ['loading', state({ loading: true, confirmed: false })],
    ['error', state({ error: new Error('x'), confirmed: false })],
    ['cache only (not confirmed by the server)', state({ confirmed: false })],
  ])('shows nothing while the state is unknown: %s', (_n, s) => {
    host(s, ctxOf(NEW, [material]));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.queryByText(BANNER)).toBeNull();
  });

  it('shows nothing on a screen that belongs to something else, or when the full gate is due', () => {
    host(state(), ctxOf(NEW, [material]), true);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    cleanup();
    host(state({ records: [] }), ctxOf(NEW, [material]));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.queryByText(BANNER)).toBeNull();
  });

  it('shows nothing for a document whose grant is already queued (no flash after accepting)', () => {
    localStorage.setItem(
      CONSENT_QUEUE_KEY,
      JSON.stringify([{ uid: 'u1', items: [{ kind: 'policy-ack', version: NEW }] }]),
    );
    host(state(), ctxOf(NEW, [material]));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('editorial: a non-blocking banner; dismiss records the acknowledgement at the new version with the text hash', async () => {
    host(state(), ctxOf(NEW, [editorial]));
    expect(screen.getByText(BANNER)).toBeTruthy();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(h.grant).toHaveBeenCalledTimes(1));
    const arg = h.grant.mock.calls[0][0];
    expect(arg).toMatchObject({ kind: 'policy-ack', version: NEW });
    expect(arg.textHash).toMatch(/^[0-9a-f]{64}$/);
    expect(screen.queryByText(BANNER)).toBeNull();
  });

  it('editorial: "Read it" opens the document and also records the acknowledgement', async () => {
    host(state(), ctxOf(NEW, [editorial]));
    fireEvent.click(screen.getByRole('button', { name: 'Read it' }));
    expect(window.open).toHaveBeenCalledWith(expect.stringContaining('#/privacy'), 'spotter-legal');
    await waitFor(() => expect(h.grant).toHaveBeenCalledTimes(1));
  });

  describe('both documents changed', () => {
    const both = () => ctxOf(NEW, [editorial, { ...editorial, doc: 'terms' }], NEW) as LegalCtx;
    const records = () => [rec('terms'), rec('policy-ack'), rec('age-18')];

    it('"Read it" acknowledges only the document it opened; the other notice stays', async () => {
      host(state({ records: records() }), both());
      fireEvent.click(screen.getByRole('button', { name: 'Read it' }));
      const opened = String(
        (window.open as unknown as { mock: { calls: string[][] } }).mock.calls[0][0],
      );
      const kind = opened.includes('#/terms') ? 'terms' : 'policy-ack';
      await waitFor(() => expect(h.grant).toHaveBeenCalledTimes(1));
      expect(h.grant.mock.calls[0][0]).toMatchObject({ kind });
      // the other document is still to be told about
      expect(screen.getByRole('region')).toBeTruthy();
    });

    it('"Dismiss" without reading acknowledges the editorial change of both', async () => {
      host(state({ records: records() }), both());
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
      await waitFor(() => expect(h.grant).toHaveBeenCalledTimes(2));
      expect(h.grant.mock.calls.map((c) => c[0].kind).sort()).toEqual(['policy-ack', 'terms']);
      expect(window.open).not.toHaveBeenCalled();
    });
  });

  it('material: a blocking sheet with what is new; Continue stays off until the document is opened and the box ticked', async () => {
    host(state(), ctxOf(NEW, [material]));
    expect(screen.getByRole('alertdialog', { name: BANNER })).toBeTruthy();
    expect(screen.getByText('New recipient')).toBeTruthy();
    expect(screen.getByText('Retention')).toBeTruthy();
    // Only the affected document is listed; no 18+ box.
    expect(screen.queryByText('Terms of Use')).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'I am 18 or older.' })).toBeNull();
    const cont = screen.getByRole('button', {
      name: 'I have read it, continue',
    }) as HTMLButtonElement;
    const box = screen.getByRole('checkbox', {
      name: 'I have read the updated Privacy Policy and agree.',
    }) as HTMLInputElement;
    expect(cont.disabled).toBe(true);
    expect(box.disabled).toBe(true);
    fireEvent.click(screen.getByText('Privacy Policy'));
    expect(box.disabled).toBe(false);
    expect(cont.disabled).toBe(true);
    fireEvent.click(box);
    expect(cont.disabled).toBe(false);
    fireEvent.click(cont);
    await waitFor(() => expect(h.grant).toHaveBeenCalledTimes(1));
    const arg = h.grant.mock.calls[0][0];
    expect(arg).toMatchObject({ kind: 'policy-ack', version: NEW });
    expect(arg.textHash).toMatch(/^[0-9a-f]{64}$/);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('material: the only ways out are sign out and delete account', () => {
    host(state(), ctxOf(NEW, [material]));
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Delete my account/ })).toBeTruthy();
    expect(h.grant).not.toHaveBeenCalled();
  });
});
