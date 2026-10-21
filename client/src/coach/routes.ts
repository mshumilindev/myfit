/**
 * Coach dashboard routes (hash, deep-linkable, a refresh restores the screen).
 *
 * Prefix: `#/c/...`. The plan says `#/coach/...`, but `#/coach` already belongs
 * to the client-side advice view (`CoachView`, `fromHash` in App.tsx), which must
 * keep working, so the dashboard uses the short prefix (see dev1-conflicts.md).
 *
 * Pure functions only: parse / serialise / "which screen lights which nav item".
 */

export const COACH_HASH_PREFIX = 'c';

export type CoachScreen =
  | 'agenda'
  | 'clients'
  | 'schedule'
  | 'week'
  | 'decisions'
  | 'programs'
  | 'chat'
  | 'signals'
  | 'live'
  | 'team'
  | 'activity'
  | 'roles'
  | 'spotter';

/**
 * A program page lives under `programs`: the program editor (`#/c/programs/<programId>/edit`) and Check before sending
 * (`#/c/programs/<programId>/check`). `programId` is the runnable plan program (`prg-<clientId>`). `cid` is the client
 * the page was opened from (`?client=<cid>`): Back returns to that client's Program tab instead of the Programs list.
 */
export interface ProgramPageRoute {
  screen: 'programs';
  programId: string;
  sub: ProgramPageSub;
  cid?: string;
}
export type ProgramPageSub = 'edit' | 'check';

/** Chat, optionally opened on one client's thread (`#/c/chat?with=<clientId>`). Without `with` it opens the first thread. */
export interface ChatRoute {
  screen: 'chat';
  with?: string;
}

export type CoachRoute =
  | { screen: CoachScreen }
  | ChatRoute
  | { screen: 'client'; cid: string; tab?: string }
  | ProgramPageRoute;

/** Chat on this client's thread (the Message / Ask buttons of a client must never open someone else's thread). */
export const chatRoute = (clientId: string): ChatRoute => ({ screen: 'chat', with: clientId });

/** The runnable program id of one client's plan (same as `planProgramId` in program/planCodec; a test pins them). */
export const clientProgramId = (clientId: string): string => `prg-${clientId}`;

export const isProgramPage = (route: CoachRoute): route is ProgramPageRoute =>
  route.screen === 'programs' && 'programId' in route && !!route.programId;

/** The client whose plan a program page edits: the client it was opened from, else the one the program id names. */
export function programPageClient(route: ProgramPageRoute): string {
  if (route.cid) return route.cid;
  return route.programId.startsWith('prg-') ? route.programId.slice(4) : route.programId;
}

/** A page of ONE program, from the Programs list (no client) or from a client's Program tab (`cid`). */
export const programPageRoute = (
  clientId: string,
  sub: ProgramPageSub = 'edit',
  from: 'list' | 'client' = 'list',
): ProgramPageRoute => ({
  screen: 'programs',
  programId: clientProgramId(clientId),
  sub,
  ...(from === 'client' ? { cid: clientId } : {}),
});

/** Where Back from a program page goes: the client's Program tab it was opened from, else the Programs list. */
export const programPageBack = (route: ProgramPageRoute): CoachRoute =>
  route.cid ? { screen: 'client', cid: route.cid, tab: 'program' } : { screen: 'programs' };

export const COACH_SCREENS: readonly CoachScreen[] = [
  'agenda',
  'clients',
  'schedule',
  'week',
  'decisions',
  'programs',
  'chat',
  'signals',
  'live',
  'team',
  'activity',
  'roles',
  'spotter',
];

/** Desktop rail, top to bottom (R-FE-002): seven items. */
export const RAIL_SCREENS: readonly CoachScreen[] = [
  'agenda',
  'clients',
  'schedule',
  'week',
  'decisions',
  'programs',
  'chat',
];

/** Phone tab bar (R-FE-002): four screens + More. */
export const TAB_SCREENS: readonly CoachScreen[] = ['agenda', 'clients', 'schedule', 'chat'];

/** Listed in the phone "More" sheet. */
export const MORE_SCREENS: readonly CoachScreen[] = [
  'week',
  'decisions',
  'programs',
  'live',
  'signals',
];

/** What a manager may open: the client list (and one client), the schedule and the team. Nothing else is theirs. Clients first: it is their home (boards D29 / P15). */
export const MANAGER_RAIL_SCREENS: readonly CoachScreen[] = ['clients', 'schedule', 'team'];
/** Pages of the Team area (opened from the Team page), open to a manager as well. */
export const TEAM_SUB_SCREENS: readonly CoachScreen[] = ['activity', 'roles', 'spotter'];
export const MANAGER_HOME_ROUTE: CoachRoute = { screen: 'clients' };

