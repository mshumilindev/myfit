/**
 * Coach "Decisions" (receipts) list strings. Own dictionary (like coachRoster / coachToday); read through
 * `useDecisionsT()` in `coachDecisions.ts`. Outcome words (Improved / Measuring / ...) come from the Today
 * dictionary so they cannot drift. Every key is mirrored in uk / pl / lt / et (`typeof decisionsEn`).
 */
import { plural } from './coachPlural';

const decN = (n: number) => plural('en', n, { one: '{n} decision', other: '{n} decisions' });

export const decisionsEn = {
  dcTitle: 'Decisions',
  dcGroupBy: 'Group by',
  dcGroupNone: 'No grouping',
  dcGroupClient: 'Client',
  dcGroupResult: 'Result',
  dcGroupTrigger: 'Trigger',
  dcGroupMonth: 'Month',
  dcGrouped: 'Grouped by',
  dcCount: decN,
  dcBig: (improved: number, total: number) => `${improved} of ${total}`,
  dcBigRest: (pct: number) => `decisions improved (${pct}%)`,
  dcHistory: 'History',
  dcSearch: 'Search decisions',
  dcClearSearch: 'Clear search',
  dcFilterLabel: 'Show decisions',
  dcAll: 'All',
  dcExport: 'Export',
  dcExportSoon: 'Export arrives with the next update',
  dcEmptyH: 'No decisions yet',
  dcEmptyBody: 'When you decide on a signal, it is saved here with its result.',
  dcToAgenda: 'Go to Agenda',
  dcNoMatch: 'No decisions match',
  dcClear: 'Clear filters',
  dcOpen: (name: string) => `Open ${name}`,
  dcList: 'Decisions list',
  dcMore: (n: number, left: number) => `Show ${n} more · ${left} left`,
  dcLoading: 'Loading decisions',
  dcWaiting: 'Waiting',
  dcFailTitle: 'Decisions did not load',
  dcFailBody: 'Check your connection and try again.',
  dcTryAgain: 'Try again',
};
