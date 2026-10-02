/**
 * Planned activities in a program (design: Programs A1 + A2). A day's
 * "Activity" section in the day editor, a compact chip line for the week
 * overview, and the add / edit sheet. Catalog keys + numbers only.
 */
import { useState } from 'react';
import { activityType } from '../../activities';
import { useT } from '../../i18n';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { IconTile } from '../../components/ui/IconTile';
import { NumberStepper } from '../../components/ui/NumberStepper';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { Segmented } from '../../components/ui/Segmented';
import { ConfirmDialog, Sheet } from '../../components/ui/Overlays';
import { CATS, catName, catOf, catTypes, kitTone, type CatId } from '../logActivity/shared';
import type { ActivityEffort } from '../../types';
import type { ProgramActivity, ProgramActivityWhen } from './model';

const EFFORTS: ActivityEffort[] = ['light', 'moderate', 'hard'];
const WHENS: ProgramActivityWhen[] = ['any', 'before', 'after'];

/** "Run · 20 min" — the short form used by chips and rows. */
export function useActivityLine() {
  const { t } = useT();
  return (a: ProgramActivity, withWhen = false) =>
    `${t.actType[a.type] ?? a.type} · ${a.minutes} ${t.minShort}${
      withWhen && a.when !== 'any' ? ` · ${t.pgActWhen[a.when]}` : ''
    }`;
}

/** The week overview's per-day chips (read-only). */
export function ActivityChips({ list }: { list: ProgramActivity[] }) {
  const line = useActivityLine();
  if (!list.length) return null;
  return (
    <div className="pg-actchips">
      {list.map((a) => (
        <Chip key={a.id} size="sm" icon={activityType(a.type)?.icon ?? 'heartbeat'}>
          {line(a)}
        </Chip>
      ))}
    </div>
  );
}

/** The day editor's Activity section. */
export function DayActivities({
  day,
  list,
  readOnly,
  onAdd,
  onPatch,
  onRemove,
}: {
  day: number;
  list: ProgramActivity[];
  readOnly?: boolean;
  onAdd: (a: Omit<ProgramActivity, 'id'>) => void;
  onPatch: (id: string, patch: Partial<ProgramActivity>) => void;
  onRemove: (id: string) => void;
}) {
  const { t } = useT();
  const line = useActivityLine();
  const [sheet, setSheet] = useState<ProgramActivity | 'new' | null>(null);
  if (readOnly && !list.length) return null;
  return (
    <section className="pg-acts">
      <SectionLabel>{t.pgActivity}</SectionLabel>
      {list.length > 0 && (
        <GroupedList>
          {list.map((a) => (
            <ListRow
              key={a.id}
              icon={
                <IconTile
                  tone={kitTone(a.type)}
                  size={36}
                  icon={activityType(a.type)?.icon ?? 'heartbeat'}
                />
              }
              label={line(a)}
              sub={`${t.actEffortLevel[a.effort]}${a.when !== 'any' ? ` · ${t.pgActWhen[a.when]}` : ''}`}
              chevron={!readOnly}
              onClick={readOnly ? undefined : () => setSheet(a)}
            />
          ))}
        </GroupedList>
      )}
      {!readOnly && (
        <Button variant="dashed" icon="plus" className="pg-wide" onClick={() => setSheet('new')}>
          {t.pgAddActivity}
        </Button>
      )}
      {sheet && (
        <ActivitySheet
          day={day}
          item={sheet === 'new' ? null : sheet}
          onClose={() => setSheet(null)}
          onSave={(a) => {
            if (sheet === 'new') onAdd(a);
            else onPatch(sheet.id, a);
            setSheet(null);
          }}
          onRemove={
            sheet === 'new'
              ? undefined
              : () => {
                  onRemove(sheet.id);
                  setSheet(null);
                }
          }
        />
      )}
    </section>
  );
}

function ActivitySheet({
  day,
  item,
  onSave,
  onRemove,
  onClose,
}: {
  day: number;
  item: ProgramActivity | null;
  onSave: (a: Omit<ProgramActivity, 'id'>) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [type, setType] = useState(item?.type ?? '');
  const [cat, setCat] = useState<CatId>(item ? catOf(item.type) : 'conditioning');
  const [minutes, setMinutes] = useState(item?.minutes ?? 30);
  const [effort, setEffort] = useState<ActivityEffort>(item?.effort ?? 'moderate');
  const [when, setWhen] = useState<ProgramActivityWhen>(item?.when ?? 'any');
  const [confirm, setConfirm] = useState(false);
  // Dirty check: a new one needs a type, an edit needs a change.
  const dirty =
    !!type &&
    (!item ||
      item.type !== type ||
      item.minutes !== minutes ||
      item.effort !== effort ||
      item.when !== when);
  return (
    <Sheet onClose={onClose}>
      <div className="pg-sheet">
        <h3>{item ? t.pgActEdit : t.pgAddActivity}</h3>
        <Segmented
          label={t.logActivity}
          value={cat}
          onChange={setCat}
          options={CATS.map((c) => ({ value: c, label: catName(c, t) }))}
        />
        <div className="pg-acttypes">
          {catTypes(cat).map((a) => (
            <Chip
              key={a.key}
              icon={a.icon}
              selected={type === a.key}
              onClick={() => setType(a.key)}
            >
              {t.actType[a.key] ?? a.key}
            </Chip>
          ))}
        </div>
        <NumberStepper
          size="big"
          label={t.minShort}
          value={minutes}
          step={5}
          min={5}
          max={300}
          onChange={setMinutes}
        />
        <Segmented
          label={t.actEffort}
          value={effort}
          onChange={setEffort}
          options={EFFORTS.map((e) => ({ value: e, label: t.actEffortLevel[e] }))}
        />
        <Segmented
          label={t.pgActWhenLabel}
          value={when}
          onChange={setWhen}
          options={WHENS.map((w) => ({ value: w, label: t.pgActWhen[w] }))}
        />
        <p className="pg-note">{t.pgActNote(t.weekDayNames[day - 1] ?? '')}</p>
        <Button
          variant="primary"
          className="pg-wide"
          disabled={!dirty}
          onClick={() => onSave({ day, type, minutes, effort, when })}
        >
          {t.save}
        </Button>
        {onRemove && (
          <Button variant="danger" className="pg-wide" onClick={() => setConfirm(true)}>
            {t.delete}
          </Button>
        )}
      </div>
      {confirm && onRemove && (
        <ConfirmDialog
          danger
          title={t.pgActRemoveTitle(t.actType[type] ?? type)}
          body={t.pgActRemoveBody}
          confirmLabel={t.delete}
          cancelLabel={t.keep}
          onCancel={() => setConfirm(false)}
          onConfirm={onRemove}
        />
      )}
    </Sheet>
  );
}
