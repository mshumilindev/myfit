import { atom, read, update } from 'claude-code';
import type { Register } from 'claude-code';
import type { Block, Snap } from '../types';

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
  noState: 'No wf state found',
  noReason: 'No reason recorded',
  noText: 'No description',
  needs: 'Waiting on',
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

type Item = { id: string; text?: string; status: string; reason?: string; needs?: string };

function summarize(items: Item[], task: string): Snap {
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
    error: null,
  };
}

const failed = (error: string): Snap => ({
  task: '?',
  pct: 0,
  done: 0,
  total: 0,
  doing: 0,
  blocked: 0,
  skipped: 0,
  todo: 0,
  current: null,
  blocks: [],
  error,
});

export const register: Register = (on) => {
  on('session.start', ($, e, next) => {
    const refresh = async () => {
      for (const file of STATE_FILES) {
        try {
          const wf = JSON.parse(await $.fs.read(file));
          await update($, snap, () => summarize(wf.items ?? [], wf.task?.id ?? '?'));
          return;
        } catch {
          // try the next location
        }
      }
      await update($, snap, () => failed(VOCAB.noState));
    };
    void refresh();
    $.clock.every(2000, refresh);
    return next(e);
  });

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const s = (await read($, snap)) as Snap | null;
    if (s === null) return next(e);
    const { Box, Text } = $.ui.resolve(e);
    const status = (k: string, n: number) =>
      n > 0 ? (
        <Text key={k} color={COLOR[k]}>
          ■ {n} {VOCAB[k as keyof typeof VOCAB]}
        </Text>
      ) : null;
    return (
      <Box flexDirection="column">
        <Box gap={2} flexWrap="wrap">
          <Text bold>{s.task}</Text>
          <Text bold color={s.blocked > 0 ? COLOR.blocked : COLOR.done}>
            {s.pct}%
          </Text>
          <Text dimColor>
            {s.done}/{s.total} {VOCAB.done.toLowerCase()}
          </Text>
          {status('doing', s.doing)}
          {status('blocked', s.blocked)}
          {status('skipped', s.skipped)}
          {s.error ? <Text color={COLOR.blocked}>{s.error}</Text> : null}
        </Box>
        <Box flexWrap="wrap">
          {s.blocks.map((b) => (
            <Box key={`b-${b.id}`}>
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
        <Text dimColor wrap="truncate-end">
          {s.current ? `${VOCAB.now}: ${s.current}` : s.pct === 100 ? VOCAB.complete : VOCAB.idle}
        </Text>
      </Box>
    );
  });
};
