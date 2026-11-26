import { useState } from 'react';
import { Button } from './ui/Button';
import { ListRow } from './ui/GroupedList';
import { Segmented } from './ui/Segmented';
import { Chip } from './ui/Chip';
import type { Gym } from '../types';
import { HOME_BACKFILL_MIN, type HomeSet } from '../homeSets';
import { useAddonOrBase } from '../addons/enabledSet';
import { useT } from '../i18n';
import { Icon, Sheet } from '../ui';
import { GymPicker } from './GymPicker';
import { DateField, TimePickerField, DurationField } from './PickerFields';
import { GymThumb } from './GymThumb';
import { useStore } from '../store';

/** Backfill a past session — spec docs/specs/backfill-session.md (AC-1…AC-3). */
export function BackfillSheet(props: {
  gyms: Gym[];
  onClose: () => void;
  onCreate: (startedAt: number, durationMs: number, gymId: string | null) => void;
  /** Log past → Home set: a finished home set prefilled with the chosen set. */
  onCreateHome?: (startedAt: number, durationMs: number, set: HomeSet | null) => void;
  /** Prefill the date (YYYY-MM-DD) — e.g. "Log for Sep 29" on the History calendar. */
  initialDate?: string;
}) {
  // without the Home sets add-on a past session can only be a gym one (hard guard)
  const homeSetsInstalled = useAddonOrBase('home-sets');
  const onCreateHome = homeSetsInstalled ? props.onCreateHome : undefined;
  const { t } = useT();
  const homeSets = useStore().home.sets;
  const [kind, setKind] = useState<'gym' | 'home'>('gym');
  const [homeSetId, setHomeSetId] = useState<string | null>(homeSets[0]?.id ?? null);
  const [gymId, setGymId] = useState<string | null>(null);
  const [gymPicker, setGymPicker] = useState(false);
  const chosenGym = props.gyms.find((g) => g.id === gymId) ?? null;
  const [defaults] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` };
  });
  const [date, setDate] = useState(props.initialDate ?? defaults.date);
  const [time, setTime] = useState('18:00');
  const [duration, setDuration] = useState(60);
  const [now] = useState(() => Date.now());

  const [todayIso] = useState(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  });

  const startedAt = new Date(`${date}T${time}`).getTime();
  const inFuture = !Number.isNaN(startedAt) && startedAt > now;
  const badDuration = duration < 1 || duration > 480;
  const invalid = Number.isNaN(startedAt) || inFuture || badDuration;

  return (
    <Sheet onClose={props.onClose} className="backfill-sheet">
      <div className="sheet-head backfill-head">
        <Icon name="arrow-counter-clockwise" />
        <span className="t">{t.logPastSession}</span>
      </div>
      {onCreateHome && (
        <Segmented
          tabs
          className="backfill-kind"
          options={[
            { value: 'gym', label: t.backfillKindGym },
            { value: 'home', label: t.backfillKindHome },
          ]}
          value={kind}
          onChange={(k) => {
            setKind(k);
            if (k === 'gym' && duration === HOME_BACKFILL_MIN) setDuration(60);
            if (k === 'home' && duration === 60) setDuration(HOME_BACKFILL_MIN);
          }}
        />
      )}
      {kind === 'home' && (
        <div className="field-block">
          <span className="field-label">{t.backfillWhichHomeSet}</span>
          <div className="backfill-sets">
            {homeSets.map((hs) => (
              <Chip selected={homeSetId === hs.id} key={hs.id} onClick={() => setHomeSetId(hs.id)}>
                {hs.name}
              </Chip>
            ))}
            <Chip selected={homeSetId === null} onClick={() => setHomeSetId(null)}>
              {t.backfillHomeEmpty}
            </Chip>
          </div>
        </div>
      )}
      <div className="backfill-fields">
        <label className="field-block">
          <span className="field-label">{t.backfillDate}</span>
          <DateField value={date} onChange={setDate} max={todayIso} />
        </label>
        <div className="backfill-grid">
          <label className="field-block">
            <span className="field-label">{t.backfillStart}</span>
            <TimePickerField value={time} onChange={setTime} />
          </label>
          <label className="field-block">
            <span className="field-label">{t.backfillDuration}</span>
            <DurationField value={duration} onChange={setDuration} />
          </label>
        </div>
      </div>
      {kind === 'home' && <div className="hs-hint">{t.backfillHomeNote}</div>}
      {kind === 'gym' && props.gyms.length > 0 && (
        <label className="field-block">
          <span className="field-label">{t.backfillGym}</span>
          <ListRow
            onClick={() => setGymPicker((x) => !x)}
            icon={
              chosenGym ? (
                <GymThumb
                  name={chosenGym.name}
                  lat={chosenGym.lat}
                  lng={chosenGym.lng}
                  size={28}
                  boxed
                />
              ) : undefined
            }
            label={chosenGym ? chosenGym.name : t.backfillGymChoose}
            trailing={<Icon name={gymPicker ? 'caret-left' : 'arrow-right'} className="go" />}
          />
          {gymPicker && (
            <GymPicker
              gyms={props.gyms}
              title={t.pickGymTitle}
              variant="inline"
              onClose={() => setGymPicker(false)}
              onPick={(id) => {
                setGymId(id);
                setGymPicker(false);
              }}
            />
          )}
        </label>
      )}
      {inFuture && (
        <div className="field-error">
          <Icon name="warning-circle" />
          {t.backfillFuture}
        </div>
      )}
      <div className="sheet-actions">
        <Button variant="secondary" className="grow" onClick={props.onClose}>
          {t.cancel}
        </Button>
        <Button
          variant="primary"
          className="grow"
          disabled={invalid}
          onClick={() =>
            kind === 'home' && onCreateHome
              ? onCreateHome(
                  startedAt,
                  duration * 60000,
                  homeSets.find((x) => x.id === homeSetId) ?? null,
                )
              : props.onCreate(startedAt, duration * 60000, gymId)
          }
        >
          {t.backfillContinue}
        </Button>
      </div>
    </Sheet>
  );
}
