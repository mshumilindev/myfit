/**
 * Puts the sample Coach world on `globalThis.__SPOTTER_COACH_TEST__` (see `data/testHooks.ts`). Imported ONLY by:
 *   - the Vitest setup file (`vitest.config.ts` -> `src/coach/__fixtures__/setup.ts`),
 *   - Storybook (`.storybook/preview.tsx`),
 *   - the QA screenshot build (`client/vite.config.qa.ts` injects `qaEntry.ts`).
 * No app build imports it (`tests/kit-guard.test.ts` fails if runtime code reaches a `__fixtures__` module).
 */
import type { CoachBackendMode } from '../data/backend';
import { createDemoClock } from '../data/__fixtures__/demoClock';
import { buildFixtureWorld, createFixturesPort } from '../data/__fixtures__/fixtures';
import { createFixturesChatPort } from '../chat/__fixtures__/fixtures';
import { createFixturesLivePort } from '../screens/live/__fixtures__/fixtures';
import { createFixturesShareSource } from '../share/__fixtures__/fixtures';
import { createFixturesProgramPort } from '../program/__fixtures__/programPort';
import { createFixturesSchedulePort } from '../schedule/__fixtures__/fixtures';
import { GYMS } from '../schedule/__fixtures__/gyms';
import { createFixturesNotesPort } from '../notes/__fixtures__/fixtures';
import {
  createFixturesClientPort,
  type ClientScenario,
} from '../client/data/__fixtures__/fixtures';
import { createFixturesClientChatPort } from '../client/data/__fixtures__/chat';
import { createFixturesTrustPort } from '../security/__fixtures__/trustPort';
import { createFixturesReauthPort } from '../security/__fixtures__/reauth';
import { createFixturesTeamPort } from '../team/__fixtures__/fixtures';

const SCENARIOS: readonly ClientScenario[] = [
  'none',
  'active',
  'waiting',
  'revoked',
  'no-program',
  'migrated',
];
/**
 * Which sample world the member-side screens get. Unit tests keep the empty `none` scenario unless they pass their own port;
 * stories and the QA build default to the trainer's own client (`active`). `localStorage['spotter.clientCoach']` picks another
 * scenario in tests and stories (it is read only here, never by app code).
 */
function scenario(): ClientScenario {
  try {
    const v = window.localStorage.getItem('spotter.clientCoach') as ClientScenario | null;
    if (v && SCENARIOS.includes(v)) return v;
  } catch {
    /* storage blocked: fall through to the default */
  }
  return import.meta.env.MODE === 'test' ? 'none' : 'active';
}

const hooks = (globalThis.__SPOTTER_COACH_TEST__ ??= {});
hooks.mode ??= 'fixtures';
hooks.defaults = {
  world: () => createFixturesPort({ delayMs: 250 }),
  chat: () => createFixturesChatPort({ now: createDemoClock() }),
  live: () => createFixturesLivePort({ now: createDemoClock() }),
  share: () => createFixturesShareSource({ delayMs: 150 }),
  program: () => createFixturesProgramPort({ world: buildFixtureWorld(), delayMs: 200 }),
  schedule: () => createFixturesSchedulePort({ delayMs: 120, now: createDemoClock() }),
  notes: () => createFixturesNotesPort({ now: createDemoClock() }),
  client: () => createFixturesClientPort({ scenario: scenario() }),
  clientChat: () => createFixturesClientChatPort({ unread: scenario() === 'none' ? 0 : 3 }),
  trust: () => createFixturesTrustPort(),
  reauth: () => createFixturesReauthPort(),
  team: () => createFixturesTeamPort({ now: createDemoClock() }),
  gyms: () => GYMS,
};

/** Tests / stories: pin the backend mode (`'firestore'` runs the real path with the unavailable stand-ins). null = the sample world. */
export function setCoachBackendMode(m: CoachBackendMode | null): void {
  hooks.mode = m ?? 'fixtures';
}
