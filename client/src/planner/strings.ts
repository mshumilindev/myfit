import type { LocaleId } from '../i18n';

export interface PlannerStrings {
  name: string;
  emptyTitle: string;
  emptyBody: string;
}

/** Planner's own words live in its chunk, not in the core i18n (add-on boundary). */
export const STRINGS: Record<LocaleId, PlannerStrings> = {
  en: {
    name: 'Planner',
    emptyTitle: 'No plans yet',
    emptyBody:
      'Add a plan and Spotter reminds you before it starts. Nothing is added to your history.',
  },
  uk: {
    name: 'Планувальник',
    emptyTitle: 'Планів ще немає',
    emptyBody:
      'Додайте план, і Spotter нагадає перед його початком. Нічого не додається до вашої історії.',
  },
  pl: {
    name: 'Planer',
    emptyTitle: 'Nie ma jeszcze planów',
    emptyBody:
      'Dodaj plan, a Spotter przypomni o nim przed startem. Nic nie trafia do Twojej historii.',
  },
  lt: {
    name: 'Planuoklis',
    emptyTitle: 'Planų dar nėra',
    emptyBody:
      'Pridėkite planą, o Spotter primins prieš jam prasidedant. Niekas nepridedama prie jūsų istorijos.',
  },
  et: {
    name: 'Planeerija',
    emptyTitle: 'Plaane pole veel',
    emptyBody:
      'Lisa plaan ja Spotter tuletab seda enne algust meelde. Midagi ei lisata sinu ajalukku.',
  },
};
