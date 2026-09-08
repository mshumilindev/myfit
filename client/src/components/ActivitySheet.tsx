/**
 * Log activity (design feature 6, ACT-1): a type picker. Choosing one opens the
 * activity page for that type — nothing is logged until you press Start (or Save
 * a backfilled one) there. The live timer and backfill both live on the page.
 */
import type { Shell } from '../App';
import { startSleep, liveSleep, useStore } from '../store';
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

function SleepPanel(props: { shell: Shell; onClose: () => void }) {
  const { t } = useT();
  const store = useStore();
  const live = liveSleep(store.sleeps);
  const last = lastNight(store.sleeps);
  const start = () => {
    startSleep();
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
      <div className="act-sleep-panel">
        <div className="act-sleep-sky" aria-hidden>
          <span className="act-sleep-moon" />
        </div>
        <div className="act-sleep-body">
          <div className="act-sleep-last">
            {last && last.wake
              ? t.sleepLastNight(
                  fmtDurationHuman(nightDurationMin(last) * 60000),
                  `${hhmm(last.bedtime)}→${hhmm(last.wake)}`,
                )
              : t.sleepNoLastNight}
          </div>
          {live ? (
            <button className="btn-out-moon act-sleep-start" onClick={resume}>
              {t.sleepAsleepSince(hhmm(live.bedtime))}
            </button>
          ) : (
            <button className="btn-moon act-sleep-start" onClick={start}>
              <Icon name="moon-stars" />
              {t.sleepStart}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
