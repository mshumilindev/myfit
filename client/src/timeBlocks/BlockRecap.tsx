import type { Workout } from '../types';
import { BlockLoggedRow } from './BlockUi';
import { blockOrder } from './model';

/** The logged time blocks of a finished session, read-only (the trainer's view of a client's session). */
export function BlockRecap({ workout }: { workout: Workout }) {
  const logged = blockOrder(workout.blocks ?? []).filter((b) => b.result);
  if (!logged.length) return null;
  return (
    <div className="tb-blocks" data-testid="block-recap">
      {logged.map((b) => (
        <BlockLoggedRow key={b.id} block={b} />
      ))}
    </div>
  );
}
