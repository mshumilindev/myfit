/**
 * Learn — the how-to video catalog ("database"). Single source of truth for the
 * Learn app AND the shot-list of videos to record.
 *
 * Coverage: every part of Spotter that is NOT behind a feature flag. Flagged
 * areas (Nutrition, gym-presence) are excluded until they ship.
 *
 * Role gating: a lesson with `role` only appears for that role (or higher).
 * 'trainer' lessons show for trainers and admins; 'admin' lessons show only for
 * admins; no role = everyone. So trainer/admin-only features never leak into a
 * member's library.
 *
 * Every lesson is shot TWICE — a phone cut (9:16) and a web cut (16:9). Until a
 * cut exists its src stays `null`, and the UI shows a "video coming soon" state.
 * `blurb` doubles as the recording note (what the clip must show).
 */

export type LearnTopicId =
  | 'basics'
  | 'logging'
  | 'activities'
  | 'programs'
  | 'progress'
  | 'exercises'
  | 'gyms'
  | 'apex'
  | 'people'
  | 'account';

/** Minimum role that may see a lesson. Undefined = everyone (member+). */
export type LearnRole = 'trainer' | 'admin';

/** The viewer roles Learn understands (mirrors the app's Role). */
export type ViewerRole = 'member' | 'trainer' | 'admin';

export interface Lesson {
  id: string;
  topic: LearnTopicId;
  title: string;
  /** What the lesson covers — shown as the description and used as the shot note. */
  blurb: string;
  /** Gate: only this role (or higher) sees it. Undefined = everyone. */
  role?: LearnRole;
  /** Portrait 9:16 cut for phones. `null` until recorded → "coming soon". */
  phoneSrc: string | null;
  /** Landscape 16:9 cut for web. `null` until recorded → "coming soon". */
  webSrc: string | null;
  /** Thumbnail still. `null` until captured → placeholder tile. */
  thumb: string | null;
}

export interface Topic {
  id: LearnTopicId;
  title: string;
  blurb: string;
  /** Phosphor icon (kebab name) — registered in ui.tsx. */
  icon: string;
  lessons: Lesson[];
}

type Def = [id: string, title: string, blurb: string, role?: LearnRole];

function build(topic: LearnTopicId, defs: Def[]): Lesson[] {
  return defs.map(([id, title, blurb, role]) => ({
    id,
    topic,
    title,
    blurb,
    role,
    phoneSrc: null,
    webSrc: null,
    thumb: null,
  }));
}

