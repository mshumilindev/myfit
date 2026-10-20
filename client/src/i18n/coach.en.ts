/** Coach strings (English, the base). Every key is mirrored in uk / pl / lt / et. */
import { plural } from './coachPlural';

const unread = (n: number) => plural('en', n, { one: '{n} unread', other: '{n} unread' });

export const coachEn = {
  // Navigation (rail tooltips, tab bar, More sheet)
  navAgenda: 'Agenda',
  navClients: 'Clients',
  navSchedule: 'Schedule',
  navWeek: 'Week',
  navDecisions: 'Decisions',
  navPrograms: 'Programs',
  navChat: 'Chat',
  navTeam: 'Team',
  navMore: 'More',
  navLandmark: 'Coach navigation',
  skipToContent: 'Skip to content',
  navLive: 'Live',
  navSignals: 'Signals',
  navApps: 'Apps',

  // Shell (M0)
  shellDesc: 'Your clients, programs and schedule',
  modeNote:
    "Your own workouts stay private. When you open a client's data, the client can see that you read it.",
  roleTrainer: 'Trainer',
  roleAdmin: 'Admin',
  moreProfile: 'Profile',
  emptyTitle: 'Nothing here yet',
  emptyBody: 'This screen is on the way.',
  screenFailedTitle: 'This screen did not open',
  screenFailedBody: 'Nothing was changed. The rest of the dashboard still works.',
  screenFailedRetry: 'Try again',
  clientTitle: 'Client',
  backToClients: 'All clients',
  drawerClose: 'Close',

  // Mode switch
  modeCoach: 'Coach',
  modeMyWorkouts: 'My workouts',
  modeLabel: 'Mode',
  railProfile: 'Profile and mode',
  railNotifications: 'Notifications',

  // Counts (aria labels; the visible badge shows 1..9 or 9+)
  unread,
  railLive: (n: number) => plural('en', n, { one: '{n} live', other: '{n} live' }),
  navWithUnread: (label: string, n: number) => `${label}, ${unread(n)}`,
};
