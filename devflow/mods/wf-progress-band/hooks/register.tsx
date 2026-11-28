import { atom, read, update } from 'claude-code';
import type { Register } from 'claude-code';

const line = atom({ plugin: 'wf-progress-band', key: 'line' } as const, null);

// The project whose wf.json is shown; devflow.config.json names the state dir, the default is the Claude convention.
const STATE = '/home/claude/myfit/.claude/state/wf.json';
const SQ: Record<string, string> = { done: '🟩', doing: '🟦', blocked: '🟥', todo: '⬜' };
const ORDER = ['done', 'doing', 'blocked', 'todo'];

type Item = { id: string; text: string; status: string };

function render(items: Item[], task: string): string {
  const total = Math.max(1, items.length);
  const count = (s: string) => items.filter((i) => i.status === s).length;
  const slots = 20;
  const n: Record<string, number> = { done: 0, doing: 0, blocked: 0, todo: 0 };
  for (const s of ORDER) n[s] = count(s) ? Math.max(1, Math.round((count(s) / total) * slots)) : 0;
  const at = (s: string): number => n[s] ?? 0;
  let sum = ORDER.reduce((a, s) => a + at(s), 0);
  while (sum > slots) {
    const big = ORDER.filter((s) => at(s) > 1).sort((a, b) => at(b) - at(a))[0];
    if (!big) break;
    n[big] = at(big) - 1;
    sum--;
  }
  while (sum < slots) {
    const big = ORDER.filter((s) => count(s)).sort((a, b) => count(b) - count(a))[0] ?? 'todo';
    n[big] = at(big) + 1;
    sum++;
  }
  const bar = ORDER.map((s) => (SQ[s] ?? '').repeat(at(s))).join('');
  const done = count('done');
  const doing = items.find((i) => i.status === 'doing');
  const pct = Math.round((done / total) * 100);
  return `${task} ${bar} ${pct}% · ${done}/${items.length}${doing ? ` · ▶ ${doing.id} ${doing.text.slice(0, 40)}` : ''}`;
}

export const register: Register = (on) => {
  on('session.start', ($, e, next) => {
    const refresh = async () => {
      try {
        const wf = JSON.parse(await $.fs.read(STATE));
        await update($, line, () => render(wf.items ?? [], wf.task?.id ?? '?'));
      } catch {
        await update($, line, () => null);
      }
    };
    void refresh();
    $.clock.every(2000, refresh);
    return next(e);
  });

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const text = await read($, line);
    if (text === null) return next(e);
    const { Box, Text } = $.ui.resolve(e);
    return (
      <Box>
        <Text>{text}</Text>
      </Box>
    );
  });
};