export function managerMayOpen(route: CoachRoute): boolean {
  if (route.screen === 'client') return route.tab !== 'live';
  return (
    (MANAGER_RAIL_SCREENS as readonly string[]).includes(route.screen) ||
    (TEAM_SUB_SCREENS as readonly string[]).includes(route.screen)
  );
}

export const DEFAULT_COACH_ROUTE: CoachRoute = { screen: 'agenda' };

function segments(hash: string): string[] {
  return hash.split('?')[0].replace(/^#\/?/, '').split('/').filter(Boolean);
}

/** True for `#/c` and `#/c/...` (and nothing else: `#/coach` is the advice view). */
export function isCoachDashHash(hash: string): boolean {
  return segments(hash)[0] === COACH_HASH_PREFIX;
}

function queryOf(hash: string): URLSearchParams {
  return new URLSearchParams(hash.split('?')[1] ?? '');
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Hash -> route. Unknown screens fall back to the Agenda (never a blank page). `#/c/today` is the old name of the Agenda and still works. */
export function parseCoachHash(hash: string): CoachRoute {
  const parts = segments(hash);
  if (parts[0] !== COACH_HASH_PREFIX) return DEFAULT_COACH_ROUTE;
  const head = parts[1];
  if (head === 'clients' && parts[2]) {
    const cid = safeDecode(parts[2]);
    if (!parts[3]) return { screen: 'client', cid };
    const tab = safeDecode(parts[3]);
    // Old URLs of the program pages (`clients/<cid>/program/edit|check`) land on the new ones, opened from this client.
    if (tab === 'program' && (parts[4] === 'edit' || parts[4] === 'check'))
      return programPageRoute(cid, parts[4], 'client');
    return { screen: 'client', cid, tab };
  }
  if (head === 'programs' && parts[2]) {
    const programId = safeDecode(parts[2]);
    const cid = queryOf(hash).get('client');
    return {
      screen: 'programs',
      programId,
      sub: parts[3] === 'check' ? 'check' : 'edit',
      ...(cid ? { cid } : {}),
    };
  }
  if (head === 'chat') {
    const w = queryOf(hash).get('with');
    return w ? chatRoute(w) : { screen: 'chat' };
  }
  if (head === 'today') return { screen: 'agenda' };
  if (head && (COACH_SCREENS as readonly string[]).includes(head)) {
    return { screen: head as CoachScreen };
  }
  return DEFAULT_COACH_ROUTE;
}

/** Route -> hash. `parseCoachHash(coachHash(r))` is the identity. */
export function coachHash(route: CoachRoute): string {
  if (isProgramPage(route)) {
    const base = `#/${COACH_HASH_PREFIX}/programs/${encodeURIComponent(route.programId)}/${route.sub}`;
    return route.cid ? `${base}?client=${encodeURIComponent(route.cid)}` : base;
  }
  if (route.screen === 'client') {
    const base = `#/${COACH_HASH_PREFIX}/clients/${encodeURIComponent(route.cid)}`;
    return route.tab ? `${base}/${encodeURIComponent(route.tab)}` : base;
  }
  if (route.screen === 'chat' && 'with' in route && route.with)
    return `#/${COACH_HASH_PREFIX}/chat?with=${encodeURIComponent(route.with)}`;
  return `#/${COACH_HASH_PREFIX}/${route.screen}`;
}

/** The nav item a route lights: a client page belongs to Clients. */
export function navScreenOf(route: CoachRoute): CoachScreen {
  if (route.screen === 'client') return 'clients';
  // the activity log and the role matrix belong to Team
  if (route.screen === 'activity' || route.screen === 'roles' || route.screen === 'spotter')
    return 'team';
  return route.screen;
}

export function sameRoute(a: CoachRoute, b: CoachRoute): boolean {
  return coachHash(a) === coachHash(b);
}

// --- "last Coach screen" (per-viewer convenience, R-FE-001) -----------------

const LAST_KEY = 'coach:last';

/** Remember the screen so switching to "My workouts" and back lands where you left. */
export function rememberCoachRoute(route: CoachRoute): void {
  try {
    localStorage.setItem(LAST_KEY, coachHash(route));
  } catch {
    /* storage blocked: the app works without it */
  }
}

export function readLastCoachRoute(): CoachRoute {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    return raw && isCoachDashHash(raw) ? parseCoachHash(raw) : DEFAULT_COACH_ROUTE;
  } catch {
    return DEFAULT_COACH_ROUTE;
  }
}

/** Hash to open Coach at: the last screen the person was on. */
export function coachEntryHash(): string {
  return coachHash(readLastCoachRoute());
}
