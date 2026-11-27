/**
 * SPO-639 (WF-A): pure core of the `wf` workflow CLI — state reducer, progress and the git-status-like view.
 * No I/O here; scripts/wf.mjs owns files. Events carry ids/categories/time only (no free text, no evidence), so the
 * append-only journal can never hold personal data.
 */

export const KINDS = ['ac', 'step', 'extra'];
/** Why an item may wait for the owner. No generic "decision": the owner's rule is that Claude decides and goes on. */
export const NEEDS = ['design', 'cpd', 'access', 'legal', 'irreversible'];
const EVENT_TYPES = ['start', 'add', 'doing', 'done', 'block', 'unblock', 'heartbeat'];
/** Heartbeats in a row without a new `done` before status asks to change approach (never to stop). */
/** Ids are identifiers only, so the journal can never hold free text or personal data. */
export const ID_RE = /^[A-Za-z0-9._-]{1,40}$/;
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
  if (
    ['add', 'doing', 'done', 'block', 'unblock'].includes(event.type) &&
    !ID_RE.test(event.item ?? '')
  ) {
    throw new Error(`${event.type} needs an item id (A-Z a-z 0-9 . _ -, up to 40 chars)`);
  }
  if (event.type === 'start' && !ID_RE.test(event.task ?? '')) {
    throw new Error('start needs a task id (A-Z a-z 0-9 . _ -, up to 40 chars)');
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

function assertFrom(item, allowed, type) {
  if (!allowed.includes(item.status)) {
    throw new Error(`invalid transition: ${type} on ${item.id} (${item.status})`);
  }
}

const STATUSES = ['todo', 'doing', 'done', 'blocked'];

/** Shape check for a state loaded from disk (deep: every item must be well formed). */
export function isValidState(state) {
  if (!state || typeof state !== 'object' || !Array.isArray(state.items)) return false;
  if (state.task !== null && !(state.task && ID_RE.test(String(state.task.id)))) return false;
  if (state.stall !== undefined && !(Number.isInteger(state.stall) && state.stall >= 0))
    return false;
  if (new Set(state.items.map((i) => i?.id)).size !== state.items.length) return false;
  return state.items.every(
    (i) =>
      i &&
      typeof i === 'object' &&
      typeof i.id === 'string' &&
      ID_RE.test(i.id) &&
      STATUSES.includes(i.status) &&
      (i.status !== 'blocked' || NEEDS.includes(i.needs)) &&
      (i.verify === undefined || i.verify === true),
  );
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
      next.items.push({
        id: event.item,
        text: event.text ?? '',
        kind: event.kind,
        status: 'todo',
        ...(event.verify ? { verify: true } : {}),
      });
      return next;
    case 'doing': {
      const item = findItem(next, event.item);
      assertFrom(item, ['todo', 'doing', 'blocked'], event.type);
      item.status = 'doing';
      return next;
    }
    case 'done': {
      const item = findItem(next, event.item);
      assertFrom(item, ['todo', 'doing'], event.type);
      if (item.verify && event.verdict !== 'PASS') {
        throw new Error(
          `${item.id} потребує незалежної перевірки з вердиктом PASS (--verdict <файл>)`,
        );
      }
      item.status = 'done';
      item.evidence = event.evidence;
      next.stall = 0;
      return next;
    }
    case 'block': {
      const item = findItem(next, event.item);
      assertFrom(item, ['todo', 'doing', 'blocked'], event.type);
      item.status = 'blocked';
      item.needs = event.needs;
      item.reason = event.reason ?? '';
      return next;
    }
    case 'unblock': {
      const item = findItem(next, event.item);
      assertFrom(item, ['blocked'], event.type);
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
  if (todo.length + doing.length > 0) {
    const next = (doing[0] ?? todo[0]).id;
    out.push(`ДІЯ: роби ${next} зараз; не завершуй хід і не питай дозволу (wf done --evidence)`);
  }
  if ((state.stall ?? 0) >= STALL_AFTER) {
    out.push('! довго без прогресу — змінити підхід (spike/рефлексія), не зупинятись');
  }
  return out.join('\n');
}

/** Markdown for the pinned "Прогрес" Linear comment (SPO-643); the poster is whoever has Linear access. */
export function renderReport(state, nowLabel = '') {
  if (!state.task) return '';
  const { done, total, pct, left } = progress(state);
  const mark = { done: 'x', todo: ' ', doing: ' ', blocked: ' ' };
  const lines = [
    `**Прогрес${nowLabel ? ` ${nowLabel}` : ''} · ${done}/${total} (${pct}%) · лишилось ${left}%**`,
    '',
  ];
  for (const i of state.items) {
    const tag =
      i.status === 'doing'
        ? ' — _в роботі_'
        : i.status === 'blocked'
          ? ` — _чекає на мене: ${i.needs}_`
          : '';
    lines.push(`- [${mark[i.status]}] ${i.id}${i.text ? ` ${i.text}` : ''}${tag}`);
  }
  const waiting = state.items.filter((i) => i.status === 'blocked');
  if (waiting.length > 0) {
    lines.push(
      '',
      `**Чекає на мене (${waiting.length}):** ${waiting.map((i) => `${i.id} [${i.needs}]${i.reason ? ` ${i.reason}` : ''}`).join(' · ')}`,
    );
  }
  return lines.join('\n');
}
