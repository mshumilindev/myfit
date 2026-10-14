/** In-memory adapter behind `ClientChatPort` (fixtures): the lab's conversation of Oleh with Iryna, from his side. */
import { FIXTURE_NOW } from '../../../data/__fixtures__/fixtures';
import type { ChatMessage, MsgBody } from '../../../chat/types';
import type { ClientChatPort, ClientThreadData } from '../chatPort';

const at = (dayOffset: number, h: number, m: number) => Date.UTC(2026, 9, 7 + dayOffset, h, m);
const text = (t: string): MsgBody => ({ kind: 'text', text: t });

export const CLIENT_CID = 'cid-c1';

export function seedClientThread(): { messages: ChatMessage[]; readUpTo: number } {
  const m = (id: string, from: ChatMessage['from'], when: number, body: MsgBody): ChatMessage => ({
    id,
    cid: CLIENT_CID,
    from,
    at: when,
    body,
    state: 'sent',
  });
  const messages = [
    m(
      'k1',
      'client',
      at(-1, 19, 40),
      text(
        'Iryna, my left shoulder is sore again after the incline dumbbell press. Should I lower the weight?',
      ),
    ),
    m(
      'k2',
      'trainer',
      at(-1, 20, 11),
      text(
        'Thanks for telling me. This week I will swap the dumbbell press for a 30 degree incline press. Send me a video of a set and I will check your form.',
      ),
    ),
    m('k3', 'system', at(-1, 20, 12), {
      kind: 'system',
      type: 'program-updated',
      text: 'Program updated (v5)',
    }),
    m(
      'k4',
      'client',
      at(0, 8, 2),
      text('Ok, I will send the video tonight. Can I move Friday to Saturday morning?'),
    ),
    m('k5', 'trainer', at(0, 8, 20), { kind: 'request', reqId: 'rq1' }),
    m('k6', 'trainer', at(0, 8, 41), text('How does your left shoulder feel today?')),
    m('k7', 'trainer', at(0, 8, 42), text('Also: bring a towel on Friday, the gym is warm.')),
    m('k8', 'trainer', at(0, 8, 44), text('And tell me how the new squat target feels.')),
  ];
  const firstUnread = messages.find((x) => x.id === 'k6')!;
  return { messages, readUpTo: firstUnread.at - 1 };
}

export function createFixturesClientChatPort(
  opts: { unread?: number; delayMs?: number; now?: () => number } = {},
): ClientChatPort {
  const now = opts.now ?? (() => FIXTURE_NOW);
  const seed = seedClientThread();
  let messages = seed.messages;
  let readUpTo = opts.unread === 0 ? Number.MAX_SAFE_INTEGER : seed.readUpTo;
  let clearedBefore = 0;
  const pending = new Set<string>();
  const subs = new Set<() => void>();
  const unreadOf = () =>
    messages.filter((x) => x.from === 'trainer' && x.at > readUpTo && !x.deleted).length;
  const view = (): ClientThreadData => ({
    messages: messages.filter((x) => x.at > clearedBefore && !pending.has(x.id)),
    unread: unreadOf(),
    clearedBefore,
  });
  const emit = () => subs.forEach((f) => f());
  const wait = async () => {
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
  };
  return {
    now,
    subscribe(_cid, on) {
      const f = () => on(view());
      subs.add(f);
      f();
      return () => void subs.delete(f);
    },
    subscribeUnread(_cid, on) {
      const f = () => on(unreadOf());
      subs.add(f);
      f();
      return () => void subs.delete(f);
    },
    async send(cid, d) {
      await wait();
      if (messages.some((x) => x.id === d.id)) return;
      messages = [
        ...messages,
        { id: d.id, cid, from: 'client', at: d.at, body: d.body ?? text(d.text), state: 'sent' },
      ];
      emit();
    },
    async markRead() {
      readUpTo = Math.max(readUpTo, ...messages.map((x) => x.at));
      emit();
    },
    async softDelete(_cid, id) {
      pending.add(id);
      emit();
    },
    async undoDelete(_cid, id) {
      pending.delete(id);
      emit();
    },
    async commitDelete(_cid, id) {
      pending.delete(id);
      messages = messages.map((x) =>
        x.id === id ? { ...x, deleted: true, body: { kind: 'unsupported' } } : x,
      );
      emit();
    },
    async clearChat() {
      const previous = clearedBefore;
      clearedBefore = now() + 1;
      emit();
      return { previous };
    },
    async undoClear(_cid, previous) {
      clearedBefore = previous;
      emit();
    },
  };
}
