import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Calendar } from '../components/ui/Calendar';
import { dayKeyOf, ymdOf } from '../components/ui/calendarDays';
import { Field } from '../components/ui/Field';
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { IconTile } from '../components/ui/IconTile';
import { PageHead } from '../components/ui/PageHead';
import { PresetChips } from '../components/ui/PresetChips';
import { Segmented } from '../components/ui/Segmented';
import { WheelPicker } from '../components/ui/WheelPicker';
import { useT } from '../i18n';
import { COLOURS, REPEAT_KINDS, type Draft } from './draft';
import { STRINGS } from './strings';
import { dayFromNumber, dayNumber } from './zoned';
import type { Tone } from '../components/ui/tones';

/** Add / edit one plan. Pure form: the page saves and deletes. */
export function PlanForm(p: {
  initial: Draft;
  editing: boolean;
  onSave: (d: Draft) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const s = STRINGS[locale];
  const [d, setD] = useState<Draft>(p.initial);
  const [pickDate, setPickDate] = useState(false);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const dateText = new Date(
    ymdOf(dayNumber(d.start)).y,
    ymdOf(dayNumber(d.start)).m,
    ymdOf(dayNumber(d.start)).d,
  ).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  return (
    <div className="screen pl-form">
      <PageHead
        back={{ label: t.backAction, onClick: p.onClose }}
        title={p.editing ? s.editPlan : s.newPlan}
      />
      <GroupedList>
        <ListRow
          as="div"
          icon={<IconTile icon={d.icon} tone={d.color as Tone} size={36} />}
          label={
            <Field
              bare
              aria-label={s.titleLabel}
              placeholder={s.titleHint}
              value={d.title}
              maxLength={80}
              onChange={(e) => set({ title: e.target.value })}
            />
          }
        />
      </GroupedList>
      <GroupedList header={s.colour}>
        <ListRow as="div" label="">
          <PresetChips
            label={s.colour}
            items={COLOURS.map((c) => ({
              id: c,
              label: s.colours[c],
              selected: d.color === c,
              onClick: () => set({ color: c }),
            }))}
          />
        </ListRow>
      </GroupedList>
      <GroupedList>
        <ListRow label={s.date} value={dateText} chevron onClick={() => setPickDate((v) => !v)} />
        {pickDate && (
          <ListRow as="div" label="">
            <Calendar
              value={dayNumber(d.start)}
              onSelect={(n) => {
                set({ start: dayFromNumber(n) });
                setPickDate(false);
              }}
            />
          </ListRow>
        )}
        <ListRow as="div" label={s.starts}>
          <div className="pl-time">
            <WheelPicker
              label={s.hour}
              value={d.hour}
              min={0}
              max={23}
              input="manual"
              size="compact"
              onChange={(hour) => set({ hour })}
            />
            <span aria-hidden>:</span>
            <WheelPicker
              label={s.minute}
              value={d.minute}
              min={0}
              max={59}
              step={5}
              input="manual"
              size="compact"
              onChange={(minute) => set({ minute })}
            />
          </div>
        </ListRow>
      </GroupedList>
      <GroupedList header={s.repeats}>
        <ListRow as="div" label="">
          <PresetChips
            label={s.repeats}
            items={REPEAT_KINDS.map((k) => ({
              id: k,
              label: s.repeat[k],
              selected: d.repeat === k,
              onClick: () => set({ repeat: k }),
            }))}
          />
        </ListRow>
      </GroupedList>
      <GroupedList header={s.remind}>
        <ListRow as="div" label="">
          <Segmented
            label={s.remind}
            value={d.mode}
            onChange={(mode) => set({ mode })}
            options={[
              { value: 'quiet', label: s.quiet },
              { value: 'ring', label: s.ring },
            ]}
          />
        </ListRow>
        <ListRow as="div" label="">
          <PresetChips
            label={s.lead}
            items={s.leadOptions.map((o) => ({
              id: String(o.min),
              label: o.label,
              selected: d.lead === o.min,
              onClick: () => set({ lead: o.min }),
            }))}
          />
        </ListRow>
      </GroupedList>
      <div className="pl-actions">
        <Button fullWidth disabled={!d.title.trim()} onClick={() => p.onSave(d)}>
          {s.save}
        </Button>
        <Button variant="ghost" fullWidth onClick={p.onClose}>
          {s.cancel}
        </Button>
        {p.onDelete && (
          <Button variant="danger" fullWidth onClick={p.onDelete}>
            {s.del}
          </Button>
        )}
      </div>
    </div>
  );
}

export { dayKeyOf };
