import { useState } from 'react';
import { ClientRow } from '../../components/ui/RosterRows';
import { RequestCard } from '../../components/ui/RequestCard';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { ClientAvatar } from '../ClientAvatar';
import { useTodayT } from '../../i18n/coachToday';
import { type CoachWorldApi } from '../data/useCoachWorld';
import type { Option } from '../domain/diff';
import type { Signal } from '../domain/types';
import { SignalPreview } from './SignalPreview';
import { buildToday, clientOf, fmtMoment, type RequestVM } from './model';
import { firstName } from './names';
import type { RescheduleRequestPort } from './requestPort';
import { severityWord, signalText } from './signalCopy';

export type Answered = Record<string, 'accepted' | 'declined' | 'cancelled'>;

export function RequestsSection({
  requests,
  port,
  locale,
}: {
  requests: RequestVM[];
  port: RescheduleRequestPort;
  locale: ReturnType<typeof useTodayT>['locale'];
}) {
  const { t } = useTodayT();
  const [answered, setAnswered] = useState<Answered>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  if (!requests.length) return null;

  const run = async (r: RequestVM, kind: Answered[string], fn: () => Promise<void>) => {
    setBusy((b) => ({ ...b, [r.reqId]: true }));
    setFailed((f) => ({ ...f, [r.reqId]: false }));
    try {
      await fn();
      setAnswered((a) => ({ ...a, [r.reqId]: kind }));
    } catch {
      setFailed((f) => ({ ...f, [r.reqId]: true }));
    } finally {
      setBusy((b) => ({ ...b, [r.reqId]: false }));
    }
  };

  return (
    <section className="td-sec" aria-labelledby="td-h-req">
      <SectionLabel role="heading" aria-level={2} id="td-h-req" action={requests.length}>
        {t.sectionRequests}
      </SectionLabel>
      <ul className="td-reqs">
        {requests.map((r) => {
          const n = firstName(r.client.name);
          const ans = { reqId: r.reqId, slotId: r.slotId, clientId: r.client.id };
          const done = answered[r.reqId];
          return (
            <li key={r.reqId}>
              <RequestCard
                kind={r.kind}
                title={r.kind === 'answer' ? t.askMove(n) : t.waitingFor(n)}
                status={r.kind === 'answer' ? t.needsAnswer : t.waitingFor(n)}
                fromLabel={t.moveFrom}
                from={fmtMoment(r.from, locale)}
                toLabel={t.moveTo}
                to={fmtMoment(r.to, locale)}
                note={r.note}
                busy={busy[r.reqId]}
                errorText={failed[r.reqId] ? t.requestFailed : undefined}
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
                  onClick: () => void run(r, 'accepted', () => port.accept(ans)),
                }}
                decline={{
                  label: t.decline,
                  ariaLabel: t.declineFor(n),
                  onClick: () => void run(r, 'declined', () => port.decline(ans)),
                }}
                propose={{
                  label: t.proposeAnother,
                  ariaLabel: t.proposeFor(n),
                  onClick: () => port.propose(ans),
                }}
                cancel={{
                  label: t.cancelRequest,
                  ariaLabel: t.cancelFor(n),
                  onClick: () => void run(r, 'cancelled', () => port.cancel(ans)),
                }}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export interface CardsSectionProps {
  id: string;
  label: string;
  cards: ReturnType<typeof buildToday>['needs'];
  world: NonNullable<CoachWorldApi['world']>;
  openKey: string | null;
  inline: boolean;
  onSelect: (key: string) => void;
  onRecord: (s: Signal, o: Option) => void;
  onOpenDecision: (s: Signal, optionId?: string) => void;
  onMessage: (clientId: string) => void;
}

export function CardsSection({
  id,
  label,
  cards,
  world,
  openKey,
  inline,
  onSelect,
  onRecord,
  onOpenDecision,
  onMessage,
}: CardsSectionProps) {
  const { t } = useTodayT();
  return (
    <section className="td-sec" aria-labelledby={`td-h-${id}`}>
      <SectionLabel role="heading" aria-level={2} id={`td-h-${id}`} action={cards.length}>
        {label}
      </SectionLabel>
      <ul className="td-rows">
        {cards.map((c) => {
          const s = c.primary;
          const client = clientOf(world, c.clientId);
          const expanded = inline && openKey === s.key;
          if (expanded) {
            return (
              <li key={s.key}>
                <SignalPreview
                  world={world}
                  signal={s}
                  headingLevel={3}
                  onRecord={onRecord}
                  onOpenDecision={onOpenDecision}
                  onMessage={onMessage}
                />
              </li>
            );
          }
          const title = signalText(t, s).title;
          return (
            <li key={s.key}>
              <ClientRow
                name={client?.name ?? ''}
                avatar={
                  <ClientAvatar
                    id={client?.id}
                    name={client?.name ?? ''}
                    hasPhoto={client?.hasPhoto}
                    size={40}
                  />
                }
                program={c.count > 1 ? `${title} · +${c.count - 1}` : title}
                selected={!inline && openKey === s.key}
                status={s.severity}
                statusLabel={severityWord(t, s.severity)}
                onClick={() => onSelect(s.key)}
                ariaLabel={`${client?.name ?? ''}: ${title}, ${severityWord(t, s.severity)}`}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
