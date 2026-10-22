import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConsentRecord } from '../legal/consents';
import { currentVersion } from '../legal/consents';
import {
  effectiveAiState,
  grantFor,
  resetAiOverride,
  setAiOverride,
  settleAiOverride,
  bindAiOverrideUid,
  getAiOverride,
} from './aiConsent';
import { markLocalOff } from '../legal/localOff';
import { COACH_DEFAULT } from './types';

const sdk = vi.hoisted(() => ({
  getAI: vi.fn(),
  getGenerativeModel: vi.fn(),
}));
vi.mock('firebase/ai', () => ({
  getAI: sdk.getAI,
  getGenerativeModel: sdk.getGenerativeModel,
  GoogleAIBackend: class {},
}));
vi.mock('../firebase', () => ({ app: {}, auth: { currentUser: null } }));

import { askAtlas, classifyTopic } from './chat';
import { askPuter, puterReady, puterSignIn } from './puter';

const aiStateOf = (records: ConsentRecord[]) => effectiveAiState(records, {});
let n = 0;
const rec = (
  kind: ConsentRecord['kind'],
  action: ConsentRecord['action'] = 'grant',
  version = currentVersion(kind),
): ConsentRecord => ({ id: `r${++n}`, kind, action, version, at: 1_700_000_000_000 + n });

beforeEach(() => {
  resetAiOverride();
  sdk.getAI.mockReset();
  sdk.getGenerativeModel.mockReset();
});

describe('Atlas AI consent state', () => {
  it('is off by default: no record means off', () => {
    expect(aiStateOf([])).toEqual({ gemini: false, puter: false });
  });

  it('a legacy chatConsent flag without a record is NOT consent', () => {
    // The old boolean is gone from the type; a person who only ever had it has no record, so the chat stays off.
    const legacyCoach = { ...COACH_DEFAULT, chatConsent: true } as unknown;
    expect(legacyCoach).toBeTruthy();
    expect(aiStateOf([]).gemini).toBe(false);
    expect(grantFor(aiStateOf([]), 'gemini')).toBeNull();
  });

  it('a current grant turns it on; a later withdrawal turns it off; a re-enable needs a new grant', () => {
    const g = rec('atlas-ai');
    expect(aiStateOf([g]).gemini).toBe(true);
    const w = rec('atlas-ai', 'withdraw');
    expect(aiStateOf([g, w]).gemini).toBe(false);
    expect(aiStateOf([g, w, rec('atlas-ai')]).gemini).toBe(true);
  });

  it('an older version of the text is not consent', () => {
    expect(aiStateOf([rec('atlas-ai', 'grant', '2026-10-21')]).gemini).toBe(false);
  });

  it('Puter is its own consent and runs only while the AI chat is on', () => {
    expect(aiStateOf([rec('atlas-ai')]).puter).toBe(false);
    expect(aiStateOf([rec('atlas-puter')])).toEqual({ gemini: false, puter: false });
    expect(aiStateOf([rec('atlas-ai'), rec('atlas-puter')])).toEqual({ gemini: true, puter: true });
  });

  it('a withdrawal on this device stops sending at once, before the record arrives', () => {
    const recs = [rec('atlas-ai'), rec('atlas-puter')];
    setAiOverride('gemini', false);
    expect(effectiveAiState(recs, getAiOverride())).toEqual({ gemini: false, puter: false });
    // The server-confirmed withdrawal arrives: the override is dropped, the records now say the same.
    const after = [...recs, rec('atlas-ai', 'withdraw')];
    settleAiOverride(after);
    expect(getAiOverride().gemini).toBeUndefined();
    expect(effectiveAiState(after, getAiOverride()).gemini).toBe(false);
  });

  it('an unconfirmed grant does not outlive a stale snapshot, and a failed withdrawal keeps sending off', () => {
    setAiOverride('gemini', true);
    expect(effectiveAiState([], getAiOverride()).gemini).toBe(true);
    settleAiOverride([rec('atlas-ai')]);
    expect(getAiOverride().gemini).toBeUndefined();
    setAiOverride('gemini', false);
    settleAiOverride([rec('atlas-ai')]);
    expect(effectiveAiState([rec('atlas-ai')], getAiOverride()).gemini).toBe(false);
  });
});

describe('the override belongs to one account', () => {
  it('account B does not inherit what account A just did', () => {
    resetAiOverride();
    bindAiOverrideUid('a');
    setAiOverride('gemini', true);
    expect(getAiOverride().gemini).toBe(true);
    bindAiOverrideUid('b');
    expect(getAiOverride()).toEqual({});
    bindAiOverrideUid(null);
  });
});

