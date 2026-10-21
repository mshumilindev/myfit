/**
 * The desktop rail of every app in the suite (Gym, Apex, People, Nutrition, Learn and Coach): the kit `Rail`
 * with ONE shared foot (SPO-234 / SPO-235). Top to bottom: the app's own extras (`footBefore`), the notifications
 * bell (client apps only), more app extras (`footAfter`), the language, Apps, the avatar. Apps and the avatar are
 * pinned and never collapse; everything above them collapses into the rail's More item first (all at once), then
 * the nav entries from the end. The language row in More opens a language list (SPO-186).
 *
 * Apps without a bell (People, Coach) show the shared feed's unread count on the Apps button instead
 * (`appsUnread`), so nothing new goes unseen.
 */
import { FLAGS, LOCALE_IDS, LOCALES, setLocale, useT } from '../../i18n';
import { useCoachT } from '../../i18n/coach';
import { LanguageSelector } from '../../ui';
import { SpotterMark } from '../../brand/SpotterMark';
import { badgeText } from '../ui/Badge';
import { COACH_WIDE_BREAKPOINT, useMinWidth } from '../ui/breakpoints';
import { MoreMenu } from '../ui/MoreMenu';
import { Rail } from '../ui/Rail';
import type { RailEntry, RailFootEntry } from '../ui/railOverflow';
import { SuiteRailFoot } from './SuiteRailFoot';
import type { SuiteApp, SuiteIdentity } from './useSuiteAccount';

/** The shared language foot entry: the flag chip while visible, a language list inside More. */
export function useLanguageFootEntry(): RailFootEntry {
  const { locale } = useT();
  return {
    id: 'language',
    label: LOCALES[locale].language,
    icon: 'globe',
    node: <LanguageSelector compact />,
    onSelect: () => undefined,
    submenu: {
      title: LOCALES[locale].language,
      value: locale,
      options: LOCALE_IDS.map((id) => ({
        id,
        label: LOCALES[id].locale,
        icon: <span aria-hidden>{FLAGS[id]}</span>,
      })),
      onChange: (id) => setLocale(id as (typeof LOCALE_IDS)[number]),
    },
  };
}

export function SuiteRail({
  app,
  nav,
  footBefore,
  footAfter,
  bell,
  appsUnread,
  breakpoint,
  identity,
  syncColor,
  onOpenShell,
  onOpenProfile,
  onOpenGym,
}: {
  app: SuiteApp;
  /** Nav destinations top to bottom (the trailing ones collapse into More on a short rail). */
  nav: RailEntry[];
  /** App-specific foot extras above the bell (Gym: conditions shield, Mastery). */
  footBefore?: RailFootEntry[];
  /** App-specific foot extras between the bell and the language (Gym: admin settings). */
  footAfter?: RailFootEntry[];
  /** The bell, client apps only (Gym, Apex, Nutrition, Learn); omitted = no bell. */
  bell?: { onOpen: () => void; unread: number };
  /** Unread of the shared feed on the Apps button, for apps without a bell. */
  appsUnread?: number;
  /** Rail size switch (Coach uses its own). */
  breakpoint?: 'coach';
  identity?: SuiteIdentity;
  /** Warning dot on the avatar (Gym: offline / sync failed). */
  syncColor?: string;
  onOpenShell: () => void;
  onOpenProfile?: () => void;
  onOpenGym?: () => void;
}) {
  const { t } = useT();
  const { c } = useCoachT();
  const wide = useMinWidth(COACH_WIDE_BREAKPOINT);
  const language = useLanguageFootEntry();

  const footEntries: RailFootEntry[] = [
    ...(footBefore ?? []),
    ...(bell
      ? [
          {
            id: 'notifications',
            label: t.notifTitle,
            icon: 'bell',
            fill: true,
            onSelect: bell.onOpen,
            badge: badgeText(bell.unread) || null,
            count: bell.unread,
            countLabel: c.unread(bell.unread),
          },
        ]
      : []),
    ...(footAfter ?? []),
    language,
  ];

  return (
    <Rail
      brand={<SpotterMark size={40} variant="sidebar" />}
      labelled={wide}
      compact={!wide}
      breakpoint={breakpoint}
      ariaLabel={c.navLandmark}
      overflow={{
        entries: nav,
        footEntries,
        moreLabel: c.navMore,
        moreCountLabel: c.unread,
        renderMenu: ({ hiddenNav, hiddenFoot, open, onClose, anchorRef }) => (
          <MoreMenu
            presentation="popover"
            open={open}
            onClose={onClose}
            anchorRef={anchorRef}
            title={c.navMore}
            items={hiddenNav}
            extraItems={hiddenFoot}
          />
        ),
      }}
      foot={
        <SuiteRailFoot
          app={app}
          identity={identity}
          appsUnread={appsUnread}
          warnColor={syncColor}
          onOpenShell={onOpenShell}
          onOpenProfile={onOpenProfile}
          onOpenGym={onOpenGym}
        />
      }
    />
  );
}
