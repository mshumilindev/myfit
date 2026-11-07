/**
 * What More holds in EVERY app of the suite (owner rule 06.11.2026): "Add-ons" (the store; not for a manager, who has none), "Themes" (once a second look is installed),
 * "Privacy and sharing" and the language. Gym passes its own
 * opener; the other apps leave the app through the shared route, which opens the same Privacy page (`#/more/privacy`).
 */
import { FLAGS, LOCALE_IDS, LOCALES, setLocale, useT } from '../../i18n';
import { getRole } from '../../api';
import { useThemesOn } from '../../themes/useThemeAccess';
import { setHash } from '../../route';
import { storeHash } from '../../addonStore/storeRoute';
import type { MoreMenuItem } from '../ui/MoreMenu';

export function useCommonMoreItems(onPrivacy?: () => void): MoreMenuItem[] {
  const { t, locale } = useT();
  const themesOn = useThemesOn();
  return [
    ...(getRole() === 'manager'
      ? []
      : [
          {
            id: 'addons',
            icon: 'addons',
            label: t.todayAddons,
            onSelect: () => setHash(storeHash('discover')),
          },
        ]),
    // Themes shows once a second look is installed; it opens the themes page (`#/themes`).
    ...(themesOn
      ? [
          {
            id: 'themes',
            icon: 'palette',
            label: t.todayThemes,
            onSelect: () => setHash('#/themes'),
          },
        ]
      : []),
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
