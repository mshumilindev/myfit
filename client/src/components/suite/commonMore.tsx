/**
 * What More holds in EVERY app of the suite (owner rule 06.11.2026): "Privacy and sharing" and the language. Gym passes its own
 * opener; the other apps leave the app through the shared route, which opens the same Privacy page (`#/more/privacy`).
 */
import { FLAGS, LOCALE_IDS, LOCALES, setLocale, useT } from '../../i18n';
import { setHash } from '../../route';
import type { MoreMenuItem } from '../ui/MoreMenu';

export function useCommonMoreItems(onPrivacy?: () => void): MoreMenuItem[] {
  const { t, locale } = useT();
  return [
    {
      id: 'privacy',
      icon: 'lock',
      label: t.hlPrivRow,
      onSelect: onPrivacy ?? (() => setHash('#/more/privacy')),
    },
    {
      id: 'language',
      icon: 'globe',
      label: LOCALES[locale].language,
      onSelect: () => undefined,
      submenu: {
        title: LOCALES[locale].language,
        value: locale,
        options: LOCALE_IDS.map((id) => ({
          id,
          label: LOCALES[id].locale,
          icon: <span aria-hidden>{FLAGS[id]}</span>,
        })),
        onChange: (id: string) => setLocale(id as (typeof LOCALE_IDS)[number]),
      },
    },
  ];
}
