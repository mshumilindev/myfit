import type { TodayStrings } from '../../../i18n/coachToday';
import type { Signal } from '../../domain/types';
import type { Option } from '../../domain/diff';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Chip, ChipGroup } from '../../../components/ui/Chip';
import type { CoachWorldApi } from '../../data/useCoachWorld';
import type { DismissReason } from '../../domain/decisions';
import { DISMISS_REASONS } from '../../domain/decisions';

/** Record / Acknowledge, Wait a week, and the Dismiss panel with its reasons. */
export function DecisionActions({
  t,
  api,
  signal,
  chosen,
  record,
  dismissOpen,
  setDismissOpen,
  reason,
  setReason,
}: {
  t: TodayStrings;
  api: CoachWorldApi;
  signal: Signal;
  chosen: Option | null;
  record: () => void;
  dismissOpen: boolean;
  setDismissOpen: (f: (o: boolean) => boolean) => void;
  reason: DismissReason | null;
  setReason: (r: DismissReason) => void;
}) {
  return (
    <div className="td-actions">
      <div className="td-actions-row">
        {chosen ? (
          <Button
            variant={dismissOpen ? 'secondary' : 'fill'}
            iconTrailing="check"
            disabled={!chosen}
            onClick={record}
          >
            {t.decRecord}
          </Button>
        ) : (
          <Button
            variant={dismissOpen ? 'secondary' : 'fill'}
            iconTrailing="check"
            onClick={() => api.acknowledge(signal)}
          >
            {t.acknowledge}
          </Button>
        )}
        <Button
          variant="secondary"
          icon="clock-counter-clockwise"
          onClick={() => api.snooze(signal)}
        >
          {t.decWait}
        </Button>
        <Button
          variant="link"
          iconTrailing={dismissOpen ? 'caret-up' : 'caret-down'}
          aria-expanded={dismissOpen}
          onClick={() => setDismissOpen((o) => !o)}
        >
          {t.decDismiss}
        </Button>
      </div>
      {dismissOpen && (
        <Card pad="md" className="td-dismiss">
          <p className="td-dismiss-q" id="td-why">
            {t.decWhy} {t.decPickOne}
          </p>
          <ChipGroup role="radiogroup" aria-labelledby="td-why">
            {DISMISS_REASONS.map((r) => (
              <Chip
                key={r}
                role="radio"
                aria-checked={reason === r}
                selected={reason === r}
                icon={reason === r ? 'check' : undefined}
                onClick={() => setReason(r)}
              >
                {r === 'not-useful'
                  ? t.decReasonNotUseful
                  : r === 'already-handled'
                    ? t.decReasonHandled
                    : t.decReasonWrong}
              </Chip>
            ))}
          </ChipGroup>
          <div className="td-dismiss-act">
            <Button
              variant={reason ? 'fill' : 'secondary'}
              disabled={!reason}
              onClick={() => reason && api.dismiss(signal, reason)}
            >
              {t.decDismissConfirm}
            </Button>
            {!reason && <span className="td-hint">{t.decPickReason}</span>}
          </div>
        </Card>
      )}
    </div>
  );
}
