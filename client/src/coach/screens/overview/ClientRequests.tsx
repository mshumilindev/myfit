import { useState } from 'react';
import { RequestCard } from '../../../components/ui/RequestCard';
import { coachMoment } from '../../format';
import { useTodayT } from '../../../i18n/coachToday';
import { type RequestVM } from '../../today/model';
import { type RescheduleRequestPort } from '../../today/requestPort';
import { firstName } from '../format';

export type Answered = Record<string, 'accepted' | 'declined' | 'cancelled'>;

/** The client's pending reschedule requests, answered right here (same card and order as Today). */
export function ClientRequests({
  reqs,
  port,
  locale,
}: {
  reqs: RequestVM[];
  port: RescheduleRequestPort;
  locale: ReturnType<typeof useTodayT>['locale'];
}) {
  const { t } = useTodayT();
  const [answered, setAnswered] = useState<Answered>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  const run = async (q: RequestVM, kind: Answered[string], fn: () => Promise<void>) => {
    setBusy((b) => ({ ...b, [q.reqId]: true }));
    setFailed((f) => ({ ...f, [q.reqId]: false }));
    try {
      await fn();
      setAnswered((a) => ({ ...a, [q.reqId]: kind }));
    } catch {
      setFailed((f) => ({ ...f, [q.reqId]: true }));
    } finally {
      setBusy((b) => ({ ...b, [q.reqId]: false }));
    }
  };

  return (
    <ul className="c3-reqs">
      {reqs.map((q) => {
        const n = firstName(q.client.name);
        const ans = { reqId: q.reqId, slotId: q.slotId, clientId: q.client.id };
        const done = answered[q.reqId];
        return (
          <li key={q.reqId}>
            <RequestCard
              flat
              kind={q.kind}
              title={q.kind === 'answer' ? t.askMove(n) : t.waitingFor(n)}
              status={q.kind === 'answer' ? t.needsAnswer : t.waitingFor(n)}
              fromLabel={t.moveFrom}
              from={coachMoment(q.from, locale)}
              toLabel={t.moveTo}
              to={coachMoment(q.to, locale)}
              note={q.note}
              busy={busy[q.reqId]}
              errorText={failed[q.reqId] ? t.requestFailed : undefined}
              resultText={
                done === 'accepted'
                  ? t.requestAccepted(n)
                  : done === 'declined'
                    ? t.requestDeclined(n)
                    : done === 'cancelled'
                      ? t.requestCancelled(n)
                      : undefined
              }
              accept={{
                label: t.accept,
                ariaLabel: t.acceptFor(n),
                onClick: () => void run(q, 'accepted', () => port.accept(ans)),
              }}
              decline={{
                label: t.decline,
                ariaLabel: t.declineFor(n),
                onClick: () => void run(q, 'declined', () => port.decline(ans)),
              }}
              propose={{
                label: t.proposeAnother,
                ariaLabel: t.proposeFor(n),
                onClick: () => port.propose(ans),
              }}
              cancel={{
                label: t.cancelRequest,
                ariaLabel: t.cancelFor(n),
                onClick: () => void run(q, 'cancelled', () => port.cancel(ans)),
              }}
            />
          </li>
        );
      })}
    </ul>
  );
}
