/** SPO-639 W7: result card, approvals queue and morning digest, rendered from wf state (pure; no PII, ids and the agent's own evidence only). */
import { progress } from './wf-core.mjs';

export function renderApprovals(state) {
  const waiting = state.items.filter((i) => i.status === 'blocked');
  if (waiting.length === 0) return '**Чекає на мене:** нічого';
  const lines = [`**Чекає на мене (${waiting.length}), одним пакетом**`, ''];
  for (const i of waiting)
    lines.push(`- ${i.id} [${i.needs}] ${i.text ?? ''}${i.reason ? ` — ${i.reason}` : ''}`);
  return lines.join('\n');
}

export function renderCard(state, { rollback = '' } = {}) {
  const { done, total, pct } = progress(state);
  const finished = state.items.filter((i) => i.status === 'done');
  const open = state.items.filter((i) => i.status !== 'done');
  const lines = [
    `## Картка результату · ${state.task?.id ?? '—'} · ${done}/${total} (${pct}%)`,
    '',
    '**Зроблено з доказом:**',
    ...finished.map((i) => `- ${i.id} ${i.text ?? ''} · доказ: ${i.evidence}`),
    '',
    open.length
      ? `**Лишилось (${open.length}):** ${open.map((i) => `${i.id} [${i.status}${i.needs ? `:${i.needs}` : ''}]`).join(', ')}`
      : '**Лишилось:** нічого',
    '',
    `**Відкат:** ${rollback || 'revert коміту; дані не змінювались'}`,
  ];
  return lines.join('\n');
}

export function renderDigest(state, ci) {
  const { done, total, pct } = progress(state);
  const lines = [`**Ранковий дайджест · ${state.task?.id ?? '—'} · ${done}/${total} (${pct}%)**`];
  if (ci)
    lines.push(
      `CI на main: медіана ${ci.ci.medianMin} хв, p90 ${ci.ci.p90Min} хв, червоних ${ci.ci.redPct}% (${ci.ci.runs} запусків)`,
    );
  lines.push('', renderApprovals(state));
  return lines.join('\n');
}
