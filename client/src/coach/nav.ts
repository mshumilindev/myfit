import type { CoachStrings } from '../i18n/coach';
import type { CoachRoute, CoachScreen } from './routes';

/** Icons from the app registry (`ICONS` in ui.tsx); `envelope` stands in for chat until a chat icon is added there. */
export const SCREEN_ICON: Record<CoachScreen, string> = {
  agenda: 'calendar-check',
  clients: 'user-focus',
  schedule: 'calendar-blank',
  week: 'calendar-dots',
  decisions: 'check-circle',
  programs: 'list-checks',
  chat: 'envelope',
  signals: 'pulse',
  live: 'heartbeat',
};

export function screenLabel(c: CoachStrings, screen: CoachScreen): string {
  switch (screen) {
    case 'agenda':
      return c.navAgenda;
    case 'clients':
      return c.navClients;
    case 'schedule':
      return c.navSchedule;
    case 'week':
      return c.navWeek;
    case 'decisions':
      return c.navDecisions;
    case 'programs':
      return c.navPrograms;
    case 'chat':
      return c.navChat;
    case 'signals':
      return c.navSignals;
    case 'live':
      return c.navLive;
  }
}

export function routeTitle(c: CoachStrings, route: CoachRoute): string {
  return route.screen === 'client' ? c.clientTitle : screenLabel(c, route.screen);
}
