/**
 * Where Alcohol shows up around the app: its row in the Health "Lifestyle" group (under
 * Nicotine, with a summary of what you drink) and the optional onboarding row. Kit only.
 */
import { GroupedList, ListRow } from '../../../components/ui/GroupedList';
import { IconTile } from '../../../components/ui/IconTile';
import { Tag } from '../../../components/ui/Tag';
import { useT } from '../../../i18n';
import { useAlcohol } from '../../../store';
import { ALC_ROW_ICON, useAlcoholText } from './text';

/** Health › Lifestyle › Alcohol ("Beer + Whisky · ≈ 117 g a week"). */
export function AlcoholHealthRow({ onOpen }: { onOpen: () => void }) {
  const { t, summary } = useAlcoholText();
  const { entries } = useAlcohol();
  return (
    <ListRow
      icon={<IconTile tone="neutral" size={30} icon={ALC_ROW_ICON} />}
      label={t.alcTitle}
      sub={summary(entries) ?? t.alcRowEmpty}
      chevron
      onClick={onOpen}
    />
  );
}

/** Onboarding: an optional, skippable row that opens "What I drink". */
export function AlcoholOnboardingRow({ onOpen }: { onOpen: () => void }) {
  const { t } = useT();
  return (
    <GroupedList>
      <ListRow
        icon={<IconTile tone="neutral" size={32} icon={ALC_ROW_ICON} />}
        label={t.alcTitle}
        sub={t.alcOnbSub}
        trailing={<Tag tone="neutral">{t.nicOnbOptional}</Tag>}
        chevron
        onClick={onOpen}
      />
    </GroupedList>
  );
}
