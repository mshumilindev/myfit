import { useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { PageHead } from '../components/ui/PageHead';
import { Sheet, SheetFoot, SheetPin } from '../components/ui/Overlays';
import { SectionLabel } from '../components/ui/SectionLabel';
import { Segmented } from '../components/ui/Segmented';
import { Switch } from '../components/ui/Switch';
import { useT } from '../i18n';
import { fmtMinutes, saveQuiet, useQuietHours } from '../quietHours';
import { nativeBridge, type NativePrefs } from './desktopBridge';
import { durText, leadText } from './fmt';
import { HM } from './PlanForm';
import { STRINGS } from './strings';
import { savePrefs, usePrefs } from './sync';
import type { PlanMode, PlannerPrefs } from './types';
import './planner.css';

type Picking = 'lead' | 'duration' | 'from' | 'to';

/**
 * Planner settings (design SPO-555, screens 37 and desktop 17): defaults for new plans, the reminder style, quiet hours (the same
 * setting the app already has for chat pushes) and "This computer" (tray /
 * menu bar, start with the computer) which only exists inside the desktop shell.
 */
export function PlannerSettings({ onBack }: { onBack: () => void }) {
  const { t, locale } = useT();
  const s = STRINGS[locale];
  const prefs = usePrefs();
  const quiet = useQuietHours();
  const [picking, setPicking] = useState<Picking | null>(null);
  const native = nativeBridge();
  const [shell, setShell] = useState<NativePrefs | null>(null);
  useEffect(() => {
    let live = true;
    native
      ?.getPrefs?.()
      .then((p) => live && setShell(p))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [native]);

  const write = (d: Partial<PlannerPrefs['defaults']>) =>
    void savePrefs({ ...prefs, defaults: { ...prefs.defaults, ...d } });
  const setShellPref = (patch: Partial<NativePrefs>) =>
    void native
      ?.setPrefs?.(patch)
      .then(setShell)
      .catch(() => undefined);
  return (
    <div className="screen pl-screen">
      <div className="pl-page">
        <PageHead back={{ label: t.backAction, onClick: onBack }} title={s.settingsTitle} />
        <GroupedList header={s.defaultsHead}>
          <ListRow
            label={s.remindMe}
            value={leadText(s, prefs.defaults.lead)}
            chevron
            onClick={() => setPicking('lead')}
          />
          <ListRow
            label={s.duration}
            value={durText(s, prefs.defaults.durationMin)}
            chevron
            onClick={() => setPicking('duration')}
          />
        </GroupedList>
        <SectionLabel>{s.reminderStyle}</SectionLabel>
        <Segmented<PlanMode>
          value={prefs.defaults.mode}
          onChange={(mode) => write({ mode })}
          label={s.reminderStyle}
          fill
          options={[
            { value: 'quiet', label: s.quiet },
            { value: 'ring', label: s.ring },
          ]}
        />
        <GroupedList header={s.quietHead} footer={s.quietNote}>
          <ListRow
            as="label"
            label={s.quietHours}
            trailing={
              <Switch
                checked={quiet.on}
                onChange={(on) => saveQuiet({ ...quiet, on })}
                aria-label={s.quietHours}
              />
            }
          />
          <ListRow
            label={s.fromL}
            value={fmtMinutes(quiet.from)}
            chevron
            disabled={!quiet.on}
            onClick={() => setPicking('from')}
          />
          <ListRow
            label={s.quietTo}
            value={fmtMinutes(quiet.to)}
            chevron
            disabled={!quiet.on}
            onClick={() => setPicking('to')}
          />
        </GroupedList>
        {shell && (
          <GroupedList header={s.thisComputer} footer={s.trayNote}>
            <ListRow
              as="label"
              label={s.startWithComputer}
              trailing={
                <Switch
                  checked={shell.openAtLogin}
                  onChange={(openAtLogin) => setShellPref({ openAtLogin })}
                  aria-label={s.startWithComputer}
                />
              }
            />
            <ListRow
              as="label"
              label={s.showTray}
              sub={s.trayHint}
              trailing={
                <Switch
                  checked={shell.trayIcon}
                  onChange={(trayIcon) => setShellPref({ trayIcon })}
                  aria-label={s.showTray}
                />
              }
            />
          </GroupedList>
        )}
      </div>
      {picking && (
        <PickSheet
          key={picking}
          kind={picking}
          value={
            picking === 'lead'
              ? prefs.defaults.lead
              : picking === 'duration'
                ? prefs.defaults.durationMin
                : picking === 'from'
                  ? quiet.from
                  : quiet.to
          }
          onClose={() => setPicking(null)}
          onSave={(v) => {
            if (picking === 'lead') write({ lead: v });
            else if (picking === 'duration') write({ durationMin: v });
            else saveQuiet({ ...quiet, [picking]: v });
            setPicking(null);
          }}
        />
      )}
    </div>
  );
}

/** One value picked on a staged copy: hours and minutes drums with Cancel / Save (the same drawers as the plan form). */
function PickSheet({
  kind,
  value,
  onClose,
  onSave,
}: {
  kind: Picking;
  value: number;
  onClose: () => void;
  onSave: (minutes: number) => void;
}) {
  const { locale } = useT();
  const s = STRINGS[locale];
  const [v, setV] = useState(value);
  const title =
    kind === 'lead'
      ? s.remindMe
      : kind === 'duration'
        ? s.duration
        : kind === 'from'
          ? s.fromL
          : s.quietTo;
  const hMax = kind === 'lead' ? 48 : kind === 'duration' ? 12 : 23;
  const clamp = (n: number) =>
    kind === 'lead' ? Math.min(2880, n) : kind === 'duration' ? Math.max(5, n) : Math.min(1435, n);
  return (
    <Sheet onClose={onClose} label={title}>
      <div className="ul-flex ul-col ug-20">
        <SheetPin>
          <h2 className="ut-xl ut-w7">{title}</h2>
        </SheetPin>
        <HM
          h={Math.floor(v / 60)}
          m={v % 60}
          hl={s.hours}
          ml={s.minutes}
          hMax={hMax}
          hUnit={kind === 'from' || kind === 'to' ? undefined : s.h}
          mUnit={kind === 'from' || kind === 'to' ? undefined : s.min}
          onChange={(h, m) => setV(clamp(h * 60 + m))}
        />
        <SheetFoot>
          <Button fullWidth variant="secondary" onClick={onClose}>
            {s.cancel}
          </Button>
          <Button fullWidth onClick={() => onSave(v)}>
            {s.save}
          </Button>
        </SheetFoot>
      </div>
    </Sheet>
  );
}
