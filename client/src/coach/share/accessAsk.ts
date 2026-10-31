/**
 * "Request access" (SPO-99). The trainer ticks WHAT they need from the whole sharing list (`SHARE_IDS`); the client
 * decides the level per row in one form. The ask is a sealed chat message `{kind:'request', reqId:'access-ask:<n>',
 * cats}`, the answer a sealed `{kind:'request-reply', reqId, result}`. Pure: no React, no store, no network.
 * The codec mirrors the kind into the open `k` / `r` fields so rules and functions can enforce roles and pauses
 * without reading the sealed body.
 */
import type { ChatMessage, MsgBody } from '../chat/types';
import type { Level } from '../domain/types';
import { SHARE_IDS, type ShareId, type ShareLevels } from '../client/shareModel';

export const ACCESS_ASK_PREFIX = 'access-ask:';
/** One ask per conversation per day (the server enforces the same). */
export const ASK_COOLDOWN_MS = 24 * 3600 * 1000;
/** After a "not now" the trainer waits a week (the server enforces the same). */
export const ASK_DECLINED_COOLDOWN_MS = 7 * 24 * 3600 * 1000;
/** An unanswered ask is shown as expired after two weeks. */
export const ASK_EXPIRY_MS = 14 * 24 * 3600 * 1000;

export const ASK_RESULTS = ['allowed', 'partial', 'declined'] as const;
export type AskResult = (typeof ASK_RESULTS)[number];
export const isAskResult = (v: unknown): v is AskResult =>
  typeof v === 'string' && (ASK_RESULTS as readonly string[]).includes(v);

export type AskStatus = 'waiting' | AskResult | 'expired';

export const isShareId = (v: unknown): v is ShareId =>
  typeof v === 'string' && (SHARE_IDS as readonly string[]).includes(v);

/** Distinct, known ids in the order of the sharing page; null when nothing valid was asked. */
export function normalizeCats(cats: readonly unknown[]): ShareId[] | null {
  const want = new Set(cats.filter(isShareId));
  // unknown or repeated ids make the whole ask invalid (never silently trimmed)
  if (want.size === 0 || want.size !== cats.length) return null;
  return SHARE_IDS.filter((id) => want.has(id));
}

export function accessAskBody(cats: readonly ShareId[], n: number): MsgBody {
  const list = normalizeCats(cats);
  if (!list) throw new Error('empty-ask');
  return { kind: 'request', reqId: `${ACCESS_ASK_PREFIX}${n}`, cats: list };
}

export const replyBody = (reqId: string, result: AskResult): MsgBody => ({
  kind: 'request-reply',
  reqId,
  result,
});

export interface AccessAsk {
  reqId: string;
  cats: ShareId[];
}

/** The ask a message carries, or null (a text, a schedule request, a legacy `share-ask:` card). */
export function parseAccessAsk(m: Pick<ChatMessage, 'body' | 'deleted'>): AccessAsk | null {
  if (m.deleted || m.body.kind !== 'request') return null;
  if (!m.body.reqId.startsWith(ACCESS_ASK_PREFIX)) return null;
  const cats = normalizeCats(m.body.cats ?? []);
  return cats ? { reqId: m.body.reqId, cats } : null;
}

/** The client's answer to an ask, if one exists in the thread (the newest wins). */
export function replyTo(messages: readonly ChatMessage[], reqId: string): AskResult | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.deleted || m.from !== 'client' || m.body.kind !== 'request-reply') continue;
    if (m.body.reqId === reqId && isAskResult(m.body.result)) return m.body.result;
  }
  return null;
}

export function askStatus(
  ask: Pick<ChatMessage, 'at' | 'body'>,
  messages: readonly ChatMessage[],
  now: number,
): AskStatus {
  const reqId = ask.body.kind === 'request' ? ask.body.reqId : '';
  const r = replyTo(messages, reqId);
  if (r) return r;
  return now - ask.at >= ASK_EXPIRY_MS ? 'expired' : 'waiting';
}

export interface AskPause {
  blocked: boolean;
  /** ms epoch the trainer may ask again (0 when not blocked) */
  until: number;
  reason: 'recent' | 'declined' | null;
}

/** Whether the trainer may send another ask: 24 h after the last one, 7 days after a "not now". */
export function askPause(messages: readonly ChatMessage[], now: number): AskPause {
  let until = 0;
  let reason: AskPause['reason'] = null;
  for (const m of messages) {
    if (m.deleted) continue;
    const ask = m.from === 'trainer' ? parseAccessAsk(m) : null;
    if (ask && m.at + ASK_COOLDOWN_MS > until) {
      until = m.at + ASK_COOLDOWN_MS;
      reason = 'recent';
    }
    if (m.from === 'client' && m.body.kind === 'request-reply' && m.body.result === 'declined') {
      if (m.at + ASK_DECLINED_COOLDOWN_MS > until) {
        until = m.at + ASK_DECLINED_COOLDOWN_MS;
        reason = 'declined';
      }
    }
  }
  return until > now
    ? { blocked: true, until, reason }
    : { blocked: false, until: 0, reason: null };
}

/** Rows the trainer can still ask for: anything the client does not already share at some level. */
export function requestableIds(shared: Partial<Record<ShareId, Level>>): ShareId[] {
  return SHARE_IDS.filter((id) => (shared[id] ?? 'off') === 'off');
}

/** The result of the client's decision, judged only on the asked rows. */
export function resultOf(
  cats: readonly ShareId[],
  after: Pick<ShareLevels, ShareId> | Partial<Record<ShareId, Level>>,
): AskResult {
  const on = cats.filter((id) => (after[id] ?? 'off') !== 'off').length;
  return on === 0 ? 'declined' : on === cats.length ? 'allowed' : 'partial';
}

/** The levels of the grant rows a trainer sees (`client.consent`), as the map the request sheet needs. */
export function sharedOf(
  consent: Readonly<Record<string, Level>> | undefined,
): Partial<Record<ShareId, Level>> {
  const out: Partial<Record<ShareId, Level>> = {};
  for (const id of SHARE_IDS) if (consent && id in consent) out[id] = consent[id];
  return out;
}
