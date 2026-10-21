import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PUSH_LOCALES,
  PUSH_TEXTS,
  PUSH_TEXT_KEYS,
  defaultTextKey,
  pushLocaleOf,
  pushTextFor,
} from '../../functions/src/coach/pushText';
import {
  pushLink,
  categoryOf,
  pushTag,
  shouldDeliver,
  type CoachNoticeKind,
} from '../../functions/src/coach/pushPolicy';

// SPO-263 (server texts in 5 locales) and SPO-237 (tags per kind, quiet hours, no content in the payload).

const sent: { tokens: string[]; data: Record<string, string> }[] = [];
const devices: Record<string, unknown>[] = [];
vi.mock('../../functions/src/lib', () => ({
  db: {
    collection: () => ({
      doc: () => ({
        collection: () => ({
          get: async () => ({
            empty: devices.length === 0,
            docs: devices.map((d) => ({
              get: (k: string) => d[k],
              ref: { id: String(d.token) },
            })),
          }),
        }),
      }),
    }),
    batch: () => ({ delete: () => undefined, commit: async () => undefined }),
  },
}));
const { sendToUser, pushDeps } = await import('../../functions/src/push');
pushDeps.messaging = (() => ({
  sendEachForMulticast: async (m: { tokens: string[]; data: Record<string, string> }) => {
    sent.push(m);
    return { successCount: m.tokens.length, responses: m.tokens.map(() => ({ success: true })) };
  },
})) as never;

const NOON = Date.UTC(2026, 9, 21, 12, 0);
beforeEach(() => {
  sent.length = 0;
  devices.length = 0;
  vi.useFakeTimers();
  vi.setSystemTime(NOON);
});

describe('push texts in five locales', () => {
  it('every locale has every key, non-empty, in the same set of keys (parity)', () => {
    expect([...PUSH_LOCALES]).toEqual(['en', 'uk', 'pl', 'lt', 'et']);
    for (const l of PUSH_LOCALES) {
      expect(Object.keys(PUSH_TEXTS[l]).sort(), l).toEqual([...PUSH_TEXT_KEYS].sort());
      for (const k of PUSH_TEXT_KEYS)
        expect(PUSH_TEXTS[l][k].trim().length, `${l}.${k}`).toBeGreaterThan(2);
    }
  });
  it('the non-English texts are really translated (differ from English)', () => {
    for (const l of PUSH_LOCALES.filter((x) => x !== 'en'))
      for (const k of PUSH_TEXT_KEYS)
        expect(PUSH_TEXTS[l][k], `${l}.${k}`).not.toBe(PUSH_TEXTS.en[k]);
  });
  it('the texts are generic: no placeholder, digit, name or URL can ride in them', () => {
    for (const l of PUSH_LOCALES)
      for (const k of PUSH_TEXT_KEYS)
        expect(PUSH_TEXTS[l][k], `${l}.${k}`).toMatch(/^[^\d{}<>@/:]+$/u);
    expect(PUSH_TEXTS.en.access).toBe('Access updated');
  });
  it('the device language wins; region and case are ignored; unknown means English', () => {
    expect(pushLocaleOf('uk-UA')).toBe('uk');
    expect(pushLocaleOf('PL')).toBe('pl');
    expect(pushLocaleOf('et_EE')).toBe('et');
    expect(pushLocaleOf('de')).toBe('en');
    expect(pushLocaleOf(undefined)).toBe('en');
    expect(pushTextFor('team', 'lt-LT')).toBe(PUSH_TEXTS.lt.team);
  });
  it('every notice kind has a text', () => {
    const all: CoachNoticeKind[] = ['message', 'invite', 'request', 'program', 'team', 'reminder'];
    expect(all.map(defaultTextKey)).toEqual([
      'message',
      'invite',
      'request',
      'program',
      'team',
      'reminder',
    ]);
  });
});

describe('push tags and categories per role (SPO-237)', () => {
  it('requests, team and reminders carry the three coach tags; each kind has exactly one category', () => {
    expect(pushTag('request')).toBe('coach-request');
    expect(pushTag('team')).toBe('coach-team');
    expect(pushTag('reminder')).toBe('coach-reminder');
    expect(categoryOf('request')).toBe('requests');
    expect(categoryOf('team')).toBe('team');
    expect(categoryOf('reminder')).toBe('reminders');
    expect(categoryOf('sync')).toBeNull();
  });
  it.each(['request', 'team'] as const)(
    '%s is never held by quiet hours (a request with an action must arrive)',
    (k) => {
      const quiet = { on: true, from: 0, to: 23 * 60 };
      expect(shouldDeliver(k, { quiet, tz: 'UTC' }, NOON)).toBe(true);
    },
  );
  it('a reminder is held inside the quiet window and a message too; the silent sync is not', () => {
    const quiet = { on: true, from: 0, to: 23 * 60 };
    expect(shouldDeliver('reminder', { quiet, tz: 'UTC' }, NOON)).toBe(false);
    expect(shouldDeliver('message', { quiet, tz: 'UTC' }, NOON)).toBe(false);
    expect(shouldDeliver('sync', { quiet, tz: 'UTC' }, NOON)).toBe(true);
  });
  it('a switched-off category sends nothing, the other two still do', () => {
    const prefs = { requests: false };
    expect(shouldDeliver('request', { prefs }, NOON)).toBe(false);
    expect(shouldDeliver('team', { prefs }, NOON)).toBe(true);
    expect(shouldDeliver('reminder', { prefs, quiet: { on: false, from: 0, to: 0 } }, NOON)).toBe(
      true,
    );
  });
});

