import { useState } from 'react';
import './Schedule.css';
import { Button } from '../../components/ui/Button';
import { ConfirmEffectsDialog } from '../../components/ui/ConfirmEffectsDialog';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Tag } from '../../components/ui/Tag';
import type { ScheduleStrings } from '../../i18n/coachSchedule';
import { statusAt } from './model';
import type { People } from './people';
import { groupProgress } from './requests';
import type { ScheduleStore } from './scheduleStore';
import type { RescheduleRequest } from './types';

export interface GroupMoveSummaryProps {
  groupKey: string;
  requests: readonly RescheduleRequest[];
  store: ScheduleStore;
  people: People;
  t: ScheduleStrings;
  now: number;
}

/**
 * Trainer-only summary of a whole-session move: how many attendees said yes, who is still waiting, who declined.
 * The session moves only when everyone has said yes (a person kept on the old time does not count).
 */
export function GroupMoveSummary(p: GroupMoveSummaryProps) {
  const { t, people } = p;
  const [confirm, setConfirm] = useState(false);
  const reqs = p.requests
    .filter(
      (r) => r.groupKey === p.groupKey && r.status !== 'cancelled' && r.status !== 'countered',
    )
    .map((r) => ({ ...r, status: statusAt(r, p.now) }));
  const g = groupProgress(reqs);
  return (
    <div className="sc-gm" role="group" aria-label={t.gmTitle}>
      <div className="sc-gm-head">
        <strong>{t.gmTitle}</strong>
        <span>{g.accepted === g.total ? t.gmAll : t.gmProgress(g.accepted, g.total)}</span>
      </div>
      <ProgressBar
        value={g.total ? (g.accepted / g.total) * 100 : 0}
        tone="ok"
        label={t.gmProgress(g.accepted, g.total)}
      />
      <ul className="sc-gm-list">
        {reqs.map((r) => (
          <li key={r.id} className="sc-gm-row">
            <span>{people.name(r.clientId)}</span>
            <Tag
              tone={r.status === 'accepted' ? 'ok' : r.status === 'declined' ? 'danger' : 'neutral'}
            >
              {r.status === 'accepted'
                ? t.rcAccepted
                : r.status === 'declined'
                  ? t.rcDeclined
                  : r.status === 'expired'
                    ? t.rcExpired
                    : t.rcPending}
            </Tag>
          </li>
        ))}
      </ul>
      <p className="sc-gm-hint">{t.gmHint}</p>
      <Button variant="secondary" size="sm" onClick={() => setConfirm(true)}>
        {t.gmCancel}
      </Button>
      {confirm && (
        <ConfirmEffectsDialog
          title={t.gmCancelH}
          body={t.gmCancelB}
          confirmLabel={t.gmCancelConfirm}
          cancelLabel={t.gmKeepMove}
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            void p.store.cancelGroup(p.groupKey);
          }}
        />
      )}
    </div>
  );
}
