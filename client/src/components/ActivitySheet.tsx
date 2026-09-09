/**
 * Log activity (design feature 6, ACT-1): a type picker. Choosing one opens the
 * activity page for that type — nothing is logged until you press Start (or Save
 * a backfilled one) there. The live timer and backfill both live on the page.
 */
import type { Shell } from '../App';
import { startSleep, liveSleep, useStore } from '../store';
import { MoonGlyph } from './MoonGlyph';
import { lastNight, nightDurationMin } from '../sleep';
import { fmtDurationHuman } from '../i18n';
import { Icon, Sheet } from '../ui';
import { useT } from '../i18n';
import { ACTIVITY_TYPES } from '../activities';

export function ActivitySheet(props: { shell: Shell; onClose: () => void }) {
  const { t } = useT();

  function pick(key: string): void {
    props.shell.openOverlay({ screen: 'activity', newType: key });
    props.onClose();
  }

  return (
    <Sheet onClose={props.onClose} className="activity-sheet">
      <div className="act-pick">
        <div className="act-head">
          <div className="act-title">
            <Icon name="heartbeat" />
            {t.logActivity}
          </div>
          <p className="act-cap">{t.actPickCap}</p>
        </div>
        {(['conditioning', 'recovery'] as const).map((cat) => (
          <div key={cat} className="act-group">
            <div className="act-group-label">
              {cat === 'conditioning' ? t.actConditioning : t.actRecovery}
            </div>
            <div className="act-grid">
              {ACTIVITY_TYPES.filter((a) => a.category === cat).map((a) => (
                <button
                  key={a.key}
                  className={`act-tile cat-${a.category}`}
                  onClick={() => pick(a.key)}
                >
                  <Icon name={a.icon} />
                  <span>{t.actType[a.key] ?? a.key}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        <SleepPanel shell={props.shell} onClose={props.onClose} />
      </div>
    </Sheet>
  );
}

function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function SleepPanel(props: {
  shell: Shell;
  onClose: () => void;
  /** Minutes until the usual bedtime (schedule/pattern); drives the wind-down
   *  cue + emphasis on the Today placement. Omit in the activity drawer. */
  toBedMin?: number | null;
  /** A live session or activity is running — starting a sleep is blocked. */
  blocked?: boolean;
}) {
  const { t } = useT();
  const store = useStore();
  const live = liveSleep(store.sleeps);
  const last = lastNight(store.sleeps);
  const toBed = props.toBedMin;
  const soon = !live && toBed != null && toBed > 0 && toBed <= 60;
  const past = !live && toBed != null && toBed <= 0 && toBed >= -180;
  const emph = soon || past;
  const start = () => {
    if (!startSleep()) return; // blocked by a live session/activity
    props.shell.openOverlay({ screen: 'sleep' });
    props.onClose();
  };
  const resume = () => {
    props.shell.openOverlay({ screen: 'sleep' });
    props.onClose();
  };
  return (
    <div className="act-group">
      <div className="act-group-label">{t.sleepTitle}</div>
      <div className={`act-sleep-panel${emph ? ' emph' : ''}`}>
        <div className="act-sleep-sky" aria-hidden>
          <div className="act-sleep-moon">
            <MoonGlyph size={40} halo={false} />
          </div>
        </div>
        <div className="act-sleep-body">
          {soon && (
            <div className="act-sleep-cue">
              <Icon name="moon-stars" />
              {t.sleepWindDownIn(toBed as number)}
            </div>
          )}
          {past && (
            <div className="act-sleep-cue">
              <Icon name="moon-stars" />
              {t.sleepPastBedtime}
            </div>
          )}
          <button
            className="act-sleep-last"
            onClick={() => {
              props.shell.openOverlay({ screen: 'sleep' });
              props.onClose();
            }}
          >
            {last && last.wake
              ? t.sleepLastNight(
                  fmtDurationHuman(nightDurationMin(last) * 60000),
                  `${hhmm(last.bedtime)}→${hhmm(last.wake)}`,
                )
              : t.sleepNoLastNight}
          </button>
          {live ? (
            <button className="btn-out-moon act-sleep-start" onClick={resume}>
              {t.sleepAsleepSince(hhmm(live.bedtime))}
            </button>
          ) : props.blocked ? (
            <>
              <button className="btn-moon act-sleep-start" disabled>
                <Icon name="moon-stars" />
                {t.sleepStart}
              </button>
              <div className="act-sleep-blocked">{t.sleepBusyNote}</div>
            </>
          ) : (
            <button className="btn-moon act-sleep-start" onClick={start}>
              <Icon name="moon-stars" />
              {t.sleepStart}
            </button>
          )}
          <div className="act-sleep-links">
            <button
              className="act-sleep-link"
              onClick={() => {
                props.shell.openOverlay({ screen: 'sleep', mode: 'backfill' });
                props.onClose();
              }}
            >
              {t.sleepPastNight}
            </button>
            <button
              className="act-sleep-link"
              onClick={() => {
                props.shell.openOverlay({ screen: 'sleep', mode: 'schedule' });
                props.onClose();
              }}
            >
              {t.sleepMySchedule}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
