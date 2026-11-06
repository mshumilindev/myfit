/**
 * Gym's phone chrome (top bar + bottom bar), kept out of App.tsx. The header is the shared `BrandBar`: the
 * health shield (only while a condition is active) and the language collapse out of it when it is tight and
 * continue in the bottom bar's More. The bottom bar has a Mastery tab while the header has room; once something
 * has collapsed, that slot is More = Mastery + the collapsed controls. The account is the avatar's drawer.
 */
import { useCommonMoreItems } from './commonMore';
import { useT } from '../../i18n';
import { ConditionsShield, useActiveConditions } from '../../views/health/ConditionsShield';
import { BrandBar, BellButton } from '../ui/BrandBar';
import type { MoreMenuItem } from '../ui/MoreMenu';
import { BrandAccount } from './BrandAccount';
import { SUITE_ICON, SUITE_TONE } from './suiteTone';
import { SuiteTabBar } from '../SuiteTabBar';
import type { TabBarItem, TabBarProps } from '../ui/TabBar';
import { useAddonOrBase } from '../../addons/enabledSet';
import './GymChrome.css';

export function GymBrandBar({
  notifUnread,
  onApp,
  onProfile,
  onHealth,
  onNotifications,
  onHiddenChange,
}: {
  notifUnread: number;
  onApp: () => void;
  onProfile: () => void;
  onHealth: () => void;
  onNotifications: () => void;
  onHiddenChange: (hidden: MoreMenuItem[]) => void;
}) {
  const { t } = useT();
  const conditions = useActiveConditions();
  return (
    <BrandBar
      avatar={<BrandAccount app="gym" onOpenProfile={onProfile} />}
      onHiddenChange={onHiddenChange}
      app={t.shellGym}
      onApp={onApp}
      appLabel={t.shellSwitch}
      tone={SUITE_TONE.gym}
      icon={SUITE_ICON.gym}
      entries={
        conditions > 0
          ? [
              {
                id: 'conditions',
                label: t.cndTodayTitle(conditions),
                icon: 'shield-check',
                node: <ConditionsShield onOpen={onHealth} />,
                onSelect: onHealth,
              },
            ]
          : []
      }
      actions={<BellButton label={t.notifTitle} onClick={onNotifications} count={notifUnread} />}
    />
  );
}

export function GymTabBar<Id extends string>({
  items,
  hidden,
  mastery,
  onMastery,
  onPrivacy,
  onSelect,
  fab,
}: {
  items: TabBarItem<Id>[];
  /** Header controls that collapsed out of the BrandBar (the More menu lists them after Mastery). */
  hidden: MoreMenuItem[];
  /** Mastery page open (its tab is lit). */
  mastery: boolean;
  onMastery: () => void;
  /** Opens "Privacy and sharing" (consents, documents, sharing, health-data deletion) — it lives in More, not in Health. */
  onPrivacy: () => void;
  onSelect: (id: Id) => void;
  fab: TabBarProps<Id>['fab'];
}) {
  const { t } = useT();
  const common = useCommonMoreItems(onPrivacy);
  // Mastery is an add-on (SPO-518): its tab and menu entry only exist when it is installed (or not offered to the role).
  const masteryOn = useAddonOrBase('mastery');
  // More is always the last tab (it keeps the slot, so the bar never changes shape): Privacy and sharing, then Mastery when
  // it is installed, then the header controls that collapsed.
  return (
    <SuiteTabBar<Id | 'mastery'>
      app="gym"
      noAccount
      moreItems={[
        ...common,
        ...(masteryOn
          ? [
              {
                id: 'mastery',
                icon: 'medal',
                label: t.masteryTitle,
                onSelect: onMastery,
                active: mastery,
              },
            ]
          : []),
        ...hidden,
      ]}
      items={items}
      onSelect={(id) => onSelect(id as Id)}
      fab={fab}
    />
  );
}
