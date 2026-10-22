/**
 * The ONLY door through which sample data can reach Coach, and it is closed in every app build.
 *
 * Unit tests (Vitest), Storybook and the QA screenshot build (`client/vite.config.qa.ts`) load `__fixtures__/register.ts`,
 * which puts adapter factories on `globalThis.__SPOTTER_COACH_TEST__`. App code (dev server, preview, production) is
 * compiled with `import.meta.env.VITE_COACH_TEST_HOOKS` unset, so `hooks()` is the constant `undefined`, the bundler drops
 * the branch and nothing under `__fixtures__` is ever imported by runtime code (guarded by `tests/kit-guard.test.ts`).
 * There is no runtime switch, no localStorage override and no setter in this module.
 */
/** Which backend the coach data layer runs on (declared here so this module imports nothing from `backend.ts`: no cycle). */
export type CoachBackendMode = 'firestore' | 'fixtures' | 'unconfigured';

export interface CoachTestHooks {
  /** Pins the backend mode (tests: `'firestore'` to exercise the real path, null = the fixtures). */
  mode?: CoachBackendMode | null;
  /** Adapter factories by name (`world`, `chat`, `live`, `share`, `program`, `schedule`, `notes`, `client`, `clientChat`, `trust`, `reauth`). */
  defaults?: Record<string, () => unknown>;
}

declare global {
  var __SPOTTER_COACH_TEST__: CoachTestHooks | undefined;
}

const enabled = (): boolean =>
  import.meta.env.MODE === 'test' || import.meta.env.VITE_COACH_TEST_HOOKS === '1';

/** The hooks, or `undefined` in every app build. */
export const coachTestHooks = (): CoachTestHooks | undefined =>
  enabled() ? globalThis.__SPOTTER_COACH_TEST__ : undefined;

/** A test / story double for one adapter, or `undefined` (the caller then uses the real or the unavailable one). */
export function coachTestDefault<T>(name: string): (() => T) | undefined {
  return coachTestHooks()?.defaults?.[name] as (() => T) | undefined;
}
