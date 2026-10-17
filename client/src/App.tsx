import { isProgramsEditorHash } from './views/programs/programsRoute';
import { pushState, refreshPush, setAppBadge } from './push';
import { useConditionLimits } from './healthBuild';
import { setProgressionEffects } from './progression';
import { ScreenSkeleton } from './components/ui/Skeletons';
import { Button, IconButton } from './components/ui/Button';
import { buildNotes, useAtlasFmt, useAtlasNotes } from './atlas/notes';
import { setOverrideUid } from './accountOverrides';
import { chatBacked, planNotePushes, planOutbox, syncOutbox } from './atlas/schedule';
import { computePlaybook } from './playbook';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import {
  getRole,
  getUsername,
  currentUid,
  onAuthChange,
  watchRoleClaim,
  signOut as apiSignOut,
} from './api';
import { db } from './firebase';
import {
  getOpenWorkout,
  pruneEmptyLiveWorkouts,
  startSyncLoop,
  useStore,
  retrySync,
  discardBlockingChange,
  bodyMetricsComplete,
  discardPastWorkout,
  setMasterySeenRating,
  liveSleep,
  setCoach,
  useSelfCoachRole,
} from './store';
import { AppRoot, SpotterSky } from './components/SpotterSky';
import { SleepAutomation, SleepPauseController } from './components/SleepAutomation';
import { SleepHero } from './components/SleepHero';
import { useT } from './i18n';
import { computeMastery, rankIndexForRating, type MasteryResult } from './mastery';
import { Icon, UndoSnackbar, Toast, UpdatePlate, type SnackState, type ToastState } from './ui';
import { useEdgeSwipeBack } from './edgeSwipeBack';
import { isUpdateReady, subscribeUpdateReady, reloadToLatest } from './pwaUpdate';
import {
  computeNotifs,
  syncNotifs,
  useNotifs,
  markNotifsSeen,
  markAllNotifsSeen,
  unreadCount,
} from './notifications';
import { useChallenges } from './challenges';
import { ShellLauncher } from './components/ShellLauncher';
import { setSuiteSession } from './components/suite/suiteSession';
import type { ApexTab } from './views/ApexApp';
import type { RosterTab } from './views/RosterApp';
import { canUseCoach, coachScreenOpen } from './coach/access';
import type { HomeSetRoute } from './views/home/HomeSetView';
import { pruneHomeSetDrafts } from './views/home/homeSetDraft';
import { AuthView } from './views/AuthView';
import { TraineeSessionView } from './views/TraineeSessionView';
import { LiveHero } from './components/LiveHero';
import { ActivityHero } from './components/ActivityHero';
import { isActivityLive } from './activities';
import type { SyncError, Notice, InjurySide } from './types';
import type { HealthFormSpec } from './health';
import type { MuscleGroup } from './data/exercises';
import { useFlag, isFlagOn, startGlobalFlags } from './data/flags';
import { isClientHead } from './coach/client/routes';
import { useClientShared } from './coach/client/shared';
import { ClientBridgeLazy, ClientRoutesLazy } from './coach/client/lazy';
import { BrandBar, BellButton } from './components/ui/BrandBar';
import { BrandAccount } from './components/suite/BrandAccount';
import { ConditionsShield, useActiveConditions } from './views/health/ConditionsShield';
import { AppRail } from './components/AppRail';
import { SuiteTabBar } from './components/SuiteTabBar';
import type { ProgramsPeer } from './components/ProgramsTabs';

const OnboardingView = lazy(() =>
  import('./views/OnboardingView').then((module) => ({ default: module.OnboardingView })),
);
const ProfileCompletionGate = lazy(() =>
  import('./components/BodyMetrics').then((module) => ({ default: module.ProfileCompletionGate })),
);
const TodayView = lazy(() =>
  import('./views/TodayView').then((module) => ({ default: module.TodayView })),
);
const ProgressView = lazy(() =>
  import('./views/ProgressView').then((module) => ({ default: module.ProgressView })),
);
const GymsView = lazy(() =>
  import('./views/GymsView').then((module) => ({ default: module.GymsView })),
);
const SessionView = lazy(() =>
  import('./views/SessionView').then((module) => ({ default: module.SessionView })),
);
const SessionBuilderView = lazy(() =>
  import('./views/SessionBuilderView').then((module) => ({ default: module.SessionBuilderView })),
);
const ActivityView = lazy(() =>
  import('./views/ActivityView').then((module) => ({ default: module.ActivityView })),
);
const LogActivityView = lazy(() =>
  import('./views/LogActivityView').then((module) => ({ default: module.LogActivityView })),
);
const ExerciseHistoryView = lazy(() =>
  import('./views/ExerciseHistoryView').then((module) => ({
    default: module.ExerciseHistoryView,
  })),
);
const MuscleHistoryView = lazy(() =>
  import('./views/MuscleHistoryView').then((module) => ({
    default: module.MuscleHistoryView,
  })),
);
const ExerciseLibraryView = lazy(() =>
  import('./views/ExerciseLibraryView').then((module) => ({
    default: module.ExerciseLibraryView,
  })),
);
const ExerciseDetailView = lazy(() =>
  import('./views/ExerciseDetailView').then((module) => ({
    default: module.ExerciseDetailView,
  })),
);
const SettingsView = lazy(() =>
  import('./views/SettingsView').then((module) => ({
    default: module.SettingsView,
  })),
);
const PlaybookView = lazy(() =>
  import('./views/PlaybookView').then((module) => ({
    default: module.PlaybookView,
  })),
);
const GoalsView = lazy(() =>
  import('./views/GoalsView').then((module) => ({
    default: module.GoalsView,
  })),
);
const NotificationsView = lazy(() =>
  import('./views/NotificationsView').then((module) => ({
    default: module.NotificationsView,
  })),
);
const ThemesView = lazy(() =>
  import('./views/ThemesView').then((module) => ({ default: module.ThemesView })),
);
const HistoryListView = lazy(() =>
  import('./views/HistoryListView').then((module) => ({
    default: module.HistoryListView,
  })),
);
const RecapView = lazy(() =>
  import('./views/RecapView').then((module) => ({ default: module.RecapView })),
);
const RecapStory = lazy(() =>
  import('./views/RecapView').then((module) => ({ default: module.RecapStory })),
);
const GymDetailView = lazy(() =>
  import('./views/GymDetailView').then((module) => ({ default: module.GymDetailView })),
);
const EquipmentDetailView = lazy(() =>
  import('./views/EquipmentDetailView').then((module) => ({
    default: module.EquipmentDetailView,
  })),
);
const CoachView = lazy(() =>
  import('./views/CoachView').then((module) => ({ default: module.CoachView })),
);
const MasteryView = lazy(() =>
  import('./views/MasteryView').then((module) => ({ default: module.MasteryView })),
);
const HealthView = lazy(() =>
  import('./views/HealthView').then((module) => ({ default: module.HealthView })),
);
const InjuryView = lazy(() =>
  import('./views/InjuryView').then((module) => ({ default: module.InjuryView })),
);
// Dev-only: the UI kit gallery is an internal tool. In production builds this
// branch is dead code (import.meta.env.DEV === false), so the chunk isn't
// emitted and #/uikit falls back to Today.
const UiKitGallery = import.meta.env.DEV
  ? lazy(() => import('./components/ui/Gallery').then((module) => ({ default: module.Gallery })))
  : null;
const WidgetLibraryScreen = import.meta.env.DEV
  ? lazy(() =>
      import('./today/WidgetLibraryScreen').then((m) => ({ default: m.WidgetLibraryScreen })),
    )
  : null;
const MasteryBadge = lazy(() =>
  import('./views/MasteryView').then((module) => ({ default: module.MasteryBadge })),
);
const SleepView = lazy(() =>
  import('./views/SleepView').then((module) => ({ default: module.SleepView })),
);
const MasteryRankUp = lazy(() =>
  import('./views/MasteryView').then((module) => ({ default: module.MasteryRankUp })),
);
const ApexApp = lazy(() =>
  import('./views/ApexApp').then((module) => ({ default: module.ApexApp })),
);
const RosterApp = lazy(() =>
  import('./views/RosterApp').then((module) => ({ default: module.RosterApp })),
);
// Coach dashboard (flag `coach`, trainer or admin): code-split, own prefix #/c/… (not #/coach, the advice view).
const CoachApp = lazy(() =>
  import('./coach/CoachApp').then((module) => ({ default: module.CoachApp })),
);
const NutritionApp = lazy(() =>
  import('./NutritionApp').then((module) => ({ default: module.NutritionApp })),
);
const LearnApp = lazy(() => import('./LearnApp').then((module) => ({ default: module.LearnApp })));
const ProfileView = lazy(() =>
  import('./views/ProfileView').then((module) => ({ default: module.ProfileView })),
);
const OverviewView = lazy(() =>
  import('./views/OverviewView').then((module) => ({ default: module.OverviewView })),
);
const HomeSetView = lazy(() =>
  import('./views/home/HomeSetView').then((module) => ({ default: module.HomeSetView })),
);
const StartSheet = lazy(() =>
  import('./components/StartSheet').then((module) => ({ default: module.StartSheet })),
);
const ProgramsView = lazy(() =>
  import('./views/ProgramsView').then((module) => ({ default: module.ProgramsView })),
);

export type Tab = 'today' | 'overview' | 'progress' | 'gyms' | 'programs' | 'people' | 'me';

