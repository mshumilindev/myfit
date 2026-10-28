/**
 * The pure part of the Atlas chat in the account (SPO-392): what goes over the wire, how two copies merge, the window.
 * One message = one sealed document `users/{uid}/atlasChat/{id}` (open: `id`, `at`, `updatedAt`); the role, text, chips and
 * chart are inside. No Firebase, no React. Only used with the `atlas-history` consent.
 */
import type { ChatMsg } from './chatLog';

/** The chat keeps its last 100 messages; the account keeps the same window. */
export const ATLAS_WINDOW = 100;
/** A longer text is cut, so a document always fits the rules' size cap (`dekEnc` 100000 characters of ciphertext). */
export const MAX_TEXT = 8000;
const MAX_CHIPS = 8;

/** The message as stored: transient fields (`pending`) dropped, text bounded, nothing `undefined`. */
export function toWire(m: ChatMsg): Record<string, unknown> {
  const { pending: _pending, ...rest } = m;
  void _pending;
  const out: Record<string, unknown> = { ...rest, text: String(m.text ?? '').slice(0, MAX_TEXT) };
  if (m.chips) out.chips = m.chips.slice(0, MAX_CHIPS).map((c) => String(c).slice(0, 200));
  return JSON.parse(JSON.stringify(out)) as Record<string, unknown>;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/** A received document to a message, or null when it is not one (never repaired by guessing). */
export function fromWire(raw: unknown): ChatMsg | null {
  if (!isObj(raw)) return null;
  const { id, at, from, text } = raw;
  if (typeof id !== 'string' || !id) return null;
  if (typeof at !== 'number' || !Number.isFinite(at)) return null;
  if (from !== 'me' && from !== 'atlas') return null;
  if (typeof text !== 'string') return null;
  const { enc: _enc, updatedAt: _u, pending: _p, ...rest } = raw;
  void _enc;
  void _u;
  void _p;
  return { ...(rest as unknown as ChatMsg), id, at, from, text };
}

/**
 * The chat to show: the account's messages plus this device's own that the account does not have yet, without anything
 * at or before the clear-history watermark, oldest first, last `ATLAS_WINDOW`. A message both have is the account's
 * (this device sent its edits already). A message still being answered (`pending`) is never in the account.
 */
export function mergeChat(local: ChatMsg[], remote: ChatMsg[], clearedAt: number): ChatMsg[] {
  const byId = new Map<string, ChatMsg>();
  for (const m of local) if (m.pending || m.at > clearedAt) byId.set(m.id, m);
  for (const m of remote) if (m.at > clearedAt) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.at - b.at).slice(-ATLAS_WINDOW);
}

/** Local messages the account does not have yet (to upload after turning the sync on). */
export function missingRemote(local: ChatMsg[], remoteIds: ReadonlySet<string>): ChatMsg[] {
  return local.filter((m) => !m.pending && !remoteIds.has(m.id));
}

/** What the account remembers besides the messages: the clear-history watermark and, after a withdrawal, when. */
export interface AtlasState {
  clearedAt: number;
  /** Set when the consent was withdrawn with "keep for now"; the copy is deleted after `RETENTION_DAYS`. */
  withdrawnAt: number | null;
}
export const EMPTY_STATE: AtlasState = { clearedAt: 0, withdrawnAt: null };
/**
 * How long the copy is kept after a withdrawal that did not ask for deletion, so a slip can be undone. A product
 * proposal, to be checked with the lawyer before launch: a withdrawal stops all use at once; this is only storage.
 */
export const RETENTION_DAYS = 30;

export function stateFromWire(raw: unknown): AtlasState {
  if (!isObj(raw)) return EMPTY_STATE;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
  return { clearedAt: n(raw.clearedAt), withdrawnAt: n(raw.withdrawnAt) || null };
}

/** The kept copy is due for deletion (also when the stamp is in the future by a wrong clock: then it is not). */
export function retentionExpired(withdrawnAt: number, now: number): boolean {
  return now - withdrawnAt >= RETENTION_DAYS * 86_400_000;
}