describe('sendToUser: language per device, payload without content', () => {
  const dev = (token: string, extra: Record<string, unknown> = {}) =>
    devices.push({
      token,
      locale: 'en',
      tz: 'UTC',
      quiet: { on: false, from: 0, to: 0 },
      ...extra,
    });

  it('one multicast per language, each with its own text, the tag and a link only', async () => {
    dev('a', { locale: 'uk-UA' });
    dev('b', { locale: 'pl' });
    dev('c', { locale: 'pl' });
    dev('d', { locale: undefined });
    const n = await sendToUser('u1', {
      title: 'Spotter',
      body: 'New request',
      text: 'request',
      tag: 'coach-request',
      url: '/#/c/spotter',
      kind: 'request',
    });
    expect(n).toBe(4);
    const by = Object.fromEntries(sent.map((m) => [m.tokens.join(','), m.data]));
    expect(by['a'].body).toBe(PUSH_TEXTS.uk.request);
    expect(by['b,c'].body).toBe(PUSH_TEXTS.pl.request);
    expect(by['d'].body).toBe(PUSH_TEXTS.en.request);
    for (const m of sent) {
      expect(Object.keys(m.data).sort()).toEqual(['body', 'tag', 'title', 'url']);
      expect(m.data.tag).toBe('coach-request');
      expect(m.data.url).toBe('/#/c/spotter');
    }
  });
  it('an access change says "Access updated" in the device language under the team tag', async () => {
    dev('a', { locale: 'et' });
    await sendToUser('u1', {
      title: 'Spotter',
      body: 'Access updated',
      text: 'access',
      tag: 'coach-team',
      kind: 'team',
    });
    expect(sent[0].data).toMatchObject({ body: PUSH_TEXTS.et.access, tag: 'coach-team' });
  });
  it('quiet hours hold a reminder on that device only; a request still reaches it', async () => {
    dev('quiet', { quiet: { on: true, from: 0, to: 23 * 60 } });
    dev('open');
    await sendToUser('u1', {
      title: 'Spotter',
      body: 'Reminder',
      text: 'reminder',
      tag: 'coach-reminder',
      kind: 'reminder',
    });
    expect(sent.flatMap((m) => m.tokens)).toEqual(['open']);
    sent.length = 0;
    await sendToUser('u1', {
      title: 'Spotter',
      body: 'x',
      text: 'request',
      tag: 'coach-request',
      kind: 'request',
    });
    expect(sent.flatMap((m) => m.tokens).sort()).toEqual(['open', 'quiet']);
  });
  it('a switched-off category sends nothing', async () => {
    dev('a', { prefs: { reminders: false } });
    expect(
      await sendToUser('u1', {
        title: 'Spotter',
        body: 'Reminder',
        text: 'reminder',
        tag: 'coach-reminder',
        kind: 'reminder',
      }),
    ).toBe(0);
    expect(sent).toHaveLength(0);
  });
  it('the silent sync carries no text at all', async () => {
    dev('a');
    await sendToUser('u1', { title: 'Spotter', body: '', tag: 'coach-sync', kind: 'sync' });
    expect(sent[0].data).toEqual({ type: 'sync', tag: 'coach-sync' });
  });
  it('a message without a text key keeps its own body (outbox, rest alert)', async () => {
    dev('a', { locale: 'uk' });
    await sendToUser('u1', { title: 'Rest', body: 'Rest is over', tag: 'rest-done' });
    expect(sent[0].data.body).toBe('Rest is over');
  });

  it('the link of a push: staff to the coach Spotter, a client to the client Spotter, chat and sync to home', () => {
    expect(pushLink('request', true)).toBe('/#/c/spotter');
    expect(pushLink('request', false)).toBe('/#/trainer/spotter');
    expect(pushLink('team', false)).toBe('/#/trainer/spotter');
    expect(pushLink('message', false)).toBe('/#/');
    expect(pushLink('sync', true)).toBe('/#/');
  });
});
