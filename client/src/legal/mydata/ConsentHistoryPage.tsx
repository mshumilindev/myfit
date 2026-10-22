/** Consent history (SPO-295 N5): the person's own `consentRecords`, newest first, read-only (kind, given/withdrawn, version, date). */
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { IconTile } from '../../components/ui/IconTile';
import { Hint } from '../../components/ui/Hint';
import { fmtClock, fmtShortDate, useT, type LocaleId } from '../../i18n';
import type { Strings } from '../../i18n/en';
import { useMyDataT, type MyDataStrings } from '../../i18n/myData';
import type { ConsentKind, ConsentRecord, HealthFeature } from '../consents';
import { MyDataFrame } from './MyDataFrame';

export function kindLabel(t: Strings, m: MyDataStrings, kind: ConsentKind): string {
  switch (kind) {
    case 'terms':
      return m.histTerms;
    case 'policy-ack':
      return m.histPolicy;
    case 'age-18':
      return m.histAge;
    case 'trainer-terms':
      return m.histTrainerTerms;
    case 'atlas-ai':
      return t.privAtlasLabel;
    case 'atlas-puter':
      return t.privPuterLabel;
    case 'geo-search':
      return t.privGeoLabel;
    default:
      return t.privFeature[kind.slice('health:'.length) as HealthFeature];
  }
}

export const newestFirst = (records: readonly ConsentRecord[]): ConsentRecord[] =>
  [...records].sort((a, b) => b.at - a.at);

const when = (at: number, locale: LocaleId): string =>
  `${fmtShortDate(at, locale)}, ${fmtClock(at)}`;

export function ConsentHistoryPage({
  records,
  onBack,
}: {
  records: readonly ConsentRecord[];
  onBack: () => void;
}) {
  const { t, locale } = useT();
  const m = useMyDataT();
  return (
    <MyDataFrame title={m.areas.consents.title} sub={m.histSub} onBack={onBack}>
      {records.length === 0 ? (
        <Hint>{m.histEmpty}</Hint>
      ) : (
        <GroupedList header={m.histHeader} footer={m.histFoot}>
          {newestFirst(records).map((r) => {
            const label = kindLabel(t, m, r.kind);
            return (
              <ListRow
                key={r.id}
                icon={
                  <IconTile size={30} icon={r.action === 'grant' ? 'check-circle' : 'x-circle'} />
                }
                label={r.action === 'grant' ? m.histGiven(label) : m.histWithdrawn(label)}
                sub={m.histVersion(r.version, when(r.at, locale))}
              />
            );
          })}
        </GroupedList>
      )}
    </MyDataFrame>
  );
}
