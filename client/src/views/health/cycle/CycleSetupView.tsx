/** First setup and Settings: mode, typical dates, where hints show, delete. One form, dirty-checked Save. */
import { useState } from 'react';
import { BackButton } from '../../../components/ui/BackButton';
import { Button } from '../../../components/ui/Button';
import { Calendar } from '../../../components/ui/Calendar';
import { Card } from '../../../components/ui/Card';
import { GroupedList, ListRow } from '../../../components/ui/GroupedList';
import { IconTile } from '../../../components/ui/IconTile';
import { NumberStepper } from '../../../components/ui/NumberStepper';
import { Notice } from '../../../components/ui/Notice';
import { ConfirmDialog, Sheet } from '../../../components/ui/Overlays';
import { SectionLabel } from '../../../components/ui/SectionLabel';
import { Segmented } from '../../../components/ui/Segmented';
import { StickyActionBar } from '../../../components/ui/StickyActionBar';
import { Switch } from '../../../components/ui/Switch';
import {
  LIMITS,
  normalizeSettings,
  outOfNorm,
  type CycleMode,
  type CycleSettings,
} from '../../../cycle/cycleCore';
import { CYCLE_SURFACES, type CycleSurface } from '../../../cycle/cycleState';
import { deleteCycleData, saveCycleSettings, setCycleSurface, useCycle } from '../../../store';
import { CYCLE_TONE, dayText, todayKey, useCycleText } from './text';

const DEFAULT = (): CycleSettings => ({
  mode: 'regular',
  length: 28,
  period: 5,
  anchor: todayKey(),
});

export function CycleSetupView({ onBack }: { onBack: () => void }) {
  const { t } = useCycleText();
  const cycle = useCycle();
  const initial = cycle.settings ?? DEFAULT();
  const [draft, setDraft] = useState<CycleSettings>(initial);
  const [pickDate, setPickDate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const first = !cycle.enabled || !cycle.settings;
  const norm = normalizeSettings(draft);
  const dirty = first || JSON.stringify(norm) !== JSON.stringify(initial);
  const set = (p: Partial<CycleSettings>) => setDraft((d) => ({ ...d, ...p }));
  const today = todayKey();
  const surfaceLabel: Record<CycleSurface, string> = {
    today: t.cycSurfToday,
    calendar: t.cycSurfCalendar,
    session: t.cycSurfSession,
  };
  const foot = {
    regular: t.cycModeFootRegular,
    irregular: t.cycModeFootIrregular,
    log: t.cycModeFootLog,
  }[draft.mode];
  return (
    <div className="screen hl">
      <div className="hl-pbar">
        <BackButton label={t.backAction} onClick={onBack} />
        <h1 className="hl-pt">{t.cycTitle}</h1>
      </div>
      <div className="hl-scroll">
        <div className="hl-cnt">
          {first && (
            <Card pad="md" emphasis="quiet">
              <span className="ut-md">{t.cycSetupIntro}</span>
            </Card>
          )}
          <div className="ul-flex ul-col ug-8">
            <SectionLabel>{t.cycMode}</SectionLabel>
            <Segmented<CycleMode>
              label={t.cycMode}
              tone={CYCLE_TONE}
              value={draft.mode}
              onChange={(mode) => set({ mode })}
              options={[
                { value: 'regular', label: t.cycModeRegular },
                { value: 'irregular', label: t.cycModeIrregular, compact: true },
                { value: 'log', label: t.cycModeLog },
              ]}
            />
            <span className="ut-sm ut-muted">{foot}</span>
          </div>
          <GroupedList header={t.cycUsually} footer={t.cycUsuallyFoot}>
            <ListRow
              label={t.cycLastStart}
              value={dayText(draft.anchor)}
              chevron
              onClick={() => setPickDate(true)}
            />
          </GroupedList>
          <div className="ul-flex ul-col ug-8">
            <NumberStepper
              label={t.cycLength}
              value={draft.length}
              onChange={(length) => set({ length })}
              min={LIMITS.length[0]}
              max={LIMITS.length[1]}
              unit={t.cycDaysUnit}
            />
            <NumberStepper
              label={t.cycPeriod}
              value={draft.period}
              onChange={(period) => set({ period })}
              min={LIMITS.period[0]}
              max={LIMITS.period[1]}
              unit={t.cycDaysUnit}
            />
            {draft.mode === 'irregular' && (
              <>
                <NumberStepper
                  label={t.cycShortest}
                  value={draft.min ?? draft.length}
                  onChange={(min) => set({ min })}
                  min={LIMITS.length[0]}
                  max={LIMITS.length[1]}
                  unit={t.cycDaysUnit}
                />
                <NumberStepper
                  label={t.cycLongest}
                  value={draft.max ?? draft.length}
                  onChange={(max) => set({ max })}
                  min={LIMITS.length[0]}
                  max={LIMITS.length[1]}
                  unit={t.cycDaysUnit}
                />
              </>
            )}
          </div>
          {outOfNorm(norm) && (
            <Notice tone="illness" icon="info">
              {t.cycOutOfNorm}
            </Notice>
          )}
          {!first && (
            <>
              <GroupedList header={t.cycWhere} footer={t.cycWhereFoot}>
                {CYCLE_SURFACES.map((s) => (
                  <ListRow
                    key={s}
                    as="label"
                    label={surfaceLabel[s]}
                    trailing={
                      <Switch
                        checked={cycle.surfaces[s]}
                        onChange={(on) => setCycleSurface(s, on)}
                        aria-label={surfaceLabel[s]}
                      />
                    }
                  />
                ))}
              </GroupedList>
              <GroupedList>
                <ListRow
                  icon={<IconTile tone="danger" size={30} icon="trash" />}
                  label={t.cycDelete}
                  tone="danger"
                  action
                  onClick={() => setConfirmDelete(true)}
                />
              </GroupedList>
            </>
          )}
          <div className="ul-flex ua-center ug-8 ut-sm ut-muted">
            <IconTile tone="neutral" size={22} icon="lock" />
            {t.cycPrivate}
          </div>
        </div>
      </div>
      <StickyActionBar>
        <Button variant="secondary" onClick={onBack}>
          {t.cycCancel}
        </Button>
        <Button
          variant="primary"
          disabled={!dirty}
          onClick={() => {
            saveCycleSettings(norm);
            onBack();
          }}
        >
          {t.cycSave}
        </Button>
      </StickyActionBar>
      {pickDate && (
        <Sheet onClose={() => setPickDate(false)}>
          <div className="ul-flex ul-col ug-12">
            <span className="ut-lg ut-w7">{t.cycUpdateTitle}</span>
            <Calendar
              value={draft.anchor}
              today={today}
              max={today}
              tone={CYCLE_TONE}
              onSelect={(anchor) => {
                set({ anchor });
                setPickDate(false);
              }}
            />
          </div>
        </Sheet>
      )}
      {confirmDelete && (
        <ConfirmDialog
          danger
          icon="trash"
          title={t.cycDeleteTitle}
          body={t.cycDeleteBody}
          confirmLabel={t.cycDeleteConfirm}
          cancelLabel={t.cycCancel}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            deleteCycleData();
            onBack();
          }}
        />
      )}
    </div>
  );
}
