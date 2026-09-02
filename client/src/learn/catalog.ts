/**
 * Learn — the how-to video catalog ("database"). This is the single source of
 * truth for the Learn app AND the shot-list of videos still to record.
 *
 * Coverage: every part of Spotter that is NOT behind a feature flag — Gym
 * (Today, logging, activities, programs, playbook, progress, exercises, gyms,
 * body), Apex (challenges, ranks, awards, feed), People (profile, clients,
 * users), and the account/app basics. Flagged areas (Nutrition, gym-presence)
 * are intentionally excluded until they ship.
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

export interface Lesson {
  /** Stable id (also the deep-link and progress key). */
  id: string;
  topic: LearnTopicId;
  title: string;
  /** What the lesson covers — shown as the description and used as the shot note. */
  blurb: string;
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
  /** One-line summary shown on the Topics list. */
  blurb: string;
  /** Phosphor icon (kebab name) — registered in ui.tsx. */
  icon: string;
  lessons: Lesson[];
}

/** Helper so every lesson starts unshot (video coming soon). */
function lesson(
  id: string,
  topic: LearnTopicId,
  title: string,
  blurb: string,
): Lesson {
  return { id, topic, title, blurb, phoneSrc: null, webSrc: null, thumb: null };
}

export const CATALOG: Topic[] = [
  {
    id: 'basics',
    title: 'Basics',
    blurb: 'Accounts, the app, your first workout & log',
    icon: 'rocket-launch',
    lessons: [
      lesson('create-account', 'basics', 'Create your account', 'Sign in with an invite, set your name and avatar, and land on Today.'),
      lesson('take-the-tour', 'basics', 'Get started in 3 minutes', 'A quick tour of the four tabs — Today, Progress, Programs, Gyms — and the app switcher.'),
      lesson('first-workout', 'basics', 'Set up your first workout', 'Start a session from a template, swap an exercise, and set your target sets.'),
      lesson('log-first-set', 'basics', 'Log a set the fast way', 'Enter weight and reps, mark a warm-up, and finish a set in seconds.'),
      lesson('install-app', 'basics', 'Install Spotter on your phone', 'Add Spotter to your home screen so it opens full-screen and works offline.'),
    ],
  },
  {
    id: 'logging',
    title: 'Logging',
    blurb: 'Sets, supersets, rest timer, backfill',
    icon: 'pencil-simple-line',
    lessons: [
      lesson('sets-reps', 'logging', 'Sets, reps & weight', 'The set row: weight, reps, RPE, and how the next set pre-fills from the last.'),
      lesson('warmups-pr', 'logging', 'Warm-ups & personal records', 'Flag warm-up sets, and see how a new PR is detected and celebrated.'),
      lesson('supersets', 'logging', 'Supersets & circuits', 'Group exercises into a superset and log them round by round.'),
      lesson('rest-timer', 'logging', 'The rest timer', 'Auto-rest between sets, adjust the duration, and get notified when it ends.'),
      lesson('load-entry', 'logging', 'Bands, chains & assisted loads', 'Log resistance bands, added chains and assisted reps with the load helper.'),
      lesson('backfill', 'logging', 'Log a past session', 'Backfill a workout you did earlier — set the date, time and effort after the fact.'),
      lesson('finish-review', 'logging', 'Finish & review a session', 'Wrap a session, review volume and PRs, and add a note.'),
    ],
  },
  {
    id: 'activities',
    title: 'Cardio & recovery',
    blurb: 'Timed activities, effort, rest days',
    icon: 'heartbeat',
    lessons: [
      lesson('log-activity', 'activities', 'Log a cardio or recovery activity', 'Start a live timer for a run, walk or stretch, or backfill one with duration.'),
      lesson('effort-calories', 'activities', 'Effort & calories', 'Set the effort level on the gauge and see calories scale per activity and intensity.'),
      lesson('rest-periods', 'activities', 'Rest, recovery & vacations', 'Mark a rest period so a break in training does not read as a missed day.'),
    ],
  },
  {
    id: 'programs',
    title: 'Programs',
    blurb: 'Playbook templates, weeks, assignments',
    icon: 'calendar-blank',
    lessons: [
      lesson('playbook', 'programs', 'Browse the Playbook', 'Explore ready-made program templates and pick one that fits your goal.'),
      lesson('start-program', 'programs', 'Start a program', 'Begin a program, see the active week, and start today from its plan.'),
      lesson('program-week', 'programs', 'Set up a program week', 'Build a week: add days, drop in exercises, and set target sets and reps.'),
      lesson('edit-program', 'programs', 'Edit & reorder a program', 'Rename, reorder days, swap exercises, and duplicate a week.'),
      lesson('assign-program', 'programs', 'Assign a program (trainer)', 'Assign a program to a member and keep a single active plan per person.'),
      lesson('import-program', 'programs', 'Import a program from CSV', 'Bulk-build a program by importing a CSV of days, exercises and sets.'),
    ],
  },
  {
    id: 'progress',
    title: 'Progress & charts',
    blurb: 'Volume, trends, PRs, body metrics',
    icon: 'chart-line-up',
    lessons: [
      lesson('first-chart', 'progress', 'Read your first chart', 'Understand the volume chart on Progress and what each bar means.'),
      lesson('volume-lens', 'progress', 'Volume, sets & tonnage lenses', 'Switch the progress lens between sets, reps and tonnage to read your training load.'),
      lesson('trends', 'progress', 'Trends over time', 'Read the trends view — weekly volume, frequency and consistency streak.'),
      lesson('prs', 'progress', 'Track personal records', 'Where PRs appear, estimated 1RM, and how to see a lift’s best history.'),
      lesson('muscle-history', 'progress', 'Muscle history & weak points', 'See volume by muscle group and spot under-trained areas.'),
      lesson('body-metrics', 'progress', 'Body metrics & weigh-ins', 'Log weight, height and composition, and read your body-metric trend.'),
    ],
  },
  {
    id: 'exercises',
    title: 'Exercises',
    blurb: 'Library, custom lifts, exercise history',
    icon: 'barbell',
    lessons: [
      lesson('exercise-library', 'exercises', 'The exercise library', 'Search the catalog, filter by muscle and equipment, and pin favourites.'),
      lesson('custom-exercise', 'exercises', 'Create a custom exercise', 'Add your own lift with muscles and equipment so it shows up everywhere.'),
      lesson('exercise-detail', 'exercises', 'Exercise detail & history', 'Open a lift to see your set history, PRs and per-exercise trend.'),
    ],
  },
  {
    id: 'gyms',
    title: 'Gyms',
    blurb: 'Add a gym, equipment, band library',
    icon: 'map-pin',
    lessons: [
      lesson('add-gym', 'gyms', 'Add a gym', 'Save a gym with its location so Spotter can suggest it automatically.'),
      lesson('equipment', 'gyms', 'Equipment inventory', 'Tick the equipment a gym has so warnings only show for what’s missing.'),
      lesson('band-library', 'gyms', 'Band library', 'Set each band colour’s estimated resistance once per gym.'),
    ],
  },
  {
    id: 'apex',
    title: 'Apex & challenges',
    blurb: 'Gamification, ranks, awards, feed',
    icon: 'trophy',
    lessons: [
      lesson('apex-overview', 'apex', 'What is Apex?', 'A tour of the Apex app — how training turns into ranks, awards and challenges.'),
      lesson('challenges', 'apex', 'Join a challenge', 'Find an active challenge, join it, and track your standing.'),
      lesson('ranks', 'apex', 'Ranks & strength standards', 'How your lifts map to strength standards and how ranks are earned.'),
      lesson('awards', 'apex', 'Awards & feats', 'The feats you can unlock and where your awards live.'),
      lesson('feed', 'apex', 'Notifications & the feed', 'Read the Apex feed and the bell — what gets you notified and why.'),
    ],
  },
  {
    id: 'people',
    title: 'People',
    blurb: 'Profile, clients, users & roles',
    icon: 'user-focus',
    lessons: [
      lesson('your-profile', 'people', 'Your profile', 'Edit your name, avatar and body basics from the People app.'),
      lesson('clients', 'people', 'Coach your clients (trainer)', 'See your roster, open a member, and leave trainer notes.'),
      lesson('users-roles', 'people', 'Users & roles (admin)', 'Manage accounts, roles and access from the admin view.'),
    ],
  },
  {
    id: 'account',
    title: 'Account & app',
    blurb: 'Settings, language, sign-in, offline',
    icon: 'gear',
    lessons: [
      lesson('settings-flags', 'account', 'Settings & feature flags (admin)', 'Turn early features on or off from admin Settings.'),
      lesson('language', 'account', 'Change the language', 'Switch Spotter between English, Ukrainian, Polish, Lithuanian and Estonian.'),
      lesson('offline-sync', 'account', 'Offline & sync', 'How Spotter keeps working offline and syncs when you’re back online.'),
      lesson('sign-out', 'account', 'Sign out & switch account', 'Sign out safely, including what happens to anything not yet synced.'),
    ],
  },
];

// --- Derived helpers --------------------------------------------------------

export const ALL_LESSONS: Lesson[] = CATALOG.flatMap((t) => t.lessons);

export const LESSON_COUNT = ALL_LESSONS.length;

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
