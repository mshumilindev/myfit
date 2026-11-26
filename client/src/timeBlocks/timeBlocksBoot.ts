/**
 * Boot of the Time blocks chunk: puts its screens into the core's `timeBlocksHost` and announces it is ready. Imported lazily
 * (and only) by `addons/useAddonRuntime.ts` while the module is installed.
 */
import { timeBlocksHost } from '../timeBlocksApi';
import { provide, trackerReady } from '../trackerRt';
import { BlockCountdownRun } from './BlockCountdownRun';
import { SessionBlocks } from './SessionBlock';
import { BlockRecap } from './BlockRecap';
import { ProgramDayBlocks } from './ProgramDayBlocks';
import { specTitle } from './specText';
import { PlanBlocks, RowLabel } from './BlockUi';

provide(timeBlocksHost, {
  Countdown: BlockCountdownRun,
  Blocks: SessionBlocks,
  Recap: BlockRecap,
  RowLabel,
  DayBlocks: ProgramDayBlocks,
  PlanBlocks,
  stepLabel: (b) => specTitle(b.spec),
});
trackerReady('time-blocks');
