import { atom, read, update } from 'claude-code';
import type { Register } from 'claude-code';

const snap = atom({ plugin: 'wf-progress-band', key: 'snap' } as const, null);

// The project whose wf state is shown. devflow.config.json (stateDir) names it for other projects; DEVFLOW_STATE wins.
const STATE = '/home/claude/myfit/.claude/state/wf.json';

const GREEN = '#3fb97a';
const BLUE = '#4c8dff';
const RED = '#e5534b';
const TRACK = '#2b2f38';

type Item = { id: string; text: string; status: string };

function summarize(items: Item[], task: string) {
  const count = (s: string) => items.filter((i) => i.status === s).length;
  const total = items.length;
  const done = count('done');
  const current = items.find((i) => i.status === 'doing');
  return {
    task,
    pct: Math.round((done / Math.max(1, total)) * 100),
    done,
    total,
    doing: count('doing'),
    blocked: count('blocked'),
    todo: count('todo'),
    current: current ? `${current.id} ${current.text}` : null,
  };
}

export const register: Register = (on) => {
  on('session.start', ($, e, next) => {
    const refresh = async () => {
      try {
        const wf = JSON.parse(await $.fs.read(STATE));
        await update($, snap, () => summarize(wf.items ?? [], wf.task?.id ?? '?'));
      } catch {
        await update($, snap, () => null);
      }
    };
    void refresh();
    $.clock.every(2000, refresh);
    return next(e);
  });

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const s = await read($, snap);
    if (s === null) return next(e);
    const { Box, Text } = $.ui.resolve(e);
    const seg = (n: number, color: string, key: string) =>
      n > 0 ? <Box key={key} flexGrow={n} height={1} backgroundColor={color} /> : null;
    return (
      <Box flexDirection="column">
        <Box justifyContent="space-between">
          <Box gap={1} flexShrink={0}>
            <Text bold>{s.task}</Text>
            <Text bold color={s.blocked > 0 ? RED : GREEN}>
              {s.pct}%
            </Text>
            <Text dimColor>
              {s.done}/{s.total}
            </Text>
            {s.blocked > 0 ? <Text color={RED}>■ {s.blocked}</Text> : null}
          </Box>
          <Box flexShrink={1} marginLeft={2}>
            <Text dimColor wrap="truncate-end">
              {s.current ? `▶ ${s.current}` : s.pct === 100 ? 'all done' : 'idle'}
            </Text>
          </Box>
        </Box>
        <Box height={1} gap={0}>
          {seg(s.done, GREEN, 'done')}
          {seg(s.doing, BLUE, 'doing')}
          {seg(s.blocked, RED, 'blocked')}
          {seg(s.todo, TRACK, 'todo')}
        </Box>
      </Box>
    );
  });
};
