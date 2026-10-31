import { describe, expect, it } from 'vitest';
import type { ChatMessage, MsgBody } from '../chat/types';
import { SHARE_IDS } from '../client/shareModel';
import {
  ASK_COOLDOWN_MS,
  ASK_DECLINED_COOLDOWN_MS,
  ASK_EXPIRY_MS,
  accessAskBody,
  askPause,
  askStatus,
  isShareId,
  normalizeCats,
  parseAccessAsk,
  replyBody,
  requestableIds,
  resultOf,
} from './accessAsk';

const T0 = Date.UTC(2026, 9, 7, 9, 0);
const msg = (
  from: ChatMessage['from'],
  at: number,
  body: MsgBody,
  deleted?: boolean,
): ChatMessage => ({
  id: `${from}-${at}`,
  cid: 'c',
  from,
  at,
  body,
  state: 'sent',
  ...(deleted ? { deleted } : {}),
});

describe('access ask model', () => {
  it('every setting of the sharing list is requestable', () => {
    expect(SHARE_IDS).toHaveLength(10);
    expect(normalizeCats([...SHARE_IDS])).toEqual([...SHARE_IDS]);
    SHARE_IDS.forEach((id) => expect(isShareId(id)).toBe(true));
  });
  it('normalises order, rejects unknown, empty and duplicate ids', () => {
    expect(normalizeCats(['sleep', 'totals'])).toEqual(['totals', 'sleep']);
    expect(normalizeCats([])).toBeNull();
    expect(normalizeCats(['nope'])).toBeNull();
    expect(normalizeCats(['sleep', 'sleep'])).toBeNull();
    expect(() => accessAskBody([], 1)).toThrow('empty-ask');
  });
  it('builds and parses an ask', () => {
    const b = accessAskBody(['sleep', 'alcohol'], 7);
    expect(b).toEqual({ kind: 'request', reqId: 'access-ask:7', cats: ['sleep', 'alcohol'] });
    expect(parseAccessAsk(msg('trainer', T0, b))).toEqual({
      reqId: 'access-ask:7',
      cats: ['sleep', 'alcohol'],
    });
    expect(parseAccessAsk(msg('trainer', T0, b, true))).toBeNull();
    expect(
      parseAccessAsk(msg('trainer', T0, { kind: 'request', reqId: 'share-ask:program:1' })),
    ).toBeNull();
    expect(parseAccessAsk(msg('trainer', T0, { kind: 'text', text: 'x' }))).toBeNull();
  });
  it('status: waiting, answered, expired', () => {
    const ask = msg('trainer', T0, accessAskBody(['sleep'], 1));
    expect(askStatus(ask, [ask], T0 + 1000)).toBe('waiting');
    expect(askStatus(ask, [ask], T0 + ASK_EXPIRY_MS)).toBe('expired');
    const reply = msg('client', T0 + 5000, replyBody('access-ask:1', 'partial'));
    expect(askStatus(ask, [ask, reply], T0 + ASK_EXPIRY_MS * 2)).toBe('partial');
    const other = msg('client', T0 + 6000, replyBody('access-ask:2', 'allowed'));
    expect(askStatus(ask, [ask, other], T0 + 1000)).toBe('waiting');
    const fake = msg('trainer', T0 + 7000, replyBody('access-ask:1', 'allowed'));
    expect(askStatus(ask, [ask, fake], T0 + 1000)).toBe('waiting');
  });
  it('pause: 24 h after an ask, 7 days after a decline', () => {
    const ask = msg('trainer', T0, accessAskBody(['sleep'], 1));
    expect(askPause([], T0)).toEqual({ blocked: false, until: 0, reason: null });
    expect(askPause([ask], T0 + 3600_000)).toEqual({
      blocked: true,
      until: T0 + ASK_COOLDOWN_MS,
      reason: 'recent',
    });
    expect(askPause([ask], T0 + ASK_COOLDOWN_MS).blocked).toBe(false);
    const no = msg('client', T0 + 600_000, replyBody('access-ask:1', 'declined'));
    const p = askPause([ask, no], T0 + 2 * ASK_COOLDOWN_MS);
    expect(p).toEqual({
      blocked: true,
      until: no.at + ASK_DECLINED_COOLDOWN_MS,
      reason: 'declined',
    });
    expect(askPause([ask, no], no.at + ASK_DECLINED_COOLDOWN_MS).blocked).toBe(false);
    const yes = msg('client', T0 + 600_000, replyBody('access-ask:1', 'allowed'));
    expect(askPause([ask, yes], T0 + 2 * ASK_COOLDOWN_MS).blocked).toBe(false);
  });
  it('requestable: only rows not shared yet', () => {
    expect(requestableIds({})).toHaveLength(10);
    expect(requestableIds({ totals: 'full', sets: 'effects' })).not.toContain('totals');
    expect(requestableIds({ totals: 'off' })).toContain('totals');
  });
  it('result is judged on the asked rows only', () => {
    expect(resultOf(['sleep', 'body'], { sleep: 'effects', body: 'full' })).toBe('allowed');
    expect(resultOf(['sleep', 'body'], { sleep: 'effects', body: 'off' })).toBe('partial');
    expect(resultOf(['sleep', 'body'], { sleep: 'off', totals: 'full' })).toBe('declined');
  });
});