export type Overlay =
  | { screen: 'session'; workoutId: string }
  | { screen: 'activity'; newType?: string; editId?: string }
  | { screen: 'log-activity'; cat?: 'conditioning' | 'sport' | 'recovery' }
  | { screen: 'sleep'; wake?: boolean; mode?: 'backfill' | 'schedule' | 'edit'; nightId?: string }
  | { screen: 'past-workout'; workoutId: string; startAdd?: boolean }
  | { screen: 'exercise-history'; name: string; userId?: string; userName?: string }
  | { screen: 'exercise-detail'; name: string }
  | { screen: 'muscle-history'; muscle: MuscleGroup }
  | { screen: 'settings' }
  | { screen: 'history' }
  | { screen: 'themes' }
  | { screen: 'notifications' }
  | { screen: 'recap'; period: string }
  | { screen: 'recap-story'; period: string }
  | { screen: 'profile'; userId: string }
  | { screen: 'trainee-session'; athleteId: string; workoutId: string; athleteName?: string }
  | {
      screen: 'gym';
      gymId?: string;
      name?: string;
      lat?: number;
      lng?: number;
      address?: string;
      externalId?: string;
      amenities?: string[];
    }
  | { screen: 'equipment'; itemId: string; gymId?: string }
  | { screen: 'builder'; programMode?: 'none' | 'own' | 'other'; programDays?: number[] }
  | { screen: 'mastery' }
  | { screen: 'coach' }
  /** Client-side trainer screens (M7): invite, My trainer, chat, access log. `route` = hash path ("trainer/chat"). */
  | { screen: 'client-coach'; route: string }
  | {
      screen: 'injury';
      injuryId?: string;
      checkin?: boolean;
      /** Health › I got hurt → Still healing: start setup at "how it feels". */
      prefill?: { bodyPart: string; side: InjurySide; startDay: number };
    }
  | {
      screen: 'health';
      view?: 'history';
      hist?: 'list' | 'timeline';
      form?: HealthFormSpec;
      /** A long-term condition page: 'new' or a condition id; `condKey` = the picked catalogue entry. */
      cond?: string;
      condKey?: string;
      /** Nicotine pages (hub, What I use, Use in calculations). */
      nic?: 'hub' | 'products' | 'calc';
      /** Alcohol pages (hub, What I drink, Usual days, Use in calculations). */
      alc?: 'hub' | 'products' | 'days' | 'calc';
      /** Supplements pages (hub, What I take, Use in calculations). */
      sup?: 'hub' | 'products' | 'calc';
      /** Cycle pages (hub, settings). */
      cyc?: 'hub' | 'settings' | 'patterns';
      /** Health › Privacy and sharing. */
      priv?: boolean;
    }
  | ({ screen: 'home-set' } & HomeSetRoute)
  | { screen: 'uikit' }
  | { screen: 'widget-library' }
  | { screen: 'library'; libTab?: 'mine' }
  | null;

export interface Shell {
  openOverlay: (o: Overlay) => void;
  replaceOverlay: (o: Overlay) => void;
  goTab: (t: Tab) => void;
  goPlaybook: () => void;
  /** Open the Start sheet (the notched "+" in the tab bar). */
  openStart: () => void;
  toast: (t: ToastState) => void;
  snack: (s: SnackState) => void;
  signOut: () => void;
  queueLength: number;
}

const TABS: Tab[] = ['today', 'overview', 'progress', 'gyms', 'programs'];
/** Progress and Programs (with its Goals / Playbook / Exercises peers) are
 *  drill-ins of the Overview hub: they keep their own URLs but the tab bar
 *  lights Overview while they're open. */
const OVERVIEW_TABS: Tab[] = ['overview', 'progress', 'programs'];
type NavRole = ReturnType<typeof getRole>;
type NavLabels = Pick<ReturnType<typeof useT>['t'], 'today' | 'overviewTab' | 'gyms'>;
type NavItem = { id: Tab; icon: string; label: string; badge?: number; ariaLabel?: string };

/** The People sub-app's label follows the role, matching the old in-Gym menu. */
function peopleLabelFor(role: NavRole, t: ReturnType<typeof useT>['t']): string {
  if (role === 'trainer') return t.trClientsTab;
  if (role === 'admin') return t.adminPeople;
  return t.navMe;
}
/** …and its Shell tile description, so each role sees what the app holds. */
function peopleDescFor(role: NavRole, t: ReturnType<typeof useT>['t']): string {
  if (role === 'trainer') return t.shellPeopleDescCoach;
  if (role === 'admin') return t.shellPeopleDescAdmin;
  return t.shellPeopleDesc;
}
/** The tab the People app opens on for a given role. */
function rosterHomeFor(role: NavRole): RosterTab {
  if (role === 'trainer') return 'clients';
  if (role === 'admin') return 'users';
  return 'me';
}

function defaultTab(): Tab {
  return 'today';
}

function tabsForRole(_role: NavRole, t: NavLabels): NavItem[] {
  // Clients / users / profile moved into the People sub-app, so the Gym menu is
  // the same core tabs for everyone; People is reached via the app switcher.
  // Progress / Programs / Goals / Playbook / Exercises live under Overview.
  return [
    { id: 'today', icon: 'house', label: t.today },
    { id: 'overview', icon: 'chart-line-up', label: t.overviewTab },
    { id: 'gyms', icon: 'map-pin', label: t.gyms },
  ];
}

/** Is this nav item the one to light for the current tab? */
function navActive(item: Tab, tab: Tab): boolean {
  return item === 'overview' ? OVERVIEW_TABS.includes(tab) : item === tab;
}

/** Progress sub-screens: the main tabs, Trends, and the Activity trends page. */
export type ProgressSub = 'progress' | 'trends' | 'activity';

/** Serialize the current screen to a URL hash so a refresh restores it. */
export function toHash(
  tab: Tab,
  overlay: Overlay,
  programsPeer: ProgramsPeer,
  libMine: boolean,
  progressSub: ProgressSub,
  progressSeg: ProgSeg,
  volumeLens: VolLens,
): string {
  if (!overlay && tab === 'programs') {
    if (programsPeer === 'exercises') return libMine ? '#/exercises/mine' : '#/exercises';
    if (programsPeer === 'playbook') return '#/playbook';
    if (programsPeer === 'goals') return '#/goals';
  }
  if (!overlay && tab === 'progress') {
    if (progressSub === 'trends') return '#/trends';
    if (progressSub === 'activity') return '#/trends/activity';
    if (progressSeg === 'muscle') return '#/progress/muscle';
    if (progressSeg === 'records') return '#/progress/records';
    if (progressSeg === 'volume')
      return volumeLens === 'volume' ? '#/progress/volume' : `#/progress/volume/${volumeLens}`;
    return '#/progress';
  }
  if (overlay?.screen === 'session') return '#/session';
  if (overlay?.screen === 'activity') return '#/activity';
  if (overlay?.screen === 'log-activity')
    return overlay.cat ? `#/log-activity/${overlay.cat}` : '#/log-activity';
  if (overlay?.screen === 'sleep') return '#/sleep';
  if (overlay?.screen === 'past-workout') return `#/workout/${overlay.workoutId}`;
  if (overlay?.screen === 'exercise-history')
    return overlay.userId
      ? `#/exercise/${encodeURIComponent(overlay.name)}/${encodeURIComponent(overlay.userId)}`
      : `#/exercise/${encodeURIComponent(overlay.name)}`;
  if (overlay?.screen === 'trainee-session')
    return `#/trainee/${encodeURIComponent(overlay.athleteId)}/${encodeURIComponent(overlay.workoutId)}`;
  if (overlay?.screen === 'exercise-detail')
    return `#/exercise-detail/${encodeURIComponent(overlay.name)}`;
  if (overlay?.screen === 'muscle-history') return `#/muscle/${encodeURIComponent(overlay.muscle)}`;
  if (overlay?.screen === 'profile') return `#/profile/${encodeURIComponent(overlay.userId)}`;
  if (overlay?.screen === 'gym') return overlay.gymId ? `#/gym/${overlay.gymId}` : '#/gym';
  if (overlay?.screen === 'equipment')
    return overlay.gymId
      ? `#/equipment/${encodeURIComponent(overlay.itemId)}/${overlay.gymId}`
      : `#/equipment/${encodeURIComponent(overlay.itemId)}`;
  if (overlay?.screen === 'library')
    return overlay.libTab === 'mine' ? '#/exercises/mine' : '#/exercises';
  if (overlay?.screen === 'settings') return '#/settings';
  if (overlay?.screen === 'history') return '#/history';
  if (overlay?.screen === 'themes') return '#/themes';
  if (overlay?.screen === 'builder') return '#/builder';
  if (overlay?.screen === 'injury') return '#/injury';
  if (overlay?.screen === 'health') return healthHash(overlay);
  if (overlay?.screen === 'home-set') return homeSetHash(overlay);
  if (overlay?.screen === 'uikit') return '#/uikit';
  if (overlay?.screen === 'widget-library') return '#/widgets';
  if (overlay?.screen === 'notifications') return '#/notifications';
  if (overlay?.screen === 'coach') return '#/coach';
  if (overlay?.screen === 'client-coach') return `#/${overlay.route}`;
  if (overlay?.screen === 'recap') return `#/recap/${encodeURIComponent(overlay.period)}`;
  if (overlay?.screen === 'recap-story')
    return `#/recap-story/${encodeURIComponent(overlay.period)}`;
  if (tab === 'me') return '#/me';
  return `#/${tab}`;
}

/** Health hash: #/health, then optionally /history (+ /timeline), then a form:
 *  /new/{ctx}/{type}, /edit/{periodId} or /injury/{injuryId}. */
function healthHash(o: Extract<Overlay, { screen: 'health' }>): string {
  const parts = ['#/health'];
  if (o.view === 'history') {
    parts.push('history');
    if (o.hist === 'timeline' && !o.form) parts.push('timeline');
  }
  const f = o.form;
  if (f?.kind === 'new') parts.push('new', f.ctx, f.type);
  else if (f?.kind === 'edit') parts.push('edit', encodeURIComponent(f.periodId));
  else if (f?.kind === 'edit-injury') parts.push('injury', encodeURIComponent(f.injuryId));
  if (o.cond) {
    parts.push('cond', encodeURIComponent(o.cond));
    if (o.condKey) parts.push(encodeURIComponent(o.condKey));
  }
  if (o.nic) {
    parts.push('nicotine');
    if (o.nic !== 'hub') parts.push(o.nic);
  }
  if (o.cyc) {
    parts.push('cycle');
    if (o.cyc !== 'hub') parts.push(o.cyc);
  }
  if (o.alc) {
    parts.push('alcohol');
    if (o.alc !== 'hub') parts.push(o.alc);
  }
  if (o.sup) {
    parts.push('supplements');
    if (o.sup !== 'hub') parts.push(o.sup);
  }
  if (o.priv) parts.push('privacy');
  return parts.join('/');
}

/** Home set hash: #/home[/moves] for the home page, then /set/{id|new}, /add/{id|new} or
 *  /move/{id|new} for its pages. */
function homeSetHash(o: Extract<Overlay, { screen: 'home-set' }>): string {
  const sub = o.id ? encodeURIComponent(o.id) : 'new';
  if (o.page) return `#/home/${o.page}/${sub}`;
  return o.tab === 'moves' ? '#/home/moves' : '#/home';
}

function homeSetFromHash(rest: string[]): Extract<Overlay, { screen: 'home-set' }> {
  const [k, a] = rest;
  const id = a && a !== 'new' ? decodeURIComponent(a) : undefined;
  if (k === 'set' || k === 'add' || k === 'move')
    return id ? { screen: 'home-set', page: k, id } : { screen: 'home-set', page: k };
  return k === 'moves' ? { screen: 'home-set', tab: 'moves' } : { screen: 'home-set' };
}