describe('a withdrawal not yet recorded survives a reload (persisted local-off)', () => {
  beforeEach(() => {
    localStorage.clear();
    resetAiOverride();
    bindAiOverrideUid(null);
  });
  afterEach(() => bindAiOverrideUid(null));

  it('the cached records still say on, yet this device stays off for that account only', () => {
    markLocalOff('a', 'atlas-ai');
    bindAiOverrideUid('a');
    expect(getAiOverride()).toEqual({ gemini: false, puter: false });
    const st = effectiveAiState([rec('atlas-ai'), rec('atlas-puter')], getAiOverride());
    expect(st).toEqual({ gemini: false, puter: false });
    bindAiOverrideUid('b');
    expect(getAiOverride()).toEqual({});
  });
  it('Puter alone', () => {
    markLocalOff('a', 'atlas-puter');
    bindAiOverrideUid('a');
    expect(getAiOverride()).toEqual({ puter: false });
  });
});

describe('settleAiOverride against a server-confirmed snapshot', () => {
  beforeEach(() => resetAiOverride());

  it('drops a true override when the server says off (withdrawn elsewhere, or a stale version)', () => {
    setAiOverride('gemini', true);
    setAiOverride('puter', true);
    expect(settleAiOverride([rec('atlas-ai', 'grant', '2026-10-21')], true)).toBe(true);
    expect(getAiOverride()).toEqual({});
    setAiOverride('gemini', true);
    settleAiOverride([rec('atlas-ai'), rec('atlas-ai', 'withdraw')], true);
    expect(
      effectiveAiState([rec('atlas-ai'), rec('atlas-ai', 'withdraw')], getAiOverride()).gemini,
    ).toBe(false);
  });

  it('keeps a true override while the snapshot is unconfirmed (cache), until the records catch up', () => {
    setAiOverride('gemini', true);
    expect(settleAiOverride([], false)).toBe(false);
    expect(getAiOverride().gemini).toBe(true);
  });

  it('keeps a false override against a confirmed snapshot that still says on', () => {
    setAiOverride('gemini', false);
    settleAiOverride([rec('atlas-ai')], true);
    expect(getAiOverride().gemini).toBe(false);
  });
});

describe('nothing reaches a provider without consent', () => {
  const ask = {
    question: 'how is my squat',
    history: [],
    temper: 3 as const,
    coach: COACH_DEFAULT,
    locale: 'en' as const,
    factsJson: '{}',
    now: Date.now(),
  };
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
  });
  afterEach(() => fetchSpy.mockRestore());

  it('askAtlas without a grant does not touch Gemini', async () => {
    expect(await askAtlas({ ...ask, grant: null })).toEqual({ ok: false, reason: 'consent' });
    expect(await askAtlas({ ...ask, grant: { engine: 'puter' } })).toEqual({
      ok: false,
      reason: 'consent',
    });
    expect(sdk.getAI).not.toHaveBeenCalled();
    expect(sdk.getGenerativeModel).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('a reply is discarded when the consent is withdrawn while it streams', async () => {
    let allowed = true;
    const seen: string[] = [];
    sdk.getAI.mockReturnValue({});
    sdk.getGenerativeModel.mockReturnValue({
      startChat: () => ({
        sendMessageStream: async () => ({
          stream: (async function* () {
            yield { text: () => 'first ' };
            allowed = false;
            yield { text: () => 'second' };
          })(),
        }),
      }),
    });
    const r = await askAtlas({
      ...ask,
      grant: { engine: 'gemini' },
      onText: (t) => seen.push(t),
      stillAllowed: () => allowed,
    });
    expect(r).toEqual({ ok: false, reason: 'consent' });
    expect(seen).toEqual(['first ']);
  });

  it('classifyTopic without a grant sends nothing', async () => {
    const r = await classifyTopic({
      grant: null,
      question: 'x',
      topics: [{ id: 'a', ask: 'b' }],
      now: Date.now(),
    });
    expect(r).toBeNull();
    expect(sdk.getAI).not.toHaveBeenCalled();
  });

  it('Puter: no script is loaded, no sign-in, no request without its own grant', async () => {
    const before = document.head.querySelectorAll('script').length;
    expect(await puterReady(null)).toBe(false);
    expect(await puterReady({ engine: 'gemini' })).toBe(false);
    expect(await puterSignIn(null)).toBe(false);
    expect(
      await askPuter({
        grant: { engine: 'gemini' },
        system: '',
        history: [],
        question: 'x',
        temper: 3,
      }),
    ).toEqual({ ok: false, reason: 'consent' });
    expect(document.head.querySelectorAll('script').length).toBe(before);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('with the grant Gemini is reached (the gate is the only thing in the way)', async () => {
    sdk.getAI.mockImplementation(() => {
      throw new Error('reached');
    });
    const r = await askAtlas({ ...ask, grant: grantFor({ gemini: true, puter: false }, 'gemini') });
    expect(sdk.getAI).toHaveBeenCalled();
    expect(r.ok).toBe(false);
  });
});
