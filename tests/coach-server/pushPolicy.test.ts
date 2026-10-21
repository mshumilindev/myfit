import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CHAT_PUSH_TAG,
  isQuietNow,
  localMinutes,
  categoryOf,
  parsePushPrefs,
  parseQuietWindow,
  pushTag,
  shouldDeliver,
  type CoachNoticeKind,
} from '../../functions/src/coach/pushPolicy';

const at = (iso: string) => Date.parse(iso);

describe('push tags are one vocabulary on the server, in the client and in the service worker', () => {
  it('a chat message uses the tag prefix quiet hours key on', () => {
    expect(pushTag('message')).toBe(CHAT_PUSH_TAG);
    expect(pushTag('message').startsWith('coach-chat')).toBe(true);
    // the other notices never match it, so quiet hours cannot silence an invitation or a program
    for (const k of ['invite', 'request', 'program', 'team', 'reminder', 'sync'] as const)
      expect(pushTag(k).startsWith(CHAT_PUSH_TAG)).toBe(false);
  });
  it('the client constant and the service worker check say the same word', () => {
    const client = readFileSync('client/src/quietHours.ts', 'utf8');
    expect(client).toContain(`CHAT_PUSH_TAG = '${CHAT_PUSH_TAG}'`);
    const sw = readFileSync('client/public/sw-push.js', 'utf8');
    expect(sw).toContain(`indexOf('${CHAT_PUSH_TAG}') === 0`);
  });
});

describe('quiet hours on the server', () => {
  const night = { on: true, from: 22 * 60, to: 7 * 60 };
  it('reads local time in the device zone', () => {
    expect(localMinutes(at('2026-10-12T21:30:00Z'), 'Europe/Kyiv')).toBe(0 * 60 + 30); // UTC+3 in October
    expect(localMinutes(at('2026-10-12T21:30:00Z'), 'Not/AZone')).toBe(21 * 60 + 30);
    expect(localMinutes(at('2026-10-12T21:30:00Z'), undefined)).toBe(21 * 60 + 30);
  });
  it('a window that wraps midnight holds the push back at night and not at noon', () => {
    expect(isQuietNow(night, 'Europe/Kyiv', at('2026-10-12T21:30:00Z'))).toBe(true); // 00:30 there
    expect(isQuietNow(night, 'Europe/Kyiv', at('2026-10-12T09:00:00Z'))).toBe(false); // 12:00 there
    expect(isQuietNow(night, 'Europe/Kyiv', at('2026-10-12T04:00:00Z'))).toBe(false); // 07:00 = the end, open
  });
  it('off, from === to and a malformed setting', () => {
    expect(isQuietNow({ ...night, on: false }, 'UTC', at('2026-10-12T23:00:00Z'))).toBe(false);
    expect(isQuietNow({ on: true, from: 600, to: 600 }, 'UTC', at('2026-10-12T10:00:00Z'))).toBe(
      false,
    );
    expect(parseQuietWindow({ on: 'yes', from: 1, to: 2 })).toBeNull();
    expect(parseQuietWindow({ on: true, from: 2000, to: 2 })).toBeNull();
    // no stored setting = the app default (on, 22:00-07:00), like the client
    expect(isQuietNow(undefined, 'UTC', at('2026-10-12T23:00:00Z'))).toBe(true);
    expect(isQuietNow(undefined, 'UTC', at('2026-10-12T12:00:00Z'))).toBe(false);
  });
});

describe('categories, switches and what quiet hours hold (SPO-237)', () => {
  const night = { on: true, from: 22 * 60, to: 7 * 60 };
  const inNight = at('2026-10-12T21:30:00Z'); // 00:30 in Kyiv
  const noon = at('2026-10-12T09:00:00Z');
  const dev = (prefs?: unknown) => ({ quiet: night, tz: 'Europe/Kyiv', prefs });

  it('every kind has one category; sync has none', () => {
    const cats: Record<CoachNoticeKind, string | null> = {
      message: 'chat',
      invite: 'requests',
      request: 'requests',
      program: 'requests',
      team: 'team',
      reminder: 'reminders',
      sync: null,
    };
    for (const [k, c] of Object.entries(cats)) expect(categoryOf(k as CoachNoticeKind)).toBe(c);
  });
  it('a missing or malformed prefs object means everything is on; only `false` switches off', () => {
    expect(parsePushPrefs(undefined)).toEqual({ requests: true, reminders: true, team: true });
    expect(parsePushPrefs({ requests: 'no', team: 0 })).toEqual({
      requests: true,
      reminders: true,
      team: true,
    });
    expect(parsePushPrefs({ reminders: false })).toEqual({
      requests: true,
      reminders: false,
      team: true,
    });
  });
  it('quiet hours hold chat and reminders, never requests or team', () => {
    expect(shouldDeliver('message', dev(), inNight)).toBe(false);
    expect(shouldDeliver('reminder', dev(), inNight)).toBe(false);
    expect(shouldDeliver('reminder', dev(), noon)).toBe(true);
    for (const k of ['request', 'invite', 'program', 'team'] as const) {
      expect(shouldDeliver(k, dev(), inNight)).toBe(true);
      expect(shouldDeliver(k, dev(), noon)).toBe(true);
    }
  });
  it('a switched-off category sends no push; the other categories are unaffected', () => {
    expect(shouldDeliver('request', dev({ requests: false }), noon)).toBe(false);
    expect(shouldDeliver('invite', dev({ requests: false }), noon)).toBe(false);
    expect(shouldDeliver('team', dev({ requests: false }), noon)).toBe(true);
    expect(shouldDeliver('team', dev({ team: false }), inNight)).toBe(false);
    expect(shouldDeliver('reminder', dev({ reminders: false }), noon)).toBe(false);
    // chat has no switch here: the chat setting is quiet hours
    expect(shouldDeliver('message', dev({ requests: false, team: false }), noon)).toBe(true);
  });
  it('sync is silent and always delivered, whatever the switches and the hour', () => {
    const all = { requests: false, reminders: false, team: false };
    expect(shouldDeliver('sync', dev(all), inNight)).toBe(true);
  });
  it('no push text carries content: the runtime text is generic', () => {
    // the texts live in the five-locale table (pushText.ts); runtime.ts only picks a key, never builds a sentence
    const table = readFileSync('functions/src/coach/pushText.ts', 'utf8');
    for (const word of ['Reminder', 'Team update', 'New request', 'New message'])
      expect(table).toContain(`'${word}'`);
    const rt = readFileSync('functions/src/coach/runtime.ts', 'utf8');
    expect(rt).toContain('pushTextFor(');
    expect(rt).not.toMatch(/body:\s*[^'\s(]*\bname\b/);
  });
});