export const CATALOG: Topic[] = [
  {
    id: 'basics',
    title: 'Basics',
    blurb: 'Accounts, the app, your first workout & log',
    icon: 'rocket-launch',
    lessons: build('basics', [
      [
        'take-the-tour',
        'Get started in 3 minutes',
        'A quick tour of the four tabs — Today, Progress, Programs, Gyms — and the app switcher.',
      ],
      [
        'the-shell',
        'Switch between apps',
        'Open the app switcher and move between Gym, Apex, People and Learn.',
      ],
      [
        'today-screen',
        'The Today screen',
        'Read Today: your plan, streak, quick actions and the live session hero.',
      ],
      [
        'first-workout',
        'Set up your first workout',
        'Start a session from a template, swap an exercise, and set your target sets.',
      ],
      [
        'log-first-set',
        'Log a set the fast way',
        'Enter weight and reps, mark a warm-up, and finish a set in seconds.',
      ],
      [
        'install-app',
        'Install Spotter on your phone',
        'Add Spotter to your home screen so it opens full-screen and works offline.',
      ],
      [
        'language',
        'Change the language',
        'Switch Spotter between English, Ukrainian, Polish, Lithuanian and Estonian.',
      ],
    ]),
  },
  {
    id: 'logging',
    title: 'Logging',
    blurb: 'Sets, supersets, rest timer, backfill',
    icon: 'pencil-simple-line',
    lessons: build('logging', [
      [
        'sets-reps',
        'Sets, reps & weight',
        'The set row: weight, reps, RPE, and how the next set pre-fills from the last.',
      ],
      [
        'edit-delete-set',
        'Edit or delete a set',
        'Fix a mistyped set, delete one, or reorder sets within an exercise.',
      ],
      [
        'warmups',
        'Warm-up sets',
        'Flag warm-ups so they count toward the session but not your working volume.',
      ],
      [
        'prs',
        'Personal records as you lift',
        'See a new PR detected and celebrated the moment you log it.',
      ],
      [
        'supersets',
        'Supersets & circuits',
        'Group exercises into a superset and log them round by round.',
      ],
      [
        'rest-timer',
        'The rest timer',
        'Auto-rest between sets, adjust the duration, and get notified when it ends.',
      ],
      [
        'swap-exercise',
        'Swap an exercise mid-session',
        'Replace a lift on the fly and keep your target sets.',
      ],
      [
        'add-exercise-session',
        'Add an exercise to a session',
        'Drop an extra exercise into today from the library.',
      ],
      [
        'load-entry',
        'Bands, chains & assisted loads',
        'Log resistance bands, added chains and assisted reps with the load helper.',
      ],
      [
        'plate-math',
        'Plate & bar math',
        'Let Spotter work out the plates per side for a target weight.',
      ],
      [
        'set-notes',
        'Notes on a set or session',
        'Add a quick note to a set or the whole session for later.',
      ],
      [
        'backfill',
        'Log a past session',
        'Backfill a workout you did earlier — set the date, time and effort after the fact.',
      ],
      [
        'finish-review',
        'Finish & review a session',
        'Wrap a session, review volume and PRs, and read the summary.',
      ],
      [
        'history-list',
        'Your session history',
        'Browse past sessions, reopen one, and see what you did.',
      ],
    ]),
  },
  {
    id: 'activities',
    title: 'Cardio & recovery',
    blurb: 'Timed activities, effort, rest days',
    icon: 'heartbeat',
    lessons: build('activities', [
      [
        'log-activity',
        'Log a cardio or recovery activity',
        'Start a live timer for a run, walk or stretch, or backfill one with duration.',
      ],
      [
        'activity-timeline',
        'Start time & duration',
        'Set when an activity happened and how long it ran on the timeline control.',
      ],
      [
        'effort-gauge',
        'Set effort on the gauge',
        'Dial effort from light to hard and watch the estimate respond.',
      ],
      [
        'activity-calories',
        'How calories are estimated',
        'See calories scale per activity type and intensity.',
      ],
      [
        'rest-periods',
        'Rest, recovery & vacations',
        'Mark a rest period so a break in training does not read as a missed day.',
      ],
      [
        'rest-day-streak',
        'Rest days & your streak',
        'How counting rest days keeps your consistency streak alive.',
      ],
    ]),
  },
  {
    id: 'programs',
    title: 'Programs',
    blurb: 'Playbook templates, weeks, assignments',
    icon: 'calendar-blank',
    lessons: build('programs', [
      [
        'playbook',
        'Browse the Playbook',
        'Explore ready-made program templates and pick one that fits your goal.',
      ],
      [
        'playbook-categories',
        'Find the right template',
        'Filter the Playbook by goal, days per week and experience.',
      ],
      [
        'start-program',
        'Start a program',
        'Begin a program, see the active week, and start today from its plan.',
      ],
      [
        'active-week',
        'Your active week & today',
        'Read the current week, mark days done, and jump into today’s session.',
      ],
      [
        'program-week',
        'Build a program week',
        'Build a week: add days, drop in exercises, and set target sets and reps.',
      ],
      [
        'edit-program',
        'Edit & reorder a program',
        'Rename, reorder days, swap exercises, and duplicate a week.',
      ],
      [
        'templates',
        'Save a session as a template',
        'Turn a session you like into a reusable template.',
      ],
      [
        'assign-program',
        'Assign a program',
        'Assign a program to a member and keep a single active plan per person.',
        'trainer',
      ],
      [
        'import-program',
        'Import a program from CSV',
        'Bulk-build a program by importing a CSV of days, exercises and sets.',
        'trainer',
      ],
      [
        'export-program',
        'Export & share a program',
        'Export a program to CSV to back it up or hand it to another coach.',
        'trainer',
      ],
    ]),
  },
  {
    id: 'progress',
    title: 'Progress & charts',
    blurb: 'Volume, trends, PRs, body metrics',
    icon: 'chart-line-up',
    lessons: build('progress', [
      [
        'first-chart',
        'Read your first chart',
        'Understand the volume chart on Progress and what each bar means.',
      ],
      [
        'volume-lens',
        'Volume, sets & tonnage lenses',
        'Switch the progress lens between sets, reps and tonnage.',
      ],
      [
        'progress-range',
        'Week, month & all-time',
        'Change the time range to read short- and long-term training load.',
      ],
      [
        'trends',
        'Trends over time',
        'Read the trends view — weekly volume, frequency and consistency streak.',
      ],
      ['records', 'Your records', 'Where PRs live, and how to see a lift’s best-ever set.'],
      ['one-rm', 'Estimated 1RM', 'How Spotter estimates your one-rep max and why it moves.'],
      [
        'muscle-map',
        'Muscle history & the map',
        'See volume by muscle group and read the muscle map.',
      ],
      ['weak-points', 'Spot weak points', 'Find under-trained muscles and balance your week.'],
      [
        'body-metrics',
        'Body metrics & weigh-ins',
        'Log weight, height and composition, and read your body-metric trend.',
      ],
      [
        'weigh-in-reminder',
        'Weigh-in reminders',
        'Get nudged to weigh in and dismiss it for the day.',
      ],
    ]),
  },
  {
    id: 'exercises',
    title: 'Exercises',
    blurb: 'Library, custom lifts, exercise history',
    icon: 'barbell',
    lessons: build('exercises', [
      [
        'exercise-library',
        'The exercise library',
        'Search the catalog and filter by muscle and equipment.',
      ],
      [
        'exercise-favorites',
        'Favourite & pin lifts',
        'Pin the lifts you use most so they surface first.',
      ],
      [
        'custom-exercise',
        'Create a custom exercise',
        'Add your own lift with muscles and equipment so it shows up everywhere.',
      ],
      [
        'exercise-detail',
        'Exercise detail & history',
        'Open a lift to see your set history, PRs and per-exercise trend.',
      ],
      [
        'exercise-catalog-admin',
        'Curate the shared catalog',
        'Add or edit exercises in the shared catalog everyone uses.',
        'admin',
      ],
    ]),
  },
  {
    id: 'gyms',
    title: 'Gyms',
    blurb: 'Add a gym, equipment, band library',
    icon: 'map-pin',
    lessons: build('gyms', [
      [
        'add-gym',
        'Add a gym',
        'Save a gym with its location so Spotter can suggest it automatically.',
      ],
      [
        'gym-suggest',
        'Automatic gym suggestions',
        'How Spotter picks the gym you’re at and how to override it.',
      ],
      [
        'equipment',
        'Equipment inventory',
        'Tick the equipment a gym has so warnings only show for what’s missing.',
      ],
      ['band-library', 'Band library', 'Set each band colour’s estimated resistance once per gym.'],
    ]),
  },
  {
    id: 'apex',
    title: 'Apex & challenges',
    blurb: 'Gamification, ranks, awards, feed',
    icon: 'trophy',
    lessons: build('apex', [
      [
        'apex-overview',
        'What is Apex?',
        'A tour of the Apex app — how training turns into ranks, awards and challenges.',
      ],
      [
        'apex-home',
        'The Apex home',
        'Read your Apex overview: rank, active challenges and recent feats.',
      ],
      [
        'challenges',
        'Join a challenge',
        'Find an active challenge, join it, and track your standing.',
      ],
      [
        'ranks',
        'Ranks & strength standards',
        'How your lifts map to strength standards and how ranks are earned.',
      ],
      ['awards', 'Awards & feats', 'The feats you can unlock and where your awards live.'],
      [
        'feed',
        'Notifications & the feed',
        'Read the Apex feed and the bell — what gets you notified and why.',
      ],
    ]),
  },
  {
    id: 'people',
    title: 'People',
    blurb: 'Profile, clients, users & roles',
    icon: 'user-focus',
    lessons: build('people', [
      [
        'your-profile',
        'Your profile',
        'Edit your name, avatar and body basics from the People app.',
      ],
      ['avatar', 'Set your photo', 'Upload and crop your avatar so it shows across the suite.'],
      [
        'clients-roster',
        'Your client roster',
        'See your members, search the roster, and open a client.',
        'trainer',
      ],
      [
        'client-detail',
        'Coach a client',
        'Open a member to review training and assign a program.',
        'trainer',
      ],
      [
        'trainer-notes',
        'Trainer notes',
        'Leave private notes on a member only coaches can read.',
        'trainer',
      ],
      [
        'users-admin',
        'Manage users',
        'See every account, search, and open a user as an admin.',
        'admin',
      ],
      [
        'roles',
        'Roles & access',
        'What member, trainer and admin can each do, and how to change a role.',
        'admin',
      ],
      ['invites', 'Invite people', 'Create an invite link so a new person can join.', 'admin'],
      [
        'audit',
        'Access & audit log',
        'Read the audit trail of who viewed a member’s data.',
        'admin',
      ],
    ]),
  },
  {
    id: 'account',
    title: 'Account & app',
    blurb: 'Settings, offline, install, sign-in',
    icon: 'gear',
    lessons: build('account', [
      [
        'offline-sync',
        'Offline & sync',
        'How Spotter keeps working offline and syncs when you’re back online.',
      ],
      [
        'sync-conflict',
        'When a sync is blocked',
        'What the sync-blocked card means and how to retry or discard.',
      ],
      [
        'app-update',
        'Update the app',
        'How the update plate works and refreshing to the latest version.',
      ],
      [
        'notifications',
        'Notifications & reminders',
        'Where notices appear and how to act on them.',
      ],
      [
        'sign-out',
        'Sign out & switch account',
        'Sign out safely, including what happens to anything not yet synced.',
      ],
      [
        'settings-flags',
        'Settings & feature flags',
        'Turn early features on or off from admin Settings.',
        'admin',
      ],
    ]),
  },
];

