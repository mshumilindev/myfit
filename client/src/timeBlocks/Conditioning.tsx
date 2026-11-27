import { Icon } from '../ui';
import type { Workout } from '../types';
import { useBlockStrings } from './BlockUi';
import { elapsedMs } from './model';
import './blocks.css';

/** What the logged blocks of the shown sessions add up to. Beside the muscle sets, never inside them (the maths do not read blocks). */
export function Conditioning({ workouts }: { workouts: readonly Workout[] }) {
  const t = useBlockStrings();
  const done = workouts.flatMap((w) => (w.blocks ?? []).filter((b) => b.result));
  if (!done.length) return null;
  const sec = done.reduce(
    (n, b) => n + (b.run ? elapsedMs(b.run, b.run.finishedAt ?? 0) / 1000 : 0),
    0,
  );
  const rounds = done.reduce((n, b) => n + (b.result?.rounds ?? 0), 0);
  return (
    <div className="tb-cond" data-testid="conditioning">
      <span className="tb-cond-chip">
        <Icon name="timer" /> {t.conditioning}
      </span>
      <div className="tb-cond-line">
        {t.conditioningLine(done.length, Math.round(sec / 60), rounds)}
      </div>
      <div className="tb-sub">{t.conditioningNote}</div>
    </div>
  );
}