function healthFromHash(rest: string[]): Extract<Overlay, { screen: 'health' }> {
  const o: Extract<Overlay, { screen: 'health' }> = { screen: 'health' };
  let i = 0;
  if (rest[i] === 'history') {
    o.view = 'history';
    i++;
    if (rest[i] === 'timeline') {
      o.hist = 'timeline';
      i++;
    }
  }
  const [k, a, b] = rest.slice(i);
  const types = ['off', 'active', 'illness', 'injury'] as const;
  if (k === 'new' && (a === 'start' || a === 'past') && types.includes(b as (typeof types)[number]))
    o.form = { kind: 'new', ctx: a, type: b as (typeof types)[number] };
  else if (k === 'edit' && a) o.form = { kind: 'edit', periodId: decodeURIComponent(a) };
  else if (k === 'injury' && a) o.form = { kind: 'edit-injury', injuryId: decodeURIComponent(a) };
  else if (k === 'cond' && a) {
    o.cond = decodeURIComponent(a);
    if (b) o.condKey = decodeURIComponent(b);
  } else if (k === 'nicotine') {
    // The old #/health/nicotine/privacy page now lives in Health › Privacy and sharing.
    if (a === 'privacy') o.priv = true;
    else o.nic = a === 'products' || a === 'calc' ? a : 'hub';
  } else if (k === 'cycle') {
    o.cyc = a === 'settings' || a === 'patterns' ? a : 'hub';
  } else if (k === 'alcohol') {
    o.alc = a === 'products' || a === 'days' || a === 'calc' ? a : 'hub';
  } else if (k === 'supplements') {
    o.sup = a === 'products' || a === 'calc' ? a : 'hub';
  } else if (k === 'privacy') {
    o.priv = true;
  }
  return o;
}

/**
 * One step back from an overlay: the remembered parent if there is one; else, for a Health
 * page reached by a link, a refresh or a shortcut, up one level (a Nicotine page goes to
 * the Nicotine hub, the hub and every other Health page to the Health overview), never
 * straight past Health to Today.
 */
export function overlayBack(n: { cur: Overlay; stack: Overlay[] }): {
  cur: Overlay;
  stack: Overlay[];
} {
  if (n.stack.length > 0) {
    return { cur: n.stack[n.stack.length - 1], stack: n.stack.slice(0, -1) };
  }
  if (n.cur?.screen === 'health' && n.cur.nic && n.cur.nic !== 'hub')
    return { cur: { screen: 'health', nic: 'hub' }, stack: [] };
  if (n.cur?.screen === 'health' && n.cur.cyc && n.cur.cyc !== 'hub')
    return { cur: { screen: 'health', cyc: 'hub' }, stack: [] };
  if (n.cur?.screen === 'health' && n.cur.alc && n.cur.alc !== 'hub')
    return { cur: { screen: 'health', alc: 'hub' }, stack: [] };
  if (n.cur?.screen === 'health' && n.cur.sup && n.cur.sup !== 'hub')
    return { cur: { screen: 'health', sup: 'hub' }, stack: [] };
  if (
    n.cur?.screen === 'health' &&
    (n.cur.view ||
      n.cur.form ||
      n.cur.cond ||
      n.cur.nic ||
      n.cur.alc ||
      n.cur.sup ||
      n.cur.cyc ||
      n.cur.priv)
  )
    return { cur: { screen: 'health' }, stack: [] };
  // A Home set page reached by a link or a refresh goes up to the Home set page.
  if (n.cur?.screen === 'home-set' && n.cur.page) return { cur: { screen: 'home-set' }, stack: [] };
  return { cur: null, stack: [] };
}

