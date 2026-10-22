/**
 * "Download a copy" (SPO-295 N6; designs Export, ExportReady): choose the parts, confirm the password (step-up), watch each part
 * being built on this device, then download the ZIP. The warning that the file is not encrypted sits next to the button and again
 * on the ready page. What could not be read here is listed with its reason, never hidden.
 */
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { Hint } from '../../components/ui/Hint';
import { IconTile } from '../../components/ui/IconTile';
import { Notice } from '../../components/ui/Notice';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Switch } from '../../components/ui/Switch';
import { ReauthDialog } from '../../coach/security/ReauthDialog';
import type { ReauthPort } from '../../coach/security/reauth';
import { fmtShortDate, useT } from '../../i18n';
import { useExportT } from '../../i18n/myDataExport';
import { AREA_LOOK } from '../mydata/areas';
import { MyDataFrame } from '../mydata/MyDataFrame';
import type { ConsentRecord } from '../consents';
import { EXPORT_CATEGORIES, type ExportCategory, type MissingReason } from './exportModel';
import { useExportFlow } from './useExportFlow';

const LOOK: Record<ExportCategory, { icon: string; tone: (typeof AREA_LOOK)['account']['tone'] }> =
  {
    account: AREA_LOOK.account,
    training: AREA_LOOK.training,
    body: AREA_LOOK.health,
    atlas: AREA_LOOK.atlas,
    sharing: AREA_LOOK.sharing,
  };

export interface ExportPageProps {
  onBack: () => void;
  consents: readonly ConsentRecord[] | null;
  hasTrainer: boolean;
  /** Shown on the ready page when the copy was asked for before deleting the account. */
  onContinueDelete?: () => void;
  /** tests */
  port?: ReauthPort;
}

export function ExportPage({
  onBack,
  consents,
  hasTrainer,
  onContinueDelete,
  port,
}: ExportPageProps) {
  const { locale } = useT();
  const x = useExportT();
  const f = useExportFlow({ consents, hasTrainer });
  const total = f.chosen.length + 1;
  const doneCount = f.chosen.filter((c) => f.parts[c] === 'done').length + (f.packing ? 1 : 0);

  if (f.stage === 'running')
    return (
      <MyDataFrame title={x.title} sub={x.progressHeader} onBack={f.cancel}>
        <GroupedList header={x.progressHeader}>
          {f.chosen.map((c) => (
            <ListRow
              key={c}
              icon={<IconTile tone={LOOK[c].tone} size={30} icon={LOOK[c].icon} />}
              label={x.parts[c].label}
              value={x[f.parts[c] ?? 'waiting']}
              valueTone={f.parts[c] === 'done' ? 'ok' : undefined}
            />
          ))}
          <ListRow
            icon={<IconTile size={30} icon="archive" />}
            label={x.packing}
            value={f.packing ? x.working : x.waiting}
          />
        </GroupedList>
        <ProgressBar value={(doneCount / total) * 100} label={x.progressHeader} />
        <GroupedList>
          <ListRow action label={x.cancel} onClick={f.cancel} />
        </GroupedList>
      </MyDataFrame>
    );

  if (f.stage === 'ready' && f.result) {
    const gaps = gapCounts(f.result.manifest.categories.flatMap((c) => c.notIncluded));
    return (
      <MyDataFrame title={x.title} sub={x.readySub} onBack={onBack}>
        {f.result.manifest.deviceCopyOnly && (
          <Notice tone="neutral" icon="info">
            {x.deviceCopy}
          </Notice>
        )}
        <GroupedList header={x.readyHeader}>
          <ListRow
            icon={<IconTile tone="accent" size={30} icon="download-simple" />}
            label={f.result.filename}
            sub={x.prepared(fmtShortDate(Date.parse(f.result.manifest.generatedAt), locale))}
            chevron
            onClick={f.download}
          />
        </GroupedList>
        <Hint>{x.readyFoot}</Hint>
        {gaps.length > 0 && (
          <GroupedList header={x.gapsHeader} footer={x.gapsFoot}>
            {gaps.map(([reason, n]) => (
              <ListRow
                key={reason}
                icon={<IconTile size={30} icon="x-circle" />}
                label={x.reasons[reason]}
                value={String(n)}
              />
            ))}
          </GroupedList>
        )}
        <GroupedList>
          <ListRow action label={x.again} onClick={f.reset} />
          {onContinueDelete && (
            <ListRow action tone="danger" label={x.continueDelete} onClick={onContinueDelete} />
          )}
        </GroupedList>
      </MyDataFrame>
    );
  }

  return (
    <>
      <MyDataFrame title={x.title} sub={x.sub} onBack={onBack}>
        {f.stage === 'failed' && (
          <Notice tone="danger" icon="warning-circle">
            {x.failed}
          </Notice>
        )}
        <GroupedList header={x.whatHeader} footer={x.whatFoot}>
          {EXPORT_CATEGORIES.map((c) => (
            <ListRow
              key={c}
              as="label"
              icon={<IconTile tone={LOOK[c].tone} size={30} icon={LOOK[c].icon} />}
              label={x.parts[c].label}
              sub={x.parts[c].sub}
              trailing={
                <Switch
                  checked={f.selected[c]}
                  onChange={(on) => f.toggle(c, on)}
                  aria-label={x.parts[c].label}
                />
              }
            />
          ))}
        </GroupedList>
        <Notice tone="danger" icon="warning">
          {x.warning}
        </Notice>
        <GroupedList
          header={x.prepareHeader}
          footer={f.chosen.length === 0 ? x.needOne : undefined}
        >
          <ListRow
            icon={<IconTile tone="accent" size={30} icon="download-simple" />}
            label={x.prepareLabel}
            sub={x.prepareSub}
            chevron
            disabled={f.chosen.length === 0}
            onClick={f.start}
          />
        </GroupedList>
        <Hint>{x.network}</Hint>
      </MyDataFrame>
      {f.stage === 'stepup' && (
        <ReauthDialog action="my-export" port={port} onCancel={f.reset} onDone={f.confirmed} />
      )}
    </>
  );
}

function gapCounts(items: { reason: MissingReason }[]): [MissingReason, number][] {
  const m = new Map<MissingReason, number>();
  for (const i of items) m.set(i.reason, (m.get(i.reason) ?? 0) + 1);
  return [...m.entries()];
}
