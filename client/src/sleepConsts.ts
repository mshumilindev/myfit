/** Sleep timing constants shared by the engine and its late-bound facade (SPO-500 I8). */
/** After this long with no activity off the sleep screen we take it that you fell asleep (see `sleep.ts`). */
export const SLEEP_IDLE_MS = 5 * 60 * 1000;
/** How long after the scheduled bedtime the app may still auto-start tonight's night. */
export const AUTO_START_WINDOW_MS = 45 * 60 * 1000;
