/**
 * SPO-639 (WF-A): pure core of the `wf` workflow CLI — state reducer, progress and the git-status-like view.
 * No I/O here; scripts/wf.mjs owns files. Events carry ids/categories/time only (no free text, no evidence), so the
 * append-only journal can never hold personal data.
 */

export const KINDS = ['ac', 'step', 'extra'];
export const NEEDS = ['design', 'cpd', 'decision', 'access'];
const EVENT_TYPES = ['start', 'add', 'doing', 'done', 'block', 'unblock', 'heartbeat'];
/** Heartbeats in a row without a new `done` before status asks to change approach (never to stop). */
export const STALL_AFTER = 5;

export function emptyState() {
  return { task: null, items: [], stall: 0 };
}

/** Throws on malformed input; returns the event so callers can chain. */
export function validateEvent(event) {
  if (!event || typeof event !== 'object') throw new Error('event must be an object');
  if (!EVENT_TYPES.includes(event.type)) throw new Error(`unknown event type: ${event.type}`);
  if (typeof event.ts !== 'number') throw new Error('event.ts must be a number');
  if (event.type === 'add' && !KINDS.includes(event.kind))
    throw new Error('add needs a valid kind');
  if (event.type === 'block' && !NEEDS.includes(event.needs))
    throw new Error('block needs a valid category');
  if (['add', 'doing', 'done', 'block', 'unblock'].includes(event.type) && !event.item) {
    throw new Error(`${event.type} needs an item id`);
  }
  if (event.type === 'done' && !String(event.evidence ?? '').trim()) {
    throw new Error('done needs evidence (command, file or link)');
  }
  return event;
}

function findItem(state, id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) throw new Error(`unknown item: ${id}`);
  return item;
}

/** Pure: returns a new state; never mutates the input. */
export function reduce(state, event) {
  validateEvent(event);
  const next = { ...state, items: state.items.map((i) => ({ ...i })) };
  switch (event.type) {
    case 'start':
      return {
        task: { id: event.task, title: event.title ?? '', ts: event.ts },
        items: [],
        stall: 0,
      };
    case 'add':
      if (next.items.some((i) => i.id === event.item))
        throw new Error(`item exists: ${event.item}`);
      next.items.push({ id: event.item, text: event.text ?? '', kind: event.kind, status: 'todo' });
      return next;
    case 'doing':
      findItem(next, event.item).status = 'doing';
      return next;
    case 'done': {
      const item = findItem(next, event.item);
      item.status = 'done';
      item.evidence = event.evidence;
      next.stall = 0;
      return next;
    }
    case 'block': {
      const item = findItem(next, event.item);
      item.status = 'blocked';
      item.needs = event.needs;
      item.reason = event.reason ?? '';
      return next;
    }
    case 'unblock': {
      const item = findItem(next, event.item);
      item.status = 'todo';
      delete item.needs;
      delete item.reason;
      return next;
    }
    case 'heartbeat':
      next.stall = (next.stall ?? 0) + 1;
      return next;
    default:
      return next;
  }
}

export function progress(state) {
  const total = state.items.length;
  const done = state.items.filter((i) => i.status === 'done').length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, pct, left: total === 0 ? 0 : 100 - pct };
}

/** What the journal stores: type, ts, ids and categories only. */
export function toJournalEntry(event) {
  const { type, ts, item, kind, needs, task } = event;
  return Object.fromEntries(
    Object.entries({ type, ts, item, kind, needs, task }).filter(([, v]) => v !== undefined),
  );
}

/** git-status-like view, at most 12 lines. */
export function renderStatus(state) {
  if (!state.task) return 'wf: немає активної задачі (wf start <id>)';
  const { done, total, pct, left } = progress(state);
  const doing = state.items.filter((i) => i.status === 'doing');
  const todo = state.items.filter((i) => i.status === 'todo');
  const blocked = state.items.filter((i) => i.status === 'blocked');
  const withEvidence = state.items.filter((i) => i.status === 'done' && i.evidence).length;
  const line = (label, list) => `${label}${list.map((i) => i.id).join(', ') || '—'}`;
  const out = [
    `${state.task.id} · ${done}/${total} (${pct}%) · лишилось ${left}%`,
    line('в роботі:    ', doing),
    `наступне:    ${todo[0] ? todo[0].id : '—'}`,
    blocked.length
      ? `чекає на мене (${blocked.length}): ${blocked.map((i) => `${i.id}[${i.needs}]`).join(' · ')}`
      : 'чекає на мене: —',
    `доказів: ${withEvidence}/${done} · без прогресу: ${state.stall ?? 0}`,
  ];
  if ((state.stall ?? 0) >= STALL_AFTER) {
    out.push('! довго без прогресу — змінити підхід (spike/рефлексія), не зупинятись');
  }
  return out.slice(0, 12).join('\n');
}
