import { Button } from '../../components/ui/Button';
import { DecisionRecord } from '../../components/ui/DecisionRecord';
import { Notice } from '../../components/ui/Notice';
import { UndoToast } from '../../components/ui/UndoToast';
import { useSafeT } from '../../i18n/coachSafe';
import type { C360Strings } from '../../i18n/coachClient360';
import type { DecisionsStrings } from '../../i18n/coachDecisions';
import type { RosterStrings } from '../../i18n/coachRoster';
import type { TodayStrings } from '../../i18n/coachToday.en';
import type { LocaleId } from '../../i18n';
import { ClientAvatar } from '../ClientAvatar';
import { coachDayMonth } from '../format';
import {
  evidenceText,
  followUpOf,
  noiseText,
  resultLabel,
  RESULT_TONE,
  resultText,
  whatText,
  type DecisionRow,
} from './decisionModel';
import { firstName } from './format';
import { useDecisionShare } from './useDecisionShare';

export interface DecisionRecordViewProps {
  row: DecisionRow;
  c: C360Strings;
  d: DecisionsStrings;
  r: RosterStrings;
  t: TodayStrings;
  locale: LocaleId;
  now: number;
  /** Program of the client, shown under the name. */
  program: string;
  onOpenClient?: () => void;
  onOpenEvidence: () => void;
  onNewDecision: () => void;
}

/** One Decision record (S-19): the stored decision in words, its follow-up and the three actions. */
export function DecisionRecordView({
  row,
  c,
  d,
  r,
  t,
  locale,
  now,
  program,
  onOpenClient,
  onOpenEvidence,
  onNewDecision,
}: DecisionRecordViewProps) {
  const { rec } = row;
  const first = firstName(row.name);
  const { sf } = useSafeT();
  /* Sharing is a real write: a shared note anchored to this decision, through the notes port (sealed). */
  const share = useDecisionShare(rec.clientId, rec.id, () => ({
    label: row.title,
    text: `${row.title}\n${resultText(c, rec, now)}`,
  }));
  const { shared } = share;
  const fu = followUpOf(rec, now);
  return (
    <>
      <DecisionRecord
        avatar={
          <ClientAvatar id={rec.clientId} name={row.name} hasPhoto={row.hasPhoto} size={40} />
        }
        name={row.name}
        sub={c.drDecided(program, coachDayMonth(rec.decidedAt, locale))}
        onOpenClient={onOpenClient}
        result={{
          label: resultLabel(t, d, row.result),
          tone: RESULT_TONE[row.result],
          icon: row.result === 'measuring' ? 'hourglass' : undefined,
        }}
        stepsLabel={c.drStepsLabel}
        steps={[
          { id: 'what', icon: 'pulse', title: c.drWhat, body: whatText(c, r, rec) },
          { id: 'ev', icon: 'magnifying-glass', title: c.drEvidence, body: evidenceText(c, rec) },
          { id: 'dec', icon: 'check-circle', title: c.drDecision, body: row.title },
          { id: 'res', icon: 'target', title: c.drResult, body: resultText(c, rec, now) },
        ]}
        followUp={
          fu
            ? {
                title: c.drFollowUp(fu.total),
                status: fu.closed ? c.drClosed : c.drDay(fu.day, fu.total),
                value: (fu.day / fu.total) * 100,
                tone: fu.closed ? 'ok' : 'accent',
                progressLabel: c.drProgress,
                notes: [
                  fu.closed ? c.drMeasuredOver(fu.total) : c.drMeasuring(fu.total),
                  noiseText(c),
                ],
              }
            : undefined
        }
        actions={
          <>
            <Button variant="primary" iconTrailing="arrow-right" onClick={onOpenEvidence}>
              {c.drOpenEvidence}
            </Button>
            <Button variant="secondary" icon="plus" onClick={onNewDecision}>
              {c.drNewDecision}
            </Button>
            <Button
              variant="secondary"
              icon={shared ? 'check' : 'share-network'}
              aria-pressed={shared}
              disabled={share.busy}
              onClick={() => void share.toggle()}
            >
              {shared ? c.drShared(first) : c.drShare(first)}
            </Button>
          </>
        }
        footnote={c.drSees(first)}
      />
      {share.failed && (
        <Notice tone="injury" icon="warning-circle" role="alert">
          {sf.dsFailed}
        </Notice>
      )}
      {share.toast && (
        <UndoToast
          position="fixed"
          icon={share.toast.kind === 'shared' ? 'check-circle' : 'eye-slash'}
          tone={share.toast.kind === 'shared' ? 'ok' : 'danger'}
          text={share.toast.kind === 'shared' ? c.drShared(first) : sf.dsUnsharedToast(first)}
          undoLabel={sf.undo}
          countdownLabel={sf.undoCountdown}
          onUndo={() => void share.undo()}
        />
      )}
    </>
  );
}