// --- Derived helpers --------------------------------------------------------

export const ALL_LESSONS: Lesson[] = CATALOG.flatMap((t) => t.lessons);

export const LESSON_COUNT = ALL_LESSONS.length;

/** Can a viewer of `role` see a lesson gated at `l.role`? */
export function canSee(l: Lesson, role: ViewerRole): boolean {
  if (!l.role) return true;
  if (l.role === 'trainer') return role === 'trainer' || role === 'admin';
  return role === 'admin';
}

/** The topics + lessons a given role may see (topics with no visible lessons drop). */
export function catalogForRole(role: ViewerRole): Topic[] {
  return CATALOG.map((t) => ({ ...t, lessons: t.lessons.filter((l) => canSee(l, role)) })).filter(
    (t) => t.lessons.length > 0,
  );
}

export function lessonsForRole(role: ViewerRole): Lesson[] {
  return ALL_LESSONS.filter((l) => canSee(l, role));
}

export function topicById(id: LearnTopicId): Topic | undefined {
  return CATALOG.find((t) => t.id === id);
}

export function lessonById(id: string): Lesson | undefined {
  return ALL_LESSONS.find((l) => l.id === id);
}

export function topicTitle(id: LearnTopicId): string {
  return topicById(id)?.title ?? id;
}

/** A lesson is playable once either cut is recorded; until then → coming soon. */
export function isReady(l: Lesson): boolean {
  return l.phoneSrc !== null || l.webSrc !== null;
}
