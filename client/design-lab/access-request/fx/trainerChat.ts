/**
 * In-memory chat adapter (fixtures) behind the `ChatPort`: seeded with the lab's conversations, behaves like the
 * server contract (unread recomputed from the read marker, soft delete hides for the sender only, clear is a
 * per-user marker). Nothing here touches Firebase. The real adapter is `data/firestore/chatPort.ts` (sealed, signed, AAD-bound); this one is for stories, tests and the demo build.
 */
import { FIXTURE_NOW } from '../../../src/coach/data/__fixtures__/fixtures';
import { PAGE_SIZE, type ChatPort, type MessagesMeta } from '../../../src/coach/chat/port';
import type { ChatMessage, ChatThread, MsgBody, Unsubscribe } from '../../../src/coach/chat/types';

const at = (dayOffset: number, h: number, m: number) => Date.UTC(2026, 9, 7 + dayOffset, h, m);

interface Conv {
  cid: string;
  clientId: string;
  messages: ChatMessage[];
  readUpTo: number;
  clearedBefore: number;
  /** ids the SENDER (the trainer) has soft-deleted and may still undo */
  pending: Set<string>;
}

const text = (t: string): MsgBody => ({ kind: 'text', text: t });
let seq = 0;
const m = (
  cid: string,
  from: ChatMessage['from'],
  when: number,
  body: MsgBody,
  id?: string,
): ChatMessage => ({ id: id ?? `${cid}-m${++seq}`, cid, from, at: when, body, state: 'sent' });

const FILLER = [
  'Quick one.',
  'Second set felt heavy.',
  'Left shoulder again.',
  'Skipped the last set.',
  'Slept badly.',
  'Can we talk Friday?',
  'Gym was crowded.',
  'Used the other bench.',
  'Pause was hard.',
  'Elbow is fine.',
  'Will send a video.',
  'Thanks!',
];

function seed(): Conv[] {
  seq = 0;
  const mk = (clientId: string, messages: (cid: string) => ChatMessage[], unread: number): Conv => {
    const cid = `cid-${clientId}`;
    const list = messages(cid);
    // the last `unread` client messages are the unread ones: the read marker sits just before them
    const clientIdx = list.map((x, i) => (x.from === 'client' ? i : -1)).filter((i) => i >= 0);
    const firstUnread = unread > 0 ? clientIdx[clientIdx.length - unread] : undefined;
    const readUpTo =
      firstUnread != null ? list[firstUnread].at - 1 : (list[list.length - 1]?.at ?? 0);
    return { cid, clientId, messages: list, readUpTo, clearedBefore: 0, pending: new Set() };
  };
  const tail = (cid: string, n: number, from = at(0, 8, 41)) =>
    Array.from({ length: n }, (_, i) =>
      m(cid, 'client', from + i * 60_000, text(FILLER[i % FILLER.length])),
    );
  return [
    mk(
      'c1',
      (cid) => [
        m(
          cid,
          'client',
          at(-1, 19, 40),
          text(
            'Iryna, my left shoulder is sore again after the incline dumbbell press. Should I lower the weight?',
          ),
        ),
        m(
          cid,
          'trainer',
          at(-1, 20, 11),
          text(
            'Thanks for telling me. This week I will swap the dumbbell press for a 30 degree incline press. Send me a video of a set and I will check your form.',
          ),
        ),
        m(cid, 'system', at(-1, 20, 12), {
          kind: 'system',
          type: 'program-updated',
          text: 'Program updated: Upper B, overhead press to 30 degree incline press (v6)',
        }),
        m(
          cid,
          'client',
          at(0, 8, 2),
          text('Ok, I will send the video tonight. Can I move legs to Saturday?'),
        ),
        ...tail(cid, 2, at(0, 8, 41)),
        m(cid, 'trainer', at(0, 9, 5), { kind: 'request', reqId: 'share-ask:program:1' }),
      ],
      3,
    ),
    mk(
      'c2',
      (cid) => [
        m(
          cid,
          'trainer',
          at(-1, 18, 10),
          text('Good session on Monday. Same plan on Wednesday, we train at 19:00.'),
        ),
        m(cid, 'client', at(0, 8, 31), text('Thanks! My glutes are still sore.')),
        m(cid, 'client', at(0, 8, 38), text('Is that normal after the new hip thrust sets?')),
        ...tail(cid, 9, at(0, 8, 41)),
        m(cid, 'client', at(0, 8, 52), text('Can we swap Saturday to the morning?')),
      ],
      12,
    ),
    mk(
      'c3',
      (cid) => [
        m(cid, 'trainer', at(-1, 18, 20), text('How did the band work feel on Monday?')),
        m(cid, 'client', at(-1, 19, 2), text('The shoulder feels better today.')),
      ],
      1,
    ),
    mk(
      'c7',
      (cid) => [
        m(cid, 'client', at(-3, 17, 5), text('Is Tuesday still on for 18:30?')),
        m(cid, 'trainer', at(-3, 17, 20), text('Yes, see you there.')),
      ],
      0,
    ),
    mk(
      'c9',
      (cid) => [
        m(cid, 'trainer', at(-5, 9, 0), text('Nice week. Keep the same loads on Monday.')),
        m(cid, 'client', at(-5, 9, 30), text('Will do, thank you.')),
      ],
      0,
    ),
  ];
}

