/**
 * Where Supplements shows up around the app: its row in the Health "Lifestyle" group (under
 * Alcohol, with a summary of what you take) and the optional onboarding row. Kit only.
 */
import { GroupedList, ListRow } from '../../../components/ui/GroupedList';
import { IconTile } from '../../../components/ui/IconTile';
import { Tag } from '../../../components/ui/Tag';
import { useT } from '../../../i18n';
import { useSupplements } from '../../../store';
import { SUP_ROW_ICON, useSupplementText } from './text';

/** Health › Lifestyle › Supplements ("Creatine + Whey · 2 items"). */
export function SupplementHealthRow({ onOpen }: { onOpen: () => void }) {
  const { t, summary } = useSupplementText();
  const { entries } = useSupplements();
  return (
    <ListRow
      icon={<IconTile tone="neutral" size={30} icon={SUP_ROW_ICON} />}
      label={t.supTitle}
      sub={summary(entries) ?? t.supRowEmpty}
      chevron
      onClick={onOpen}
    />
  );
}

/** Onboarding: an optional, skippable row that opens the quick-start sheet. */
export function SupplementOnboardingRow({ onOpen }: { onOpen: () => void }) {
  const { t } = useT();
  return (
    <GroupedList>
      <ListRow
        icon={<IconTile tone="neutral" size={32} icon={SUP_ROW_ICON} />}
        label={t.supTitle}
        sub={t.supOnbSub}
        trailing={<Tag tone="neutral">{t.nicOnbOptional}</Tag>}
        chevron
        onClick={onOpen}
      />
    </GroupedList>
  );
}
