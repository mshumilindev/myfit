/**
 * SPO-639 (WF-C): Stop-hook decision. Pure: given the hook input and the wf state, say whether the turn may end.
 * Blocks only when ALL hold: a task is active, there are open items without a blocker, the state was touched recently
 * (a stale state from another day never traps an unrelated chat), and this is not already a hook-forced continuation
 * (`stop_hook_active`, which prevents endless loops; the external loop re-enters instead).
 */
export const FRESH_MS = 6 * 60 * 60 * 1000;

export function decideStop({ input = {}, state, mtimeMs, now = Date.now() }) {
  if (input.stop_hook_active) return { block: false, reason: 'already continued once' };
  if (!state || !state.task || !Array.isArray(state.items))
    return { block: false, reason: 'no active task' };
  if (typeof mtimeMs === 'number' && now - mtimeMs > FRESH_MS)
    return { block: false, reason: 'stale state' };
  const open = state.items.filter((i) => i.status === 'todo' || i.status === 'doing');
  // A blocker only the tools can lift (`access`) or one with no stated reason is not a real wait for the owner
  // (CLAUDE.md «Без підтверджень»): re-check it, lift it and finish the item before the turn may end.
  const weak = state.items.filter(
    (i) =>
      i.status === 'blocked' &&
      (i.needs === 'access' || (i.needs && !String(i.reason ?? '').trim())),
  );
  if (open.length === 0 && weak.length > 0) {
    return {
      block: true,
      reason: `wf: пункт ${weak[0].id} заблокований без вагомої причини (needs=${weak[0].needs}). Перевір, чи блокер ще актуальний: якщо його можна зняти інструментами, зроби wf unblock ${weak[0].id} і виконай пункт до доказу; справжній блокер (незворотне, юридичне, недоступний доступ) познач з --reason.`,
    };
  }
  if (open.length === 0) return { block: false, reason: 'nothing open' };
  const next = open.find((i) => i.status === 'doing') ?? open[0];
  return {
    block: true,
    reason: `wf: задача ${state.task.id} має ${open.length} відкритих пунктів без блокера. Далі: ${next.id}. Не завершуй хід: виконай пункт до доказу (wf done --evidence), а блокери збери одним пакетом (wf block).`,
  };
}
