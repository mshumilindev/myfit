/**
 * Programs list strings (Coach, S-21). Separate dictionary like coachLive / coachChat. Every key is mirrored in
 * uk / pl / lt / et.
 */
import { plural } from './coachPlural';

const progN = (n: number) => plural('en', n, { one: '{n} program', other: '{n} programs' });
const clientN = (n: number) => plural('en', n, { one: '{n} client', other: '{n} clients' });

export const programsEn = {
  pgTitle: 'Programs',
  pgSubtitle: (programs: number, clients: number) => `${progN(programs)}, ${clientN(clients)}`,
  pgListLabel: 'Programs',
  pgSearch: 'Search programs',
  pgSearchClear: 'Clear search',
  pgNew: 'New program',
  pgNewTitle: 'Who is the new program for?',
  pgNewBody:
    'Programs are written per client. Pick the client and start from a template or from another day.',
  pgNewLabel: 'Choose a client for a new program',
  pgClientsLine: (n: number, names: string) => `${clientN(n)}: ${names}`,
  pgNamesMore: (names: string, more: number) => `${names} +${more}`,
  pgFollow: (n: number) =>
    plural('en', n, {
      one: '{n} client follows this program.',
      other: '{n} clients follow this program.',
    }),
  pgClientsLabel: 'Clients on this program',
  pgWeekWith: (week: number, days: string) => `Week ${week} · with trainer ${days}`,
  pgWeekSolo: (week: number) => `Week ${week} · solo`,
  pgOpenEditor: 'Open in editor',
  pgOpenFor: (name: string) => `Open ${name} in the editor`,
  pgSharedTitle: 'Shared program',
  pgKeeps: (names: string, v: number) => `${names} keeps v${v} until you copy a newer version.`,
  pgBack: 'Programs',
  pgNoneH: 'No programs yet',
  pgNoneB: 'Create one or copy a template.',
  pgNoMatchH: 'No program matches',
  pgNoMatchB: 'Try another word or clear the search.',
  pgFailTitle: 'Programs did not load',
  pgFailBody: 'Check your connection and try again.',
  pgRetry: 'Try again',
};

export type ProgramsStrings = typeof programsEn;
