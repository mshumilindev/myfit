/**
 * Where Nicotine shows up around the app: the "Lifestyle" group in Health (one row with
 * a summary of what you use) and the optional onboarding row (board 5B). Kit only.
 */
import type { ReactNode } from 'react';
import { GroupedList, ListRow } from '../../../components/ui/GroupedList';
import { FEATURE_ICON } from '../../../coachEffectIcons';
import { IconTile } from '../../../components/ui/IconTile';
import { Tag } from '../../../components/ui/Tag';
import { useNicotine } from '../../../store';
import { useNicotineText } from './text';

/**
 * Health › Lifestyle › Nicotine ("Vape + Heated tobacco · ≈ 38 mg a day"). Other lifestyle
 * rows (Alcohol) go in as `children`, under it, in the same group.
 */
export function NicotineHealthGroup({
  onOpen,
  children,
}: {
  onOpen: () => void;
  children?: ReactNode;
}) {
  const { t, summary } = useNicotineText();
  const { products } = useNicotine();
  return (
    <GroupedList header={t.nicLifestyle}>
      <ListRow
        icon={<IconTile tone="neutral" size={30} icon={FEATURE_ICON.nicotine} />}
        label={t.nicTitle}
        sub={summary(products) ?? t.nicRowEmpty}
        chevron
        onClick={onOpen}
      />
      {children}
    </GroupedList>
  );
}

/** Onboarding: an optional, skippable row that opens "What I use". */
export function NicotineOnboardingRow({ onOpen }: { onOpen: () => void }) {
  const { t } = useNicotineText();
  return (
    <GroupedList>
      <ListRow
        icon={<IconTile tone="neutral" size={32} icon={FEATURE_ICON.nicotine} />}
        label={t.nicOnbPrompt}
        sub={t.nicOnbSub}
        trailing={<Tag tone="neutral">{t.nicOnbOptional}</Tag>}
        chevron
        onClick={onOpen}
      />
    </GroupedList>
  );
}
