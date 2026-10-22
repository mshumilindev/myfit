/**
 * A data page of "What Spotter knows about you" (SPO-295 N5): what is stored in the area (numbers only from real stores),
 * who can see it, where and how long, and the options that already exist in the app: delete a health feature's data
 * (the two-step prompt), clear the Atlas chat, open Privacy and sharing, delete the account. No option is invented.
 */
import { useState } from 'react';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { IconTile } from '../../components/ui/IconTile';
import { Hint } from '../../components/ui/Hint';
import { Notice } from '../../components/ui/Notice';
import { ConfirmDialog } from '../../components/ui/Overlays';
import { clearAtlasConversation } from '../../atlas/clearConversation';
import { useT } from '../../i18n';
import { useDeleteT } from '../../i18n/accountDelete';
import { useMyDataT, type DataAreaId, type MyDataStrings } from '../../i18n/myData';
import { AREA_LOOK, areaLines, storedHealth, type AreaInputs, type LineValue } from './areas';
import { HealthDeleteDialog } from './HealthDeleteDialog';
import { MyDataFrame } from './MyDataFrame';

function valueText(m: MyDataStrings, v: LineValue | undefined): string | undefined {
  if (!v) return undefined;
  switch (v.kind) {
    case 'count':
      return String(v.n);
    case 'has':
      return v.present ? m.has : m.none;
    case 'on':
      return v.on ? m.on : m.off;
    case 'allowed':
      return v.allowed ? m.given : m.notGiven;
  }
}

export interface AreaPageProps {
  area: DataAreaId;
  inputs: AreaInputs;
  onBack: () => void;
  onOpenSharing?: () => void;
  onDeleteAccount: () => void;
}

type Ask = { kind: 'health'; f: ReturnType<typeof storedHealth>[number] } | { kind: 'chat' } | null;

export function AreaPage({ area, inputs, onBack, onOpenSharing, onDeleteAccount }: AreaPageProps) {
  const { t } = useT();
  const m = useMyDataT();
  const d = useDeleteT();
  const [ask, setAsk] = useState<Ask>(null);
  const [failed, setFailed] = useState(false);
  const page = m.pages[area];
  const look = AREA_LOOK[area];
  const health = area === 'health' ? storedHealth(inputs) : [];
  const clearable = area === 'atlas' && inputs.chat > 0;
  const hasOptions =
    health.length > 0 || clearable || area === 'account' || (area === 'sharing' && !!onOpenSharing);
  return (
    <MyDataFrame title={m.areas[area].title} sub={m.areas[area].sub} onBack={onBack}>
      {page.note && (
        <Notice tone="neutral" icon="info">
          {page.note}
        </Notice>
      )}
      {failed && (
        <Notice tone="danger" icon="warning-circle">
          {m.delFailed}
        </Notice>
      )}
      <GroupedList header={m.hStored}>
        {areaLines(area, inputs).map((l) => (
          <ListRow
            key={l.id}
            label={m.lines[l.id].label}
            sub={m.lines[l.id].sub}
            value={valueText(m, l.value)}
          />
        ))}
      </GroupedList>
      <GroupedList header={m.hWho}>
        <ListRow icon={<IconTile tone={look.tone} size={30} icon="eye" />} label={page.who} />
      </GroupedList>
      <GroupedList header={m.hWhere}>
        <ListRow
          icon={<IconTile size={30} icon="lock-simple" />}
          label={m.whereLabel}
          sub={page.where}
        />
        <ListRow icon={<IconTile size={30} icon="clock" />} label={m.keepLabel} sub={page.keep} />
      </GroupedList>
      {hasOptions && (
        <GroupedList header={m.hOptions}>
          {area === 'sharing' && onOpenSharing && (
            <ListRow
              icon={<IconTile tone="people" size={30} icon="users" />}
              label={m.openSharing}
              sub={m.openSharingSub}
              chevron
              onClick={onOpenSharing}
            />
          )}
          {health.map((f) => (
            <ListRow
              key={f}
              action
              tone="danger"
              label={m.delFeature(t.privFeature[f])}
              onClick={() => setAsk({ kind: 'health', f })}
            />
          ))}
          {clearable && (
            <ListRow
              action
              tone="danger"
              label={m.clearChat}
              onClick={() => setAsk({ kind: 'chat' })}
            />
          )}
          {area === 'account' && (
            <ListRow action tone="danger" label={d.rowLabel} onClick={onDeleteAccount} />
          )}
        </GroupedList>
      )}
      {!hasOptions && <Hint>{m.noActions}</Hint>}
      {ask?.kind === 'health' && (
        <HealthDeleteDialog
          feature={ask.f}
          onDone={(r) => {
            setAsk(null);
            setFailed(r.failed);
          }}
        />
      )}
      {ask?.kind === 'chat' && (
        <ConfirmDialog
          danger
          icon="trash"
          title={m.clearChatTitle}
          body={m.clearChatBody}
          confirmLabel={m.clearChatConfirm}
          cancelLabel={m.cancel}
          onCancel={() => setAsk(null)}
          onConfirm={() => {
            setAsk(null);
            clearAtlasConversation();
          }}
        />
      )}
    </MyDataFrame>
  );
}