/** Parse a URL hash back into {tab, overlay}. Unknown → Today. */
export function fromHash(hash: string): { tab: Tab; overlay: Overlay } {
  const parts = hash.split('?')[0].replace(/^#\/?/, '').split('/');
  const head = parts[0] ?? '';
  if (head === 'session') return { tab: 'today', overlay: { screen: 'session', workoutId: '' } };
  if (head === 'activity') return { tab: 'today', overlay: { screen: 'activity' } };
  if (head === 'log-activity') {
    const cat = parts[1];
    return {
      tab: 'today',
      overlay:
        cat === 'conditioning' || cat === 'sport' || cat === 'recovery'
          ? { screen: 'log-activity', cat }
          : { screen: 'log-activity' },
    };
  }
  if (head === 'sleep') return { tab: 'today', overlay: { screen: 'sleep' } };
  if (head === 'workout' && parts[1])
    return { tab: 'today', overlay: { screen: 'past-workout', workoutId: parts[1] } };
  if (head === 'exercise' && parts[1])
    return {
      tab: 'today',
      overlay: {
        screen: 'exercise-history',
        name: decodeURIComponent(parts[1]),
        ...(parts[2] ? { userId: decodeURIComponent(parts[2]) } : {}),
      },
    };
  if (head === 'trainee' && parts[1] && parts[2])
    return {
      tab: 'today',
      overlay: {
        screen: 'trainee-session',
        athleteId: decodeURIComponent(parts[1]),
        workoutId: decodeURIComponent(parts[2]),
      },
    };
  if (head === 'exercise-detail' && parts[1])
    return {
      tab: 'programs',
      overlay: { screen: 'exercise-detail', name: decodeURIComponent(parts[1]) },
    };
  if (head === 'muscle' && parts[1])
    return {
      tab: 'progress',
      overlay: { screen: 'muscle-history', muscle: decodeURIComponent(parts[1]) as MuscleGroup },
    };
  if (head === 'profile' && parts[1])
    return { tab: 'today', overlay: { screen: 'profile', userId: decodeURIComponent(parts[1]) } };
  if (head === 'me') return { tab: 'me', overlay: null };
  // Playbook and Exercises are peer tabs of Programs, not overlays (AC-LIBTAB):
  // route them to the programs tab; which peer is active is read separately via
  // `peerFromHash` so a refresh on #/playbook or #/exercises lands there.
  if (head === 'exercises' || head === 'playbook' || head === 'templates' || head === 'goals')
    return { tab: 'programs', overlay: null };
  // Progress sub-tabs are peer URLs of #/progress (read separately below).
  if (head === 'trends' || head === 'feats' || head === 'challenges')
    return { tab: 'progress', overlay: null };
  if (head === 'settings') return { tab: 'today', overlay: { screen: 'settings' } };
  if (head === 'mastery') return { tab: 'today', overlay: { screen: 'mastery' } };
  if (head === 'coach') return { tab: 'today', overlay: { screen: 'coach' } };
  if (isClientHead(head))
    return { tab: 'today', overlay: { screen: 'client-coach', route: parts.join('/') } };
  if (head === 'injury') return { tab: 'today', overlay: { screen: 'injury' } };
  if (head === 'health') return { tab: 'today', overlay: healthFromHash(parts.slice(1)) };
  if (head === 'home') return { tab: 'today', overlay: homeSetFromHash(parts.slice(1)) };
  if (head === 'widgets' && import.meta.env.DEV)
    return { tab: 'today', overlay: { screen: 'widget-library' } };
  if (head === 'uikit' && import.meta.env.DEV)
    return { tab: 'today', overlay: { screen: 'uikit' } };
  if (head === 'history') return { tab: 'today', overlay: { screen: 'history' } };
  if (head === 'themes') return { tab: 'today', overlay: { screen: 'themes' } };
  if (head === 'builder') return { tab: 'today', overlay: { screen: 'builder' } };
  if (head === 'notifications') return { tab: 'today', overlay: { screen: 'notifications' } };
  if (head === 'recap' && parts[1])
    return { tab: 'today', overlay: { screen: 'recap', period: decodeURIComponent(parts[1]) } };
  if (head === 'recap-story' && parts[1])
    return {
      tab: 'today',
      overlay: { screen: 'recap-story', period: decodeURIComponent(parts[1]) },
    };
  if (head === 'gym' && parts[1])
    return { tab: 'gyms', overlay: { screen: 'gym', gymId: parts[1] } };
  if (head === 'gym') return { tab: 'gyms', overlay: { screen: 'gym' } };
  if (head === 'equipment' && parts[1])
    return {
      tab: 'gyms',
      overlay: { screen: 'equipment', itemId: decodeURIComponent(parts[1]), gymId: parts[2] },
    };
  if ((TABS as string[]).includes(head)) return { tab: head as Tab, overlay: null };
  return { tab: 'today', overlay: null };
}

/** Read the Exercises peer-tab state from the hash (#/exercises[/mine]). Kept
 *  separate from fromHash so it can be applied without threading it through the
 *  overlay stack. */
function peerFromHash(hash: string): { peer: ProgramsPeer; mine: boolean } {
  const parts = hash.split('?')[0].replace(/^#\/?/, '').split('/');
  if (parts[0] === 'exercises') return { peer: 'exercises', mine: parts[1] === 'mine' };
  if (parts[0] === 'playbook' || parts[0] === 'templates') return { peer: 'playbook', mine: false };
  if (parts[0] === 'goals') return { peer: 'goals', mine: false };
  return { peer: 'programs', mine: false };
}

export type ProgSeg = 'total' | 'muscle' | 'volume' | 'records';
export type VolLens = 'volume' | 'fatigue' | 'readiness';

/** Read the Progress sub-tab + volume seg/lens from the hash:
 *  #/trends, #/feats[/standards], #/progress[/muscle|/volume[/fatigue|/readiness]|/records]. */
export function progressFromHash(hash: string): {
  sub: ProgressSub;
  seg: ProgSeg;
  lens: VolLens;
} {
  const parts = hash.split('?')[0].replace(/^#\/?/, '').split('/');
  const base = { seg: 'total' as ProgSeg, lens: 'volume' as VolLens };
  if (parts[0] === 'trends' && parts[1] === 'activity') return { sub: 'activity', ...base };
  if (parts[0] === 'trends') return { sub: 'trends', ...base };
  if (parts[0] === 'progress') {
    const seg: ProgSeg = (['muscle', 'volume', 'records'] as string[]).includes(parts[1])
      ? (parts[1] as ProgSeg)
      : 'total';
    const lens: VolLens =
      seg === 'volume' && (parts[2] === 'fatigue' || parts[2] === 'readiness')
        ? (parts[2] as VolLens)
        : 'volume';
    return { sub: 'progress', seg, lens };
  }
  return { sub: 'progress', ...base };
}

/** The `?f=<element-id>` deep-link target a notification asks to focus. */
function focusFromHash(hash: string): string | null {
  const q = hash.split('?')[1];
  if (!q) return null;
  const m = /(?:^|&)f=([^&]+)/.exec(q);
  return m ? decodeURIComponent(m[1]) : null;
}

// --- Apex (the gamification sub-app) is a full-screen mode at #/apex[/<tab>].
const APEX_TAB_IDS: readonly string[] = ['home', 'challenges', 'ranks', 'awards', 'feed'];
function isApexHash(hash: string): boolean {
  return hash.split('?')[0].replace(/^#\/?/, '').split('/')[0] === 'apex';
}
function apexTabFromHash(hash: string): ApexTab {
  const seg = hash.split('?')[0].replace(/^#\/?/, '').split('/')[1] ?? '';
  return (APEX_TAB_IDS.includes(seg) ? seg : 'home') as ApexTab;
}
function apexHash(tab: ApexTab): string {
  return tab === 'home' ? '#/apex' : `#/apex/${tab}`;
}

// --- People (accounts & profiles sub-app) is a full-screen mode at #/people[/<tab>].
const ROSTER_TAB_IDS: readonly string[] = ['clients', 'users', 'me', 'feed'];
function isRosterHash(hash: string): boolean {
  return hash.split('?')[0].replace(/^#\/?/, '').split('/')[0] === 'people';
}
function rosterTabFromHash(hash: string): RosterTab {
  const seg = hash.split('?')[0].replace(/^#\/?/, '').split('/')[1] ?? '';
  return (ROSTER_TAB_IDS.includes(seg) ? seg : 'me') as RosterTab;
}
function rosterHash(tab: RosterTab): string {
  return `#/people/${tab}`;
}

// --- Nutrition (food & macros sub-app) is a full-screen mode at #/nutrition.
function isNutritionHash(hash: string): boolean {
  return hash.split('?')[0].replace(/^#\/?/, '').split('/')[0] === 'nutrition';
}

// --- Learn (how-to videos sub-app) is a full-screen mode at #/learn.
function isLearnHash(hash: string): boolean {
  return hash.split('?')[0].replace(/^#\/?/, '').split('/')[0] === 'learn';
}

export function App() {
  const { t, locale } = useT();
  const store = useStore();
  const conditionLimits = useConditionLimits();
  useEffect(() => setProgressionEffects(conditionLimits.effects), [conditionLimits]);
  const [authed, setAuthed] = useState<boolean>(() => !!currentUid());
  const wantCoachRole = useSelfCoachRole();
  useEffect(() => {
    if (authed && wantCoachRole && store.coach.role !== wantCoachRole) {
      setCoach({ role: wantCoachRole });
    }
  }, [authed, wantCoachRole, store.coach.role]);
  const [notices, setNotices] = useState<Notice[]>([]);

  // Firebase restores the session asynchronously; track it and keep the cached
  // role claim fresh.
  useEffect(() => {
    const unsubRole = watchRoleClaim();
    const unsub = onAuthChange((user) => {
      setOverrideUid(user?.uid ?? null);
      setAuthed(!!user);
    });
    return () => {
      unsub();
      unsubRole();
    };
  }, []);

  // Notices: a live listener on the user's own notices subcollection.
  useEffect(() => {
    if (!authed) return;
    const uid = currentUid();
    if (!uid) return;
    return onSnapshot(
      collection(db, 'users', uid, 'notices'),
      (snap) => {
        const list = snap.docs
          .map((d) => {
            const n = d.data() as {
              kind: string;
              actor: string | null;
              detail: string | null;
              createdAt: number;
              readAt: number | null;
            };
            return {
              id: d.id,
              kind: n.kind,
              actor: n.actor ?? null,
              detail: n.detail ?? null,
              createdAt: n.createdAt,
              read: n.readAt != null,
            };
          })
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 50);
        setNotices(list);
      },
      () => {},
    );
  }, [authed]);

  function dismissNotice(id: string) {
    setNotices((ns) => ns.map((n) => (n.id === id ? { ...n, read: true } : n)));
    const uid = currentUid();
    if (uid)
      updateDoc(doc(db, 'users', uid, 'notices', id), { readAt: Date.now() }).catch(() => {});
  }

  // Milestone notifications — derived from training history (see notifications.ts).
  // The reconciled feed + read state live in a small reactive store: the app
  // computes the raw events, feeds them in from an effect, and subscribes for
  // the result (stable timestamps + seen flags, so nothing stale re-surfaces).
  const [notifNow] = useState(() => Date.now());
  const [rankUp, setRankUp] = useState<MasteryResult | null>(null);
  // Rank-up moment: once per crossing, compared against the last surfaced rating.
  useEffect(() => {
    const m = computeMastery(store, Date.now(), {
      trainingSinceYear: store.mastery.sinceYear,
      trainingPattern: store.mastery.pattern,
    });
    if (m.calibrating) return;
    const seen = store.mastery.seenRating;
    if (seen == null) {
      setMasterySeenRating(m.rating);
      return;
    }
    if (m.rankIndex > rankIndexForRating(seen)) queueMicrotask(() => setRankUp(m));
    if (m.rating !== seen) setMasterySeenRating(m.rating);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const nightLive = liveSleep(store.sleeps);
  useEffect(() => {
    const el = document.documentElement;
    if (nightLive) el.dataset.sleep = 'night';
    else delete el.dataset.sleep;
    return () => {
      delete el.dataset.sleep;
    };
  }, [nightLive]);
  const challenges = useChallenges();
  const atlas = useAtlasNotes();
  // Atlas's notes live in his own thread (unread count on his bubble in the
  // stories strip) — not in the bell.
  const rawNotifs = useMemo(
    () => computeNotifs(store, notifNow, t, challenges),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.workouts, store.bodyMetrics, store.exerciseLoadTypes, challenges, notifNow, t],
  );
  // Rows from my trainer (M7) come from the lazy client bridge; empty unless the `coach` flag is on and I have a trainer.
  const clientShared = useClientShared();
  useEffect(() => {
    syncNotifs(clientShared.notifs.length ? [...rawNotifs, ...clientShared.notifs] : rawNotifs);
  }, [rawNotifs, clientShared.notifs]);
  const { notifs, state: notifState } = useNotifs();
  const notifUnread = unreadCount(notifState, notifs);
  // Home Screen icon badge mirrors the bell.
  useEffect(() => {
    setAppBadge(notifUnread);
  }, [notifUnread]);
  // Atlas's planned pushes (skipped day, Sunday review) → the server outbox.
  const atlasFmt = useAtlasFmt();
  useEffect(() => {
    if (!authed || pushState() !== 'on') return;
    const id = window.setTimeout(() => {
      const finished = store.workouts.filter((w) => w.finishedAt !== null);
      const now = Date.now();
      const msgs = store.coach.enabled
        ? chatBacked(
            planOutbox({
              coach: store.coach,
              temper: atlas.temper,
              finished,
              plays: computePlaybook(finished, now).plays,
              now,
              locale,
              fmt: atlasFmt,
              title: t.atlasName,
              reviewBody: t.atlasPushReview,
            }),
            (at) => buildNotes(store, at, locale, atlasFmt).notes,
          ).concat(
            // New notes that will appear while the app is closed → pushes.
            planNotePushes({
              coach: store.coach,
              now,
              notesAt: (at) => buildNotes(store, at, locale, atlasFmt).notes,
              title: t.atlasName,
            }),
          )
        : [];
      void syncOutbox(msgs).catch((err) => console.warn('atlas: outbox sync failed', err));
    }, 3000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, store.workouts, store.sleeps, store.bodyMetrics, store.coach, atlas.temper, locale]);
  // Keep this device's push token fresh (FCM rotates it; iOS can drop it).
  useEffect(() => {
    if (authed) void refreshPush(locale);
  }, [authed, locale]);

  // Apex (gamification) is a full-screen mode; the Shell launcher switches apps.
  const activeChallengeCount = challenges.filter((c) => c.status === 'active').length;
  const [apexOpen, setApexOpen] = useState<boolean>(() => isApexHash(window.location.hash));
  const [apexTab, setApexTab] = useState<ApexTab>(() => apexTabFromHash(window.location.hash));
  const [rosterOpen, setRosterOpen] = useState<boolean>(() => isRosterHash(window.location.hash));
  const [rosterTab, setRosterTab] = useState<RosterTab>(() =>
    rosterTabFromHash(window.location.hash),
  );
  const [nutritionOpen, setNutritionOpen] = useState<boolean>(
    () => isNutritionHash(window.location.hash) && isFlagOn('nutrition'),
  );
  const [learnOpen, setLearnOpen] = useState<boolean>(() => isLearnHash(window.location.hash));
  const [coachWanted, setCoachWanted] = useState<boolean>(() =>
    coachScreenOpen(window.location.hash, getRole()),
  );
  // Nutrition is behind a feature flag (admin-only toggle in Settings); default
  // OFF → the Shell shows it as "coming soon" and it cannot be opened.
  const nutritionEnabled = useFlag('nutrition');
  const [shellOpen, setShellOpen] = useState(false);
  // The Start sheet behind the notched "+" (and the desktop rail's Start).
  const [startOpen, setStartOpen] = useState(false);

  // Deep-link focus: a notification can ask a screen to scroll to a specific
  // card (id) and, when it's interactive (a feat cell), open its existing
  // detail. Poll for the element until the target screen has mounted.
  const [focusTarget, setFocusTarget] = useState<string | null>(() =>
    focusFromHash(window.location.hash),
  );
  useEffect(() => {
    if (!focusTarget) return;
    let raf = 0;
    let tries = 0;
    const run = () => {
      const el = document.getElementById(focusTarget);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('notif-focus');
        window.setTimeout(() => el.classList.remove('notif-focus'), 2200);
        if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') {
          window.setTimeout(() => el.click(), 280);
        }
        setFocusTarget(null);
        return;
      }
      if (tries++ < 45) raf = requestAnimationFrame(run);
      else setFocusTarget(null);
    };
    raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, [focusTarget]);
  // Invite links (#/join/<token>) open onboarding before any auth gate.
  const [joinToken, setJoinToken] = useState<string | null>(() => {
    const m = /^#\/join\/([A-Za-z0-9-]+)/.exec(window.location.hash);
    return m ? m[1] : null;
  });
  const [tab, setTab] = useState<Tab>(() => fromHash(window.location.hash).tab);
  // Programs ↔ Exercises peer-tab lives in App (not ProgramsView) so it survives
  // opening an exercise-detail overlay, which unmounts the tab content.
  const [programsPeer, setProgramsPeer] = useState<ProgramsPeer>(
    () => peerFromHash(window.location.hash).peer,
  );
  const [libMine, setLibMine] = useState<boolean>(() => peerFromHash(window.location.hash).mine);
  // Progress sub-tabs (Progress · Trends · Feats · Challenges) + the Feats
  // sub-tab, kept in App so each has its own URL (#/trends, #/feats,
  // #/feats/standards, #/challenges).
  const [progressSub, setProgressSub] = useState<ProgressSub>(
    () => progressFromHash(window.location.hash).sub,
  );
  // Progress volume seg + lens live here too, so #/progress/volume/readiness
  // survives a refresh and deep links land on the right lens.
  const [progressSeg, setProgressSeg] = useState<ProgSeg>(
    () => progressFromHash(window.location.hash).seg,
  );
  const [volumeLens, setVolumeLens] = useState<VolLens>(
    () => progressFromHash(window.location.hash).lens,
  );
  // Overlay navigation keeps a stack of parents: the back button on an overlay
  // returns to the screen it was opened from (session → exercise history →
  // back lands on the session again), never blindly through browser history.
  const [overlayNav, setOverlayNav] = useState<{ cur: Overlay; stack: Overlay[] }>(() => {
    const o = fromHash(window.location.hash).overlay;
    if (o?.screen === 'session' && !o.workoutId) {
      const w = getOpenWorkout();
      return { cur: w ? { screen: 'session', workoutId: w.id } : null, stack: [] };
    }
    return { cur: o, stack: [] };
  });
  const overlay = overlayNav.cur;
  // A live session starts with its first exercise; a draft nobody added to is
  // thrown away once its screen is left (back, swipe, another tab, a reload) —
  // unless it's still open somewhere in the overlay stack.
  const draftKeepId =
    [overlayNav.cur, ...overlayNav.stack].find((o) => o?.screen === 'session')?.workoutId ?? null;
  useEffect(() => {
    pruneEmptyLiveWorkouts(draftKeepId);
  }, [draftKeepId]);
  // Home set drafts (an unsaved set, the picker's ticks) live only while the screen is open.
  useEffect(() => {
    pruneHomeSetDrafts([overlayNav.cur, ...overlayNav.stack]);
  }, [overlayNav]);
  /** Open an overlay, remembering the current one as its logical parent.
   * Passing null resets the whole overlay stack (used when switching tabs). */
  const setOverlay = useCallback((o: Overlay) => {
    setOverlayNav((n) => {
      if (o === null) return { cur: null, stack: [] };
      // Navigating within the same screen (e.g. switching the library's tab)
      // replaces the current overlay instead of stacking a new parent.
      // Health is the exception: its pages (history, a form, a condition) are real
      // steps, so Back returns to the Health overview, not past it.
      // Home set is the same: its pages (a set, the picker, a move) are real steps.
      if (n.cur && n.cur.screen === o.screen && o.screen !== 'health' && o.screen !== 'home-set')
        return { cur: o, stack: n.stack };
      return { cur: o, stack: n.cur === null ? n.stack : [...n.stack, n.cur] };
    });
  }, []);
  /** Replace the current overlay in place, keeping its logical parent stack, so
   * closing the replacement returns PAST it — used when the builder hands off to
   * the session it just started, so discarding that session lands on Today, not
   * back in the wizard. */
  const replaceOverlay = useCallback((o: Overlay) => {
    setOverlayNav((n) => ({ cur: o, stack: n.stack }));
  }, []);
  const [toasts, setToasts] = useState<Array<ToastState & { id: number }>>([]);
  const [snack, setSnack] = useState<SnackState | null>(null);
  // A fresh build took control → show the reload plate until the user reloads.
  const updateReady = useSyncExternalStore(subscribeUpdateReady, isUpdateReady);
  const desktopRail = useDesktopRail();
  // Interactive back-swipe: while a drag is live we render the destination
  // (the tab) beneath the overlay and translate the two layers by hand.
  const [backSwipe, setBackSwipe] = useState(false);
  const stageRef = useRef<HTMLElement | null>(null);
  const overLayerRef = useRef<HTMLDivElement | null>(null);
  const underLayerRef = useRef<HTMLDivElement | null>(null);
  const scrimRef = useRef<HTMLDivElement | null>(null);
  const snackSeq = useRef(0);
  const toastSeq = useRef(0);

  // One-shot sign-out via #/logout (local testing / support links).
  useEffect(() => {
    if (!/^#\/logout\/?$/i.test(window.location.hash)) return;
    let cancelled = false;
    void (async () => {
      await apiSignOut();
      if (cancelled) return;
      setAuthed(false);
      setOverlay(null);
      setJoinToken(null);
      window.history.replaceState(null, '', '#/');
    })();
    return () => {
      cancelled = true;
    };
  }, [setOverlay]);

  useEffect(() => {
    if (!authed) return;
    return startSyncLoop();
  }, [authed]);

  const shell: Shell = {
    openOverlay: setOverlay,
    replaceOverlay,
    goTab: (x) => {
      setOverlay(null);
      setTab(x);
      // Tapping Progress lands on its default view (#/progress), never a
      // remembered Trends/Feats sub, muscle/records segment or volume lens.
      if (x === 'progress') {
        setProgressSub('progress');
        setProgressSeg('total');
        setVolumeLens('volume');
      }
    },
    goPlaybook: () => {
      setOverlay(null);
      setProgramsPeer('playbook');
      setTab('programs');
    },
    openStart: () => setStartOpen(true),
    toast: (tst) => {
      toastSeq.current += 1;
      const id = toastSeq.current;
      setToasts((list) => [...list, { ...tst, id }]);
    },
    snack: (s) => {
      snackSeq.current += 1;
      setSnack({ ...s, id: snackSeq.current });
    },
    signOut: () => {
      setOverlay(null);
      setTab(defaultTab());
      void apiSignOut();
      setAuthed(false);
      window.history.replaceState(null, '', '#/today');
    },
    queueLength: store.queue.length,
  };

  // Every app's account block (rail avatar popover, phone More sheet) signs out through here.
  const signOutRef = useRef(shell.signOut);
  useEffect(() => {
    signOutRef.current = shell.signOut;
  });
  const queueLen = store.queue.length;
  useEffect(
    () => setSuiteSession({ signOut: () => signOutRef.current(), queueLength: queueLen }),
    [queueLen],
  );

  /** Back from an overlay: pop to the logical parent screen, not history. When
   *  there's no remembered parent (deep link / refreshed URL), fall back to the
   *  tab behind the overlay. An exercise detail opened from the Exercises tab
   *  returns there because that peer-tab state lives in App and is preserved
   *  while the overlay is open. */
  const closeOverlay = useCallback(() => {
    setOverlayNav(overlayBack);
  }, []);
  const removeToast = useCallback((id: number) => {
    setToasts((list) => list.filter((x) => x.id !== id));
  }, []);
  const open = store.workouts.find((w) => w.finishedAt === null);
  const liveAct = store.activities.find(isActivityLive) ?? null;
  const trainedToday = useMemo(() => {
    const d0 = new Date();
    d0.setHours(0, 0, 0, 0);
    return store.workouts.some((w) => w.startedAt >= d0.getTime());
  }, [store.workouts]);
  const role = getRole();
  const tabs = tabsForRole(role, t);
  // Coach dashboard: trainer OR admin, only while the flag is on (access.ts).
  const coachOpen = coachWanted && canUseCoach(role);
  const tabAllowed = TABS.includes(tab);
  const effectiveTab = tabAllowed ? tab : defaultTab();
  // Role guards, applied in render (no setState-in-effect): an overlay the
  // current user may not open is treated as absent, so the tab behind shows
  // through instead of a blank screen. Settings requires admin. The exercise
  // library and detail are always available (no longer flag-gated).
  const overlayBlocked = overlay?.screen === 'settings' && role !== 'admin';
  const activeOverlay = overlayBlocked ? null : overlay;
  // The live session is a focused mode with its own action dock and a back
  // caret (the workout stays live, resumable from Today) — no global tab bar,
  // matching FEATURES-AC F-02 (session screens have no tabbar).
  const showTabbar = !activeOverlay;
  const canEdgeSwipeBack =
    authed &&
    !joinToken &&
    !desktopRail &&
    (activeOverlay !== null || effectiveTab === 'progress' || effectiveTab === 'programs');
  const edgeSwipeBack = () => {
    if (activeOverlay !== null) {
      closeOverlay();
      return;
    }
    // Overview drill-ins (Progress, Trends, Programs & its peers) swipe back to
    // the Overview hub.
    if (effectiveTab === 'progress' || effectiveTab === 'programs') {
      setProgramsPeer('programs');
      setTab('overview');
    }
  };

  useEdgeSwipeBack({
    enabled: canEdgeSwipeBack,
    interactive: activeOverlay !== null,
    onBack: edgeSwipeBack,
    stageRef,
    overRef: overLayerRef,
    underRef: underLayerRef,
    scrimRef,
    onSwipeStart: () => setBackSwipe(true),
    onSwipeEnd: () => setBackSwipe(false),
  });

  // State → URL hash, so a refresh lands on the same screen.
  useEffect(() => {
    if (!authed || joinToken || coachOpen) return;
    const next = learnOpen
      ? '#/learn'
      : nutritionOpen
        ? '#/nutrition'
        : rosterOpen
          ? rosterHash(rosterTab)
          : apexOpen
            ? apexHash(apexTab)
            : toHash(
                effectiveTab,
                activeOverlay,
                programsPeer,
                libMine,
                progressSub,
                progressSeg,
                volumeLens,
              );
    // The program editor owns its address under programs (`#/programs/<id>/edit`, `#/programs/new`).
    const keep =
      effectiveTab === 'programs' &&
      !activeOverlay &&
      programsPeer === 'programs' &&
      isProgramsEditorHash(window.location.hash);
    if (!keep && window.location.hash !== next) window.history.replaceState(null, '', next);
  }, [
    authed,
    joinToken,
    coachOpen,
    apexOpen,
    apexTab,
    rosterOpen,
    rosterTab,
    nutritionOpen,
    learnOpen,
    effectiveTab,
    activeOverlay,
    programsPeer,
    libMine,
    progressSub,
    progressSeg,
    volumeLens,
  ]);

  // URL hash → state (browser back/forward).
  useEffect(() => {
    if (!authed || joinToken) return;
    const onPop = () => {
      setApexOpen(isApexHash(window.location.hash));
      setApexTab(apexTabFromHash(window.location.hash));
      setRosterOpen(isRosterHash(window.location.hash));
      setRosterTab(rosterTabFromHash(window.location.hash));
      setNutritionOpen(isNutritionHash(window.location.hash) && isFlagOn('nutrition'));
      setLearnOpen(isLearnHash(window.location.hash));
      setCoachWanted(coachScreenOpen(window.location.hash, getRole()));
      const { tab: ht, overlay: ho } = fromHash(window.location.hash);
      const pk = peerFromHash(window.location.hash);
      const ps = progressFromHash(window.location.hash);
      setTab(ht);
      setProgramsPeer(pk.peer);
      setLibMine(pk.mine);
      setProgressSub(ps.sub);
      setProgressSeg(ps.seg);
      setVolumeLens(ps.lens);
      setFocusTarget(focusFromHash(window.location.hash));
      setOverlayNav({
        cur:
          ho?.screen === 'session' && !ho.workoutId
            ? open
              ? { screen: 'session', workoutId: open.id }
              : null
            : ho,
        stack: [],
      });
    };
    window.addEventListener('hashchange', onPop);
    return () => window.removeEventListener('hashchange', onPop);
  }, [authed, open, joinToken]);

  // Global feature flags live in config/flags (rules need a signed-in user).
  useEffect(() => {
    if (!authed) return;
    return startGlobalFlags();
  }, [authed]);

  // While Apex is open, put the amethyst accent on the document root too, so
  // sheets that portal to <body> (the challenge start/filter sheets) re-skin
  // along with the rest of the app.
  useEffect(() => {
    const el = document.documentElement;
    if (apexOpen) el.classList.add('theme-apex');
    else el.classList.remove('theme-apex');
    return () => el.classList.remove('theme-apex');
  }, [apexOpen]);

  // Same for People — silver accent on the root while its app is open.
  useEffect(() => {
    const el = document.documentElement;
    if (rosterOpen) el.classList.add('theme-roster');
    else el.classList.remove('theme-roster');
    return () => el.classList.remove('theme-roster');
  }, [rosterOpen]);

  // Same for Nutrition — lazurite accent on the root while its app is open (so
  // portaled sheets/menus pick up the blue accent too).
  useEffect(() => {
    const el = document.documentElement;
    if (nutritionOpen) el.classList.add('theme-nutrition');
    else el.classList.remove('theme-nutrition');
    return () => el.classList.remove('theme-nutrition');
  }, [nutritionOpen]);

  // Same for Learn — rubellite accent on the root while its app is open.
  useEffect(() => {
    const el = document.documentElement;
    if (learnOpen) el.classList.add('theme-learn');
    else el.classList.remove('theme-learn');
    return () => el.classList.remove('theme-learn');
  }, [learnOpen]);

  if (joinToken) {
    return (
      <div className="app">
        <Suspense fallback={<ScreenFallback />}>
          <OnboardingView
            token={joinToken}
            onDone={(workoutId) => {
              setJoinToken(null);
              window.location.hash = '#/today';
              if (currentUid()) setAuthed(true);
              if (workoutId) setOverlay({ screen: 'session', workoutId });
            }}
          />
        </Suspense>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="app">
        <AuthView onLoggedIn={() => setAuthed(true)} />
      </div>
    );
  }

  // Blocking profile-completion gate (Body v1 §3.2): a returning member whose
  // required metrics (height + a current weight) are missing must finish them
  // before the app opens. Only after the first sync resolves, so users who do
  // have metrics never see it flash; members only (staff accounts pass through).
  const needsBodySetup =
    role === 'member' && store.lastSyncAt !== null && !bodyMetricsComplete(store.bodyMetrics);
  if (needsBodySetup) {
    return (
      <div className="app">
        <Suspense fallback={<ScreenFallback />}>
          <ProfileCompletionGate />
        </Suspense>
      </div>
    );
  }

  const goTab = (x: Tab) => {
    setOverlay(null);
    // Landing on a top-level tab always shows that tab's primary content, so a
    // stale peer tab (Playbook/Exercises) never leaks across a Programs re-entry.
    setProgramsPeer('programs');
    // …and Progress opens on its default view, not a remembered sub/segment/lens.
    if (x === 'progress') {
      setProgressSub('progress');
      setProgressSeg('total');
      setVolumeLens('volume');
    }
    setTab(x);
  };
  /** Switch the Programs · Playbook · Exercises peer tab in place (no overlay). */
  const goProgramsPeer = (peer: ProgramsPeer) => {
    setOverlay(null);
    setProgramsPeer(peer);
    setTab('programs');
  };

  // Suite switching: only one app owns the screen at a time.
  const rosterRole: 'trainer' | 'admin' | 'member' =
    role === 'trainer' ? 'trainer' : role === 'admin' ? 'admin' : 'member';
  const peopleLabel = peopleLabelFor(role, t);
  const peopleDesc = peopleDescFor(role, t);
  // Switching apps always lands on that app's home screen — never the tab or
  // overlay you left behind. (Apex/Learn/Nutrition also reset their entry tab.)
  const openGym = () => {
    setShellOpen(false);
    setCoachWanted(false);
    setApexOpen(false);
    setRosterOpen(false);
    setNutritionOpen(false);
    setLearnOpen(false);
    setOverlay(null);
    setTab('today');
  };
  const openApex = () => {
    setShellOpen(false);
    setCoachWanted(false);
    setRosterOpen(false);
    setNutritionOpen(false);
    setLearnOpen(false);
    setApexTab('home');
    setApexOpen(true);
  };
  const openRoster = (rtab: RosterTab) => {
    setShellOpen(false);
    setCoachWanted(false);
    setApexOpen(false);
    setNutritionOpen(false);
    setLearnOpen(false);
    setRosterTab(rtab);
    setRosterOpen(true);
  };
  const openNutrition = () => {
    if (!nutritionEnabled) return;
    setShellOpen(false);
    setCoachWanted(false);
    setApexOpen(false);
    setRosterOpen(false);
    setLearnOpen(false);
    setNutritionOpen(true);
  };
  const openLearn = () => {
    setShellOpen(false);
    setCoachWanted(false);
    setApexOpen(false);
    setRosterOpen(false);
    setNutritionOpen(false);
    setLearnOpen(true);
  };

  // Coach dashboard takes over the whole screen (flag `coach`; trainer or admin).
  if (coachOpen) {
    return (
      <>
        <Suspense fallback={<ScreenFallback />}>
          <CoachApp
            role={role === 'admin' ? 'admin' : 'trainer'}
            name={getUsername() ?? ''}
            userId={currentUid() ?? undefined}
            onExitToWorkouts={openGym}
            onOpenProfile={() => openRoster('me')}
            onOpenShell={() => setShellOpen(true)}
          />
        </Suspense>
        {shellOpen && (
          <ShellLauncher
            store={store}
            now={notifNow}
            current="coach"
            peopleLabel={peopleLabel}
            peopleDesc={peopleDesc}
            activeChallenges={activeChallengeCount}
            notifUnread={notifUnread}
            onGym={openGym}
            onApex={openApex}
            onRoster={() => openRoster(rosterHomeFor(role))}
            onNutrition={openNutrition}
            nutritionEnabled={nutritionEnabled}
            onLearn={openLearn}
            onClose={() => setShellOpen(false)}
          />
        )}
      </>
    );
  }

  // Nutrition takes over the whole screen — its own lazurite skin & store.
  if (nutritionOpen && nutritionEnabled) {
    return (
      <AppRoot>
        <Suspense fallback={<ScreenFallback />}>
          <NutritionApp
            now={notifNow}
            onOpenShell={() => setShellOpen(true)}
            onOpenProfile={() => openRoster('me')}
            notifs={notifs}
            notifState={notifState}
            notifUnread={notifUnread}
            onNotifSeen={markNotifsSeen}
            onNotifMarkAll={markAllNotifsSeen}
          />
        </Suspense>
        {shellOpen && (
          <ShellLauncher
            store={store}
            now={notifNow}
            current="nutrition"
            peopleLabel={peopleLabel}
            peopleDesc={peopleDesc}
            activeChallenges={activeChallengeCount}
            notifUnread={notifUnread}
            onGym={openGym}
            onApex={openApex}
            onRoster={() => openRoster(rosterHomeFor(role))}
            onNutrition={() => setShellOpen(false)}
            nutritionEnabled={nutritionEnabled}
            onLearn={openLearn}
            onClose={() => setShellOpen(false)}
          />
        )}
      </AppRoot>
    );
  }

  // Learn (how-to videos) takes over the whole screen — its own rubellite skin.
  if (learnOpen) {
    return (
      <AppRoot>
        <Suspense fallback={<ScreenFallback />}>
          <LearnApp
            now={notifNow}
            role={role}
            onOpenShell={() => setShellOpen(true)}
            onOpenProfile={() => openRoster('me')}
            notifs={notifs}
            notifState={notifState}
            notifUnread={notifUnread}
            onNotifSeen={markNotifsSeen}
            onNotifMarkAll={markAllNotifsSeen}
          />
        </Suspense>
        {shellOpen && (
          <ShellLauncher
            store={store}
            now={notifNow}
            current="learn"
            peopleLabel={peopleLabel}
            peopleDesc={peopleDesc}
            activeChallenges={activeChallengeCount}
            notifUnread={notifUnread}
            onGym={openGym}
            onApex={openApex}
            onRoster={() => openRoster(rosterHomeFor(role))}
            onNutrition={openNutrition}
            nutritionEnabled={nutritionEnabled}
            onLearn={() => setShellOpen(false)}
            onClose={() => setShellOpen(false)}
          />
        )}
      </AppRoot>
    );
  }

  // People (accounts & profiles) takes over the whole screen — its own silver skin.
  if (rosterOpen) {
    return (
      <AppRoot>
        <Suspense fallback={<ScreenFallback />}>
          <RosterApp
            role={rosterRole}
            now={notifNow}
            tab={rosterTab}
            onTab={setRosterTab}
            shell={shell}
            onOpenShell={() => setShellOpen(true)}
            notifs={notifs}
            notifState={notifState}
            notifUnread={notifUnread}
            onNotifSeen={markNotifsSeen}
            onNotifMarkAll={markAllNotifsSeen}
          />
        </Suspense>
        {shellOpen && (
          <ShellLauncher
            store={store}
            now={notifNow}
            current="roster"
            peopleLabel={peopleLabel}
            peopleDesc={peopleDesc}
            activeChallenges={activeChallengeCount}
            notifUnread={notifUnread}
            onGym={openGym}
            onApex={openApex}
            onRoster={() => setShellOpen(false)}
            onNutrition={openNutrition}
            nutritionEnabled={nutritionEnabled}
            onLearn={openLearn}
            onClose={() => setShellOpen(false)}
          />
        )}
      </AppRoot>
    );
  }

  // Apex takes over the whole screen (its own header, nav and amethyst skin).
  if (apexOpen) {
    return (
      <AppRoot>
        <Suspense fallback={<ScreenFallback />}>
          <ApexApp
            store={store}
            now={notifNow}
            tab={apexTab}
            onTab={setApexTab}
            onOpenShell={() => setShellOpen(true)}
            onOpenProfile={() => openRoster('me')}
            notifs={notifs}
            notifState={notifState}
            notifUnread={notifUnread}
            onNotifSeen={markNotifsSeen}
            onNotifMarkAll={markAllNotifsSeen}
          />
        </Suspense>
        {shellOpen && (
          <ShellLauncher
            store={store}
            now={notifNow}
            current="apex"
            peopleLabel={peopleLabel}
            peopleDesc={peopleDesc}
            activeChallenges={activeChallengeCount}
            notifUnread={notifUnread}
            onGym={openGym}
            onApex={() => setShellOpen(false)}
            onRoster={() => openRoster(rosterHomeFor(role))}
            onNutrition={openNutrition}
            nutritionEnabled={nutritionEnabled}
            onLearn={openLearn}
            onClose={() => setShellOpen(false)}
          />
        )}
      </AppRoot>
    );
  }

  const renderOverlay = (activeOverlay: NonNullable<Overlay>) => (
    <Suspense fallback={<ScreenFallback />}>
      {activeOverlay?.screen === 'session' && (
        <SessionView workoutId={activeOverlay.workoutId} shell={shell} onClose={closeOverlay} />
      )}
      {activeOverlay?.screen === 'builder' && (
        <Suspense fallback={null}>
          <SessionBuilderView
            shell={shell}
            programMode={activeOverlay.programMode ?? 'none'}
            programDays={activeOverlay.programDays ?? []}
            onClose={closeOverlay}
          />
        </Suspense>
      )}
      {activeOverlay?.screen === 'log-activity' && (
        <LogActivityView shell={shell} cat={activeOverlay.cat} onClose={closeOverlay} />
      )}
      {activeOverlay?.screen === 'activity' && (
        <ActivityView
          newType={activeOverlay.newType}
          editId={activeOverlay.editId}
          onClose={closeOverlay}
        />
      )}
      {activeOverlay?.screen === 'sleep' && (
        <Suspense fallback={null}>
          <SleepView
            wake={activeOverlay.wake}
            mode={activeOverlay.mode}
            nightId={activeOverlay.nightId}
            onClose={closeOverlay}
          />
        </Suspense>
      )}
      {activeOverlay?.screen === 'past-workout' && (
        <SessionView
          workoutId={activeOverlay.workoutId}
          past
          startAdd={activeOverlay.startAdd}
          shell={shell}
          onClose={() => {
            // Leaving without Save discards the draft: a fresh backfill is
            // dropped, an edited existing session reverts. Saving happens via the
            // in-editor Save button (which clears the draft first, so this no-ops).
            discardPastWorkout(activeOverlay.workoutId);
            closeOverlay();
          }}
        />
      )}
      {activeOverlay?.screen === 'exercise-history' && (
        <ExerciseHistoryView
          name={activeOverlay.name}
          userId={activeOverlay.userId}
          userName={activeOverlay.userName}
          shell={shell}
          onClose={closeOverlay}
        />
      )}
      {activeOverlay?.screen === 'trainee-session' && (
        <TraineeSessionView
          athleteId={activeOverlay.athleteId}
          workoutId={activeOverlay.workoutId}
          athleteName={activeOverlay.athleteName}
          shell={shell}
          onClose={closeOverlay}
        />
      )}
      {activeOverlay?.screen === 'exercise-detail' && (
        <ExerciseDetailView name={activeOverlay.name} shell={shell} onClose={closeOverlay} />
      )}
      {activeOverlay?.screen === 'muscle-history' && (
        <MuscleHistoryView muscle={activeOverlay.muscle} shell={shell} onClose={closeOverlay} />
      )}
      {activeOverlay?.screen === 'settings' && role === 'admin' && (
        <SettingsView onClose={closeOverlay} />
      )}
      {activeOverlay?.screen === 'themes' && <ThemesView onClose={closeOverlay} />}
      {activeOverlay?.screen === 'history' && (
        <HistoryListView shell={shell} onClose={closeOverlay} />
      )}
      {activeOverlay?.screen === 'notifications' && (
        <NotificationsView
          notifs={notifs}
          now={notifNow}
          state={notifState}
          onSeen={markNotifsSeen}
          onMarkAll={markAllNotifsSeen}
          onClose={closeOverlay}
          onOpenRecap={(period, story) =>
            setOverlay({ screen: story ? 'recap-story' : 'recap', period })
          }
        />
      )}
      {activeOverlay?.screen === 'recap' && (
        <RecapView
          period={activeOverlay.period}
          desktop
          onStory={() => setOverlay({ screen: 'recap-story', period: activeOverlay.period })}
          onClose={closeOverlay}
        />
      )}
      {activeOverlay?.screen === 'recap-story' && (
        <RecapStory period={activeOverlay.period} onClose={closeOverlay} />
      )}
      {activeOverlay?.screen === 'gym' && (
        <GymDetailView
          gymId={activeOverlay.gymId}
          candName={activeOverlay.name}
          candLat={activeOverlay.lat}
          candLng={activeOverlay.lng}
          candAddress={activeOverlay.address}
          candExternalId={activeOverlay.externalId}
          candAmenities={activeOverlay.amenities}
          shell={shell}
          onClose={closeOverlay}
        />
      )}
      {activeOverlay?.screen === 'equipment' && (
        <EquipmentDetailView
          itemId={activeOverlay.itemId}
          gymId={activeOverlay.gymId}
          shell={shell}
          onClose={closeOverlay}
        />
      )}
      {activeOverlay?.screen === 'profile' && (
        <ProfileView userId={activeOverlay.userId} shell={shell} onClose={closeOverlay} />
      )}
      {activeOverlay?.screen === 'client-coach' && (
        <Suspense fallback={null}>
          <ClientRoutesLazy route={activeOverlay.route} onClose={closeOverlay} />
        </Suspense>
      )}
      {activeOverlay?.screen === 'mastery' && <MasteryView shell={shell} onClose={closeOverlay} />}
      {activeOverlay?.screen === 'coach' && (
        <CoachView
          onClose={closeOverlay}
          onOpenSession={(workoutId) => shell.openOverlay({ screen: 'session', workoutId })}
        />
      )}
      {activeOverlay?.screen === 'injury' && (
        <InjuryView
          injuryId={activeOverlay.injuryId}
          checkin={activeOverlay.checkin}
          prefill={activeOverlay.prefill}
          onClose={closeOverlay}
        />
      )}
      {activeOverlay?.screen === 'health' && (
        <HealthView
          shell={shell}
          view={activeOverlay.view}
          hist={activeOverlay.hist}
          form={activeOverlay.form}
          cond={activeOverlay.cond}
          condKey={activeOverlay.condKey}
          nic={activeOverlay.nic}
          alc={activeOverlay.alc}
          sup={activeOverlay.sup}
          cyc={activeOverlay.cyc}
          priv={activeOverlay.priv}
          onClose={closeOverlay}
        />
      )}
      {activeOverlay?.screen === 'home-set' && (
        <HomeSetView
          shell={shell}
          page={activeOverlay.page}
          id={activeOverlay.id}
          tab={activeOverlay.tab}
          pick={activeOverlay.pick}
          onClose={closeOverlay}
        />
      )}
      {UiKitGallery && activeOverlay?.screen === 'uikit' && <UiKitGallery onClose={closeOverlay} />}
      {WidgetLibraryScreen && activeOverlay?.screen === 'widget-library' && (
        <WidgetLibraryScreen shell={shell} onClose={closeOverlay} />
      )}
    </Suspense>
  );
  const overlayContent = activeOverlay ? renderOverlay(activeOverlay) : null;
  // What a back-swipe reveals: the parent overlay when there is one, else the tab.
  const parentOverlay = activeOverlay ? overlayBack(overlayNav).cur : null;
  const tabContent = (
    <Suspense fallback={<ScreenFallback />}>
      {effectiveTab === 'today' && <TodayView shell={shell} store={store} />}
      {effectiveTab === 'overview' && (
        <OverviewView
          shell={shell}
          onProgress={(seg) => {
            setProgressSub('progress');
            setProgressSeg(seg);
            setVolumeLens('volume');
            setTab('progress');
          }}
          onTrends={() => {
            setProgressSub('trends');
            setTab('progress');
          }}
          onActivity={() => {
            setProgressSub('activity');
            setTab('progress');
          }}
          onPrograms={goProgramsPeer}
        />
      )}
      {effectiveTab === 'progress' && (
        <ProgressView
          store={store}
          shell={shell}
          sub={progressSub}
          seg={progressSeg}
          onSeg={setProgressSeg}
          lens={volumeLens}
          onLens={setVolumeLens}
        />
      )}
      {effectiveTab === 'gyms' && <GymsView shell={shell} store={store} />}
      {effectiveTab === 'programs' &&
        (programsPeer === 'exercises' ? (
          <ExerciseLibraryView
            shell={shell}
            libTab={libMine ? 'mine' : 'library'}
            onLibTab={(next) => setLibMine(next === 'mine')}
          />
        ) : programsPeer === 'playbook' ? (
          <PlaybookView shell={shell} />
        ) : programsPeer === 'goals' ? (
          <GoalsView />
        ) : (
          <ProgramsView shell={shell} onProgramsTab={goProgramsPeer} />
        ))}
    </Suspense>
  );

  return (
    <div className="app">
      {nightLive && <SpotterSky />}
      <SleepAutomation onOpenSchedule={() => setOverlay({ screen: 'sleep', mode: 'schedule' })} />
      <SleepPauseController onSleepScreen={!!nightLive && activeOverlay?.screen === 'sleep'} />
      {desktopRail && (
        <GymRail
          tab={effectiveTab}
          overlayOpen={activeOverlay !== null}
          goTab={goTab}
          onStart={() => setStartOpen(true)}
          openWorkoutStartedAt={open?.startedAt}
          syncStatus={store.syncStatus}
          notifUnread={notifUnread}
          onOpenShell={() => setShellOpen(true)}
          onOpenNotifications={() => setOverlay({ screen: 'notifications' })}
          onOpenProfile={() => setOverlay({ screen: 'profile', userId: 'me' })}
          onOpenSettings={() => setOverlay({ screen: 'settings' })}
          onOpenMastery={() => setOverlay({ screen: 'mastery' })}
          onOpenHealth={() => setOverlay({ screen: 'health' })}
        />
      )}
      <div className="main-col">
        {!desktopRail && (
          <BrandBar
            avatar={<BrandAccount app="gym" />}
            app={t.shellGym}
            onApp={() => setShellOpen(true)}
            appLabel={t.shellSwitch}
            actions={
              <>
                <ConditionsShield onOpen={() => setOverlay({ screen: 'health' })} />
                <Suspense fallback={null}>
                  <MasteryBadge onOpen={() => setOverlay({ screen: 'mastery' })} />
                </Suspense>
                <BellButton
                  label={t.notifTitle}
                  onClick={() => setOverlay({ screen: 'notifications' })}
                  count={notifUnread}
                />
              </>
            }
          />
        )}
        {store.syncStatus === 'failed' && (
          <SyncBlockedCard
            error={store.syncError}
            onRetry={retrySync}
            onDiscard={discardBlockingChange}
          />
        )}
        {nightLive && activeOverlay?.screen !== 'sleep' && (
          <SleepHero
            night={nightLive}
            onResume={() => setOverlay({ screen: 'sleep' })}
            onStop={() => setOverlay({ screen: 'sleep', wake: true })}
          />
        )}
        {liveAct && activeOverlay?.screen !== 'activity' && (
          <ActivityHero activity={liveAct} onOpen={() => setOverlay({ screen: 'activity' })} />
        )}
        {open && activeOverlay?.screen !== 'session' && (
          <LiveHero
            workout={open}
            gym={store.gyms.find((g) => g.id === open.gymId) ?? null}
            gyms={store.gyms}
            offline={store.syncStatus === 'offline'}
            queued={store.queue.length}
            onResume={() => setOverlay({ screen: 'session', workoutId: open.id })}
            mode="compact"
          />
        )}
        {/* the one <main> landmark of the Gym shell (WCAG 1.3.1 / axe region); no visual change */}
        <main className="screen-stage" ref={stageRef} data-back-swipe={backSwipe ? '' : undefined}>
          {(!activeOverlay || backSwipe) && (
            <div className="stage-layer under-layer" ref={underLayerRef}>
              {parentOverlay && parentOverlay.screen !== 'session'
                ? renderOverlay(parentOverlay)
                : tabContent}
            </div>
          )}
          {activeOverlay && (
            <div className="stage-layer over-layer" ref={overLayerRef}>
              {overlayContent}
            </div>
          )}
          {backSwipe && <div className="stage-scrim" ref={scrimRef} aria-hidden />}
        </main>
        {showTabbar && (
          <SuiteTabBar
            app="gym"
            items={tabs.map((x) => ({
              ...x,
              active: navActive(x.id, effectiveTab),
              // unread messages from my trainer sit on Today (R-KIT-21); nothing without a trainer
              ...(x.id === 'today' && clientShared.unread > 0
                ? {
                    badge: clientShared.unread,
                    ariaLabel: `${x.label}, ${clientShared.unreadLabel || clientShared.unread}`,
                  }
                : {}),
            }))}
            onSelect={goTab}
            onOpenShell={() => setShellOpen(true)}
            onOpenProfile={() => setOverlay({ screen: 'profile', userId: 'me' })}
            fab={{
              ariaLabel: t.startNew,
              onClick: () => setStartOpen(true),
              attention: !trainedToday,
            }}
          />
        )}
        {authed && <ClientBridgeLazy />}
        <div className="toast-holder">
          {authed && notices.some((n) => !n.read) && (
            <NoticeStrip notices={notices.filter((n) => !n.read)} onDismiss={dismissNotice} />
          )}
          {updateReady && <UpdatePlate onReload={() => void reloadToLatest()} />}
          {rankUp && (
            <Suspense fallback={null}>
              <MasteryRankUp
                m={rankUp}
                onClose={() => setRankUp(null)}
                onSeeNext={() => {
                  setRankUp(null);
                  setOverlay({ screen: 'mastery' });
                }}
              />
            </Suspense>
          )}
          {snack && <UndoSnackbar key={snack.id} snack={snack} onDone={() => setSnack(null)} />}
          {toasts.map((tst) => (
            <Toast key={tst.id} toast={tst} id={tst.id} onExpire={removeToast} />
          ))}
        </div>
      </div>
      {startOpen && (
        <Suspense fallback={null}>
          <StartSheet shell={shell} onClose={() => setStartOpen(false)} />
        </Suspense>
      )}
      {shellOpen && (
        <ShellLauncher
          store={store}
          now={notifNow}
          current="gym"
          peopleLabel={peopleLabel}
          peopleDesc={peopleDesc}
          activeChallenges={activeChallengeCount}
          notifUnread={notifUnread}
          onGym={() => setShellOpen(false)}
          onApex={() => {
            setApexTab('home');
            openApex();
          }}
          onRoster={() => openRoster(rosterHomeFor(role))}
          onNutrition={openNutrition}
          nutritionEnabled={nutritionEnabled}
          onLearn={openLearn}
          onClose={() => setShellOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * Code-split screen placeholder: a skeleton of a typical screen, never a spinner
 * and never a "Syncing" screen. It only shows while a lazy chunk loads (the app
 * shell is precached, so this is instant after the first visit, also offline);
 * app data is not awaited here — screens render from the local cache.
 */
function ScreenFallback() {
  const { t } = useT();
  return <ScreenSkeleton label={t.loadingApp} />;
}

function getDesktopRailMatch(): boolean {
  // Dev/QA override: force a layout regardless of viewport (used to verify the
  // mobile design in tooling whose capture viewport is fixed). Harmless in prod.
  try {
    const f = localStorage.getItem('spotter.forceLayout');
    if (f === 'mobile') return false;
    if (f === 'desktop') return true;
  } catch {
    /* ignore */
  }
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia &&
    window.matchMedia('(min-width: 720px)').matches
  );
}

function useDesktopRail(): boolean {
  const [matches, setMatches] = useState(getDesktopRailMatch);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(min-width: 720px)');
    const onChange = () => setMatches(getDesktopRailMatch());
    onChange();
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return matches;
}

/**
 * Desktop rail (W-04): 206px, brand, labeled nav, and an account chip at the
 * foot. During a live session the foot also carries the in-session chip (W-06).
 * Hidden under 720px.
 */
export function GymRail(props: {
  tab: Tab;
  overlayOpen: boolean;
  goTab: (t: Tab) => void;
  onStart: () => void;
  openWorkoutStartedAt?: number;
  syncStatus: ReturnType<typeof useStore>['syncStatus'];
  notifUnread: number;
  onOpenShell: () => void;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onOpenMastery: () => void;
  onOpenHealth: () => void;
}) {
  const { t } = useT();
  const live = props.openWorkoutStartedAt !== undefined;
  const role = getRole();
  const nav = tabsForRole(role, t);
  const { unread: trainerUnread, unreadLabel: clientSharedLabel } = useClientShared();

  // A warning dot on the avatar only while offline / sync failed: presence ("online") is implied
  // by the app being open, so no green dot.
  const warnColor =
    props.syncStatus === 'offline' || props.syncStatus === 'failed'
      ? 'var(--color-danger)'
      : undefined;
  const conditions = useActiveConditions();

  return (
    <AppRail
      app="gym"
      nav={nav.map((x) => ({
        ...x,
        live: x.id === 'today' && live,
        ...(x.id === 'today' && trainerUnread > 0
          ? { count: trainerUnread, countLabel: clientSharedLabel || String(trainerUnread) }
          : {}),
      }))}
      activeId={
        props.overlayOpen ? null : (nav.find((x) => navActive(x.id, props.tab))?.id ?? null)
      }
      onNav={(id) => props.goTab(id as Tab)}
      onOpenShell={props.onOpenShell}
      onOpenNotifications={props.onOpenNotifications}
      onOpenProfile={props.onOpenProfile}
      notifUnread={props.notifUnread}
      syncColor={warnColor}
      // Foot extras, top to bottom; the bottom-most collapse into More first.
      extrasBefore={[
        ...(conditions > 0
          ? [
              {
                id: 'conditions',
                label: t.cndTodayTitle(conditions),
                icon: 'shield-check',
                onSelect: props.onOpenHealth,
                node: <ConditionsShield variant="rail" onOpen={props.onOpenHealth} />,
              },
            ]
          : []),
        {
          id: 'mastery',
          label: t.masteryTitle,
          icon: 'medal',
          onSelect: props.onOpenMastery,
          node: (
            <div className="rail-mastery">
              <Suspense fallback={null}>
                <MasteryBadge onOpen={props.onOpenMastery} variant="rail" />
              </Suspense>
            </div>
          ),
        },
      ]}
      extrasAfter={
        role === 'admin'
          ? [
              {
                id: 'settings',
                label: t.settingsTitle,
                icon: 'gear',
                onSelect: props.onOpenSettings,
              },
            ]
          : []
      }
    />
  );
}

/** Persistent blocked-queue card: plain reason, raw status line, Retry + Discard (AC-SYNC-05). */
function SyncBlockedCard(props: {
  error: SyncError | null;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const { t } = useT();
  return (
    <div className="sync-blocked" role="alert">
      <div className="sync-blocked-head">
        <Icon name="cloud-slash" />
        <div>
          <h4 className="t">{t.syncBlockedTitle}</h4>
          <p className="s">{t.syncBlockedBody}</p>
        </div>
      </div>
      {props.error && <code className="sync-blocked-line">{props.error.statusLine}</code>}
      <div className="sync-blocked-actions">
        <Button variant="secondary" size="sm" onClick={props.onDiscard}>
          {t.syncDiscard}
        </Button>
        <Button variant="fill" size="sm" onClick={props.onRetry}>
          {t.retry}
        </Button>
      </div>
    </div>
  );
}

function noticeIcon(kind: string): string {
  if (kind.startsWith('program')) return 'copy';
  if (kind.startsWith('role')) return 'shield-check';
  return 'barbell';
}

/** In-product notices strip: assignment, role and trainer changes (AC-ROLE-10, AC-PLAN-11). */
function NoticeStrip(props: { notices: Notice[]; onDismiss: (id: string) => void }) {
  const { t } = useT();
  return (
    <>
      {props.notices.map((n) => (
        <div key={n.id} className="notice" role="status">
          <Icon name={noticeIcon(n.kind)} />
          <span className="notice-text">{t.noticeText(n.kind, n.actor, n.detail)}</span>
          <IconButton icon="x" size="sm" label={t.dismiss} onClick={() => props.onDismiss(n.id)} />
        </div>
      ))}
    </>
  );
}
