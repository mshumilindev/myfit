/**
 * Log activity (design feature 6, ACT-1): a type picker. Choosing one opens the
 * activity page for that type — nothing is logged until you press Start (or Save
 * a backfilled one) there. The live timer and backfill both live on the page.
 */
import type { Shell } from '../App';
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
      </div>
    </Sheet>
  );
}
