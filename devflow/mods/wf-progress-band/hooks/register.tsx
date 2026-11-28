import { atom, read, update } from 'claude-code';
import type { Register } from 'claude-code';
import type { Block, Snap, TaskSnap } from '../types';

const snap = atom({ plugin: 'wf-progress-band', key: 'snap' } as const, null);

// The band is always English: one fixed vocabulary, never the words the model happens to write.
const VOCAB = {
  done: 'Done',
  doing: 'In progress',
  blocked: 'Blocked',
  skipped: 'Skipped',
  todo: 'To do',
  now: 'Now',
  idle: 'Idle',
  complete: 'All done',
  noTask: 'No task yet',
  noReason: 'No reason recorded',
  noText: 'No description',
  needs: 'Waiting on',
  left: 'left',
  noPace: 'Est. n/a (not enough finished items yet)',
} as const;

const COLOR: Record<string, string> = {
  done: '#3fb97a',
  doing: '#4c8dff',
  blocked: '#e5534b',
  skipped: '#e0a63a',
  todo: '#4a4f5a',
};

// State files, tried in order: the project's own, then the mirror.
const STATE_FILES = ['.claude/state/wf.json', '.devflow/mirror/wf.json'];
const JOURNAL_FILES = ['.claude/state/wf-events.jsonl', '.devflow/mirror/wf-events.jsonl'];
// Pace window: finished items over the last 45 minutes of real journal events.
const PACE_WINDOW_MS = 45 * 60 * 1000;

type Item = { id: string; text?: string; status: string; reason?: string; needs?: string };

// Items per minute from real `done` events; null when fewer than two fall in the window.
function paceOf(journal: string, now: number): number {
  const stamps: number[] = [];
  for (const line of journal.split('\n')) {
    try {
      const ev = JSON.parse(line) as { type?: string; ts?: number };
      if (ev.type === 'done' && typeof ev.ts === 'number' && now - ev.ts <= PACE_WINDOW_MS)
        stamps.push(ev.ts);
    } catch {
      // skip a damaged line
    }
  }
  if (stamps.length < 2) return 0;
  const span = (now - Math.min(...stamps)) / 60000;
  return stamps.length / Math.max(span, 1);
}

