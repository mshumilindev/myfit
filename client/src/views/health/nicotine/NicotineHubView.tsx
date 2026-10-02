/**
 * Nicotine hub (board 1B): two rows, "What I use" and "Use in calculations". Each opens its
 * own page. Sharing and delete live in Health › Privacy and sharing. Kit primitives only.
 */
import { BackButton } from '../../../components/ui/BackButton';
import { GroupedList, ListRow } from '../../../components/ui/GroupedList';
import { IconTile } from '../../../components/ui/IconTile';
import { useNicotine } from '../../../store';
import { useNicotineText } from './text';

export type NicotineScreen = 'hub' | 'products' | 'calc';

export function NicotineHubView({
  onOpen,
  onBack,
}: {
  onOpen: (screen: Exclude<NicotineScreen, 'hub'>) => void;
  onBack: () => void;
}) {
  const { t, summary } = useNicotineText();
  const { products, settings } = useNicotine();
  return (
    <div className="screen hl">
      <div className="hl-pbar">
        <BackButton label={t.backAction} onClick={onBack} />
        <h1 className="hl-pt">{t.nicTitle}</h1>
      </div>
      <div className="hl-scroll">
        <div className="hl-cnt">
          <GroupedList footer={t.nicHubFoot}>
            <ListRow
              icon={<IconTile tone="neutral" size={30} icon="list-checks" />}
              label={t.nicHubUse}
              sub={summary(products) ?? t.nicRowEmpty}
              chevron
              onClick={() => onOpen('products')}
            />
            <ListRow
              icon={<IconTile tone="neutral" size={30} icon="gauge" />}
              label={t.nicHubCalc}
              value={settings.useInCalculations ? t.nicHubOn : t.nicHubOff}
              chevron
              onClick={() => onOpen('calc')}
            />
          </GroupedList>
        </div>
      </div>
    </div>
  );
}
