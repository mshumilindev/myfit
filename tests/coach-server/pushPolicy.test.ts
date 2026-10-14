import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CHAT_PUSH_TAG,
  isQuietNow,
  localMinutes,
  parseQuietWindow,
  pushTag,
} from '../../functions/src/coach/pushPolicy';

const at = (iso: string) => Date.parse(iso);

describe('push tags are one vocabulary on the server, in the client and in the service worker', () => {
  it('a chat message uses the tag prefix quiet hours key on', () => {
    expect(pushTag('message')).toBe(CHAT_PUSH_TAG);
    expect(pushTag('message').startsWith('coach-chat')).toBe(true);
    // the other notices never match it, so quiet hours cannot silence an invitation or a program
    for (const k of ['invite', 'request', 'program'] as const)
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