export interface FixturesChatOptions {
  /** the app clock; default: the fixture "now" running on from page load (the demo wiring passes `createDemoClock()`) */
  now?: () => number;
  /** simulated latency of a write */
  delayMs?: number;
  /** return true to make the next send fail (stories, tests) */
  failSend?: () => boolean;
  /** start without the seeded conversations */
  empty?: boolean;
  /** stories: also open an empty conversation with these clients (a thread to show one request card in) */
  withClients?: readonly string[];
  /** extra older messages per conversation id (paging stories, tests) */
  history?: Record<string, number>;
}

export interface FixturesChatPort extends ChatPort {
  /** Test / story helper: a message arrives from the client. */
  receive(cid: string, textValue: string): void;
  /** Test / story helper: raw message list (tombstones included) of a conversation. */
  dump(cid: string): ChatMessage[];
}

const previewOf = (msg: ChatMessage | undefined): string | null => {
  if (!msg || msg.deleted) return null;
  const b = msg.body;
  return b.kind === 'text' || b.kind === 'system' ? (b.text ?? null) : null;
};

export function createFixturesChatPort(opts: FixturesChatOptions = {}): FixturesChatPort {
  const convs = new Map<string, Conv>((opts.empty ? [] : seed()).map((c) => [c.cid, c]));
  for (const clientId of opts.withClients ?? [])
    if (!convs.has(`cid-${clientId}`))
      convs.set(`cid-${clientId}`, {
        cid: `cid-${clientId}`,
        clientId,
        messages: [],
        readUpTo: 0,
        clearedBefore: 0,
        pending: new Set(),
      });
  for (const [cid, n] of Object.entries(opts.history ?? {})) {
    const c = convs.get(cid);
    if (!c) continue;
    const first = c.messages[0]?.at ?? FIXTURE_NOW;
    const older = Array.from({ length: n }, (_, i): ChatMessage => ({
      id: `${cid}-old${i}`,
      cid,
      from: i % 3 === 0 ? 'trainer' : 'client',
      at: first - (n - i) * 3_600_000,
      body: text(`Earlier message ${i + 1}`),
      state: 'sent',
    }));
    c.messages = [...older, ...c.messages];
  }
  // lab: every conversation (also the empty ones the stories open) ends with the ask card
  for (const c of convs.values())
    if (!c.messages.some((x) => x.body.kind === 'request'))
      c.messages.push(m(c.cid, 'trainer', at(0, 9, 5), { kind: 'request', reqId: 'share-ask:program:1' }));
  const t0 = Date.now();
  const now = opts.now ?? (() => FIXTURE_NOW + (Date.now() - t0));
  const threadSubs = new Set<(t: ChatThread[]) => void>();
  const msgSubs = new Map<string, Map<(m: ChatMessage[], meta?: MessagesMeta) => void, number>>();
  const delay = () =>
    opts.delayMs ? new Promise<void>((r) => setTimeout(r, opts.delayMs)) : Promise.resolve();

  const visible = (c: Conv): ChatMessage[] =>
    c.messages.filter((x) => x.at > c.clearedBefore && !c.pending.has(x.id));
  const unreadOf = (c: Conv): number =>
    visible(c).filter((x) => x.from === 'client' && !x.deleted && x.at > c.readUpTo).length;
  const threadOf = (c: Conv): ChatThread => {
    const v = visible(c);
    const last = v[v.length - 1];
    return {
      cid: c.cid,
      clientId: c.clientId,
      active: true,
      lastAt: last?.at ?? null,
      lastFrom: last?.from ?? null,
      preview: previewOf(last),
      unread: unreadOf(c),
      clearedBefore: c.clearedBefore,
    };
  };
  const emitThreads = () => {
    const list = [...convs.values()].map(threadOf);
    threadSubs.forEach((f) => f(list));
  };
  const windowOf = (c: Conv, limit: number) => {
    const all = visible(c);
    return {
      list: all.slice(-limit).map((x) => ({ ...x })),
      meta: { hasMore: all.length > limit },
    };
  };
  const emitMessages = (cid: string) => {
    const c = convs.get(cid);
    if (!c) return;
    msgSubs.get(cid)?.forEach((limit, f) => {
      const w = windowOf(c, limit);
      f(w.list, w.meta);
    });
  };
  const touch = (cid: string) => {
    emitMessages(cid);
    emitThreads();
  };
  const conv = (cid: string): Conv => {
    const c = convs.get(cid);
    if (!c) throw new Error('unknown-conversation');
    return c;
  };

  return {
    now,
    subscribeThreads(_uid, onThreads): Unsubscribe {
      threadSubs.add(onThreads);
      onThreads([...convs.values()].map(threadOf));
      return () => void threadSubs.delete(onThreads);
    },
    subscribeMessages(cid, onMessages, _onError, o): Unsubscribe {
      let set = msgSubs.get(cid);
      if (!set) msgSubs.set(cid, (set = new Map()));
      const limit = o?.limit ?? PAGE_SIZE;
      set.set(onMessages, limit);
      const c = convs.get(cid);
      if (c) {
        const w = windowOf(c, limit);
        onMessages(w.list, w.meta);
      } else onMessages([], { hasMore: false });
      return () => void set.delete(onMessages);
    },
    async send(cid, draft) {
      await delay();
      if (opts.failSend?.()) throw Object.assign(new Error('unavailable'), { code: 'unavailable' });
      const c = conv(cid);
      if (c.messages.some((x) => x.id === draft.id)) return; // idempotent by id
      c.messages.push({
        id: draft.id,
        cid,
        from: 'trainer',
        at: Math.max(draft.at, now()),
        body: draft.body ?? text(draft.text),
        state: 'sent',
      });
      touch(cid);
    },
    async markRead(cid) {
      const c = conv(cid);
      const last = c.messages[c.messages.length - 1];
      const to = Math.max(c.readUpTo, last?.at ?? 0);
      if (to === c.readUpTo) return;
      c.readUpTo = to;
      touch(cid);
    },
    async softDelete(cid, id) {
      const c = conv(cid);
      const x = c.messages.find((y) => y.id === id);
      if (!x || x.from !== 'trainer') throw new Error('forbidden'); // only own messages
      c.pending.add(id);
      touch(cid);
    },
    async undoDelete(cid, id) {
      conv(cid).pending.delete(id);
      touch(cid);
    },
    async commitDelete(cid, id) {
      const c = conv(cid);
      const x = c.messages.find((y) => y.id === id);
      c.pending.delete(id);
      if (x) {
        x.deleted = true;
        x.body = { kind: 'unsupported' }; // `enc` physically gone
      }
      touch(cid);
    },
    async clearChat(cid) {
      const c = conv(cid);
      const previous = c.clearedBefore;
      c.clearedBefore = Math.max(now(), ...c.messages.map((x) => x.at));
      touch(cid);
      return { previous };
    },
    async undoClear(cid, previous) {
      conv(cid).clearedBefore = previous;
      touch(cid);
    },
    receive(cid, value) {
      const c = conv(cid);
      c.messages.push(
        m(cid, 'client', Math.max(now(), (c.messages.at(-1)?.at ?? 0) + 1), text(value)),
      );
      touch(cid);
    },
    dump: (cid) => conv(cid).messages.map((x) => ({ ...x })),
  };
}