function etaOf(items: Item[], pace: number): string | null {
  const open = items.filter(
    (i) => i.status === 'todo' || i.status === 'doing' || i.status === 'blocked',
  ).length;
  if (open === 0) return null;
  if (pace <= 0) return VOCAB.noPace;
  const mins = Math.round(open / pace);
  const text =
    mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${Math.max(1, mins)} min`;
  return `≈ ${text} ${VOCAB.left}`;
}

function summarize(items: Item[], task: string, active: boolean, pace: number): TaskSnap {
  const count = (s: string) => items.filter((i) => i.status === s).length;
  const total = items.length;
  const done = count('done');
  const current = items.find((i) => i.status === 'doing');
  const blocks: Block[] = items.map((i) => ({
    id: i.id,
    text: i.text ?? '',
    status: COLOR[i.status] ? i.status : 'todo',
    why:
      i.status === 'blocked'
        ? `${VOCAB.needs}: ${i.needs ?? '?'}${i.reason ? ` · ${i.reason}` : ''}`
        : (i.reason ?? ''),
  }));
  return {
    active,
    task,
    pct: Math.round((done / Math.max(1, total)) * 100),
    done,
    total,
    doing: count('doing'),
    blocked: count('blocked'),
    skipped: count('skipped'),
    todo: count('todo'),
    current: current ? `${current.id} ${current.text ?? ''}`.trim() : null,
    blocks,
    eta: etaOf(items, pace),
  };
}

const empty = (): Snap => ({ tasks: [], note: VOCAB.noTask });

const SQUARE: Record<string, string> = {
  done: '🟩',
  doing: '🟦',
  blocked: '🟥',
  skipped: '🟨',
  todo: '⬜',
};

// The status line is plain text, so it carries the same blocks as emoji squares.
function statusText(s: Snap): string {
  if (s.tasks.length === 0) return VOCAB.noTask;
  return s.tasks
    .map((t) =>
      t.active
        ? `${t.task} ${t.blocks.map((b) => SQUARE[b.status]).join('')} ${t.pct}% ${t.done}/${t.total}${t.eta ? ` ${t.eta}` : ''}`
        : `${t.task} ${t.pct}%`,
    )
    .join(' │ ');
}

type Wf = {
  task?: { id: string } | null;
  items?: Item[];
  parked?: { task: { id: string }; items?: Item[] }[];
};

function fromWf(wf: Wf, pace: number): Snap {
  const tasks: TaskSnap[] = [];
  if (wf.task) tasks.push(summarize(wf.items ?? [], wf.task.id, true, pace));
  for (const p of wf.parked ?? []) {
    const t = summarize(p.items ?? [], p.task.id, false, pace);
    // A parked task that is finished leaves the band; a parked task with open work stays.
    if (t.pct < 100) tasks.push(t);
  }
  return tasks.length ? { tasks, note: null } : empty();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function draw($: any, e: any) {
  const s = ((await read($, snap)) as Snap | null) ?? empty();
  const { Box, Text } = $.ui.resolve(e);
  const status = (k: string, n: number) =>
    n > 0 ? (
      <Text key={k} color={COLOR[k]}>
        ■ {n} {VOCAB[k as keyof typeof VOCAB]}
      </Text>
    ) : null;
  if (s.tasks.length === 0) {
    return <Text dimColor>{s.note ?? VOCAB.noTask}</Text>;
  }
  return (
    <Box flexDirection="column">
      {s.tasks.map((t) => (
        <Box key={`t-${t.task}`} flexDirection="column">
          <Box gap={2} flexWrap="wrap">
            <Text bold dimColor={!t.active}>
              {t.active ? '▶ ' : '  '}
              {t.task}
            </Text>
            <Text bold color={t.blocked > 0 ? COLOR.blocked : COLOR.done}>
              {t.pct}%
            </Text>
            <Text dimColor>
              {t.done}/{t.total} {VOCAB.done.toLowerCase()}
            </Text>
            {t.eta ? <Text dimColor>{t.eta}</Text> : null}
            {status('doing', t.doing)}
            {status('blocked', t.blocked)}
            {status('skipped', t.skipped)}
          </Box>
          <Box flexWrap="wrap">
            {t.blocks.map((b) => (
              <Box key={`b-${t.task}-${b.id}`}>
                <Text color={COLOR[b.status]}>{b.status === 'todo' ? '▢' : '■'}</Text>
                <Box
                  position="absolute"
                  top={-4}
                  left={0}
                  display="none"
                  hover={{ display: 'flex' }}
                  flexDirection="column"
                  borderStyle="round"
                  paddingX={1}
                >
                  <Text bold color={COLOR[b.status]}>
                    {b.id} · {VOCAB[b.status as keyof typeof VOCAB]}
                  </Text>
                  <Text>{b.text || VOCAB.noText}</Text>
                  {b.status === 'blocked' || b.status === 'skipped' ? (
                    <Text color={COLOR[b.status]}>{b.why || VOCAB.noReason}</Text>
                  ) : null}
                </Box>
              </Box>
            ))}
          </Box>
          {t.active ? (
            <Text dimColor wrap="truncate-end">
              {t.current
                ? `${VOCAB.now}: ${t.current}`
                : t.pct === 100
                  ? VOCAB.complete
                  : VOCAB.idle}
            </Text>
          ) : null}
        </Box>
      ))}
    </Box>
  );
}

export const register: Register = (on) => {
  on('session.start', ($, e, next) => {
    const refresh = async () => {
      for (const file of STATE_FILES) {
        try {
          const wf = JSON.parse(await $.fs.read(file));
          let pace = 0;
          for (const jf of JOURNAL_FILES) {
            try {
              pace = paceOf(await $.fs.read(jf), Date.now());
              break;
            } catch {
              // try the mirror
            }
          }
          const snapshot = fromWf(wf, pace);
          await update($, snap, () => snapshot);
          $.ui.status(statusText(snapshot));
          return;
        } catch {
          // try the next location
        }
      }
      await update($, snap, () => empty());
      $.ui.status(statusText(empty()));
    };
    void refresh();
    $.clock.every(2000, refresh);
    void $.ui.open({ id: 'wf-progress', title: 'Progress' });
    return next(e);
  });

  on('ui.render', { component: 'AbovePrompt' }, ($, e) => draw($, e as never));

  // Fallback for clients that do not draw the band: the same view in a docked pane.
  on('ui.render', { component: 'Pane', requestId: 'wf-progress' }, ($, e) => draw($, e as never));
};
