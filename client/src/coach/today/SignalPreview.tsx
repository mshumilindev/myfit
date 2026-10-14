import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { ClientAvatar } from '../ClientAvatar';
import { DecisionCard } from '../../components/ui/DecisionCard';
import { EvidenceChart } from '../../components/ui/EvidenceChart';
import { useTodayT } from '../../i18n/coachToday';
import type { DerivedWorld } from '../data/deriveWorld';
import { buildOptions, type Option } from '../domain/diff';
import type { Signal } from '../domain/types';
import { clientOf } from './model';
import { firstName } from './names';
import {
  describeDiffT,
  followUpDays,
  optionView,
  severityTone,
  severityWord,
  signalChart,
  signalHero,
  signalText,
} from './signalCopy';

/** Options of a signal split the way the screens use them. */
export function optionsOf(signal: Signal) {
  const all = buildOptions(signal);
  const program = all.filter((o) => o.kind === 'program');
  const suggested: Option | undefined = program.find((o) => o.suggested) ?? program[0];
  return { all, program, suggested, others: program.filter((o) => o !== suggested) };
}

export interface SignalPreviewProps {
  world: DerivedWorld;
  signal: Signal;
  /** Records the suggested option with the default message. */
  onRecord: (signal: Signal, option: Option) => void;
  /** Opens the Decision screen (optionally with an option preselected). */
  onOpenDecision: (signal: Signal, optionId?: string) => void;
  onMessage: (clientId: string) => void;
  headingLevel?: 2 | 3;
  busy?: boolean;
}

/** The decision preview of one signal: Today's detail pane, the board drawer and the phone inline card. */
export function SignalPreview({
  world,
  signal,
  onRecord,
  onOpenDecision,
  onMessage,
  headingLevel = 2,
  busy,
}: SignalPreviewProps) {
  const { t, locale } = useTodayT();
  const [more, setMore] = useState(false);
  const client = clientOf(world, signal.clientId);
  if (!client) return null;
  const text = signalText(t, signal);
  const chart = signalChart(t, signal, world.now, locale);
  const { suggested, others } = optionsOf(signal);
  const days = followUpDays(signal);
  const tags = [
    { label: severityWord(t, signal.severity), tone: severityTone(signal.severity) },
    { label: t.confidence(signal.confidence) },
    ...(world.decisions.some((d) => d.signal.key === signal.key) ? [] : [{ label: t.tagNew }]),
  ];
  return (
    <DecisionCard
      id={`sig-${signal.clientId}`}
      headingLevel={headingLevel}
      clientName={client.name}
      avatar={
        <ClientAvatar id={client.id} name={client.name} hasPhoto={client.hasPhoto} size={40} />
      }
      clientSub={t.programWeek(client.program, client.programWeek)}
      messageLabel={t.messageTo(firstName(client.name))}
      onMessage={() => onMessage(client.id)}
      tags={tags}
      title={text.title}
      body={text.body}
      hero={signalHero(t, signal) ?? undefined}
      chart={
        chart ? (
          <EvidenceChart
            points={chart.points}
            xStart={chart.xStart}
            xEnd={chart.xEnd}
            unit={chart.unit}
            plan={chart.plan}
            tone={chart.tone}
            ariaLabel={chart.aria}
            table={chart.notEnough ? undefined : chart.table}
            empty={chart.notEnough ? t.evNoData : undefined}
          />
        ) : undefined
      }
      primary={
        suggested
          ? {
              label: optionView(t, suggested).title,
              onClick: () => onRecord(signal, suggested),
              busy,
            }
          : undefined
      }
      effect={
        suggested?.diff ? t.effectLine(describeDiffT(t, suggested.diff.ops), days) : undefined
      }
      evidence={{ label: t.seeEvidence, onClick: () => onOpenDecision(signal) }}
      others={
        others.length
          ? {
              label: t.otherOptions(others.length),
              expanded: more,
              onClick: () => setMore((m) => !m),
            }
          : undefined
      }
      othersPanel={
        <ul className="td-others">
          {others.map((o) => {
            const v = optionView(t, o);
            return (
              <li key={o.id}>
                <Button variant="secondary" size="sm" onClick={() => onOpenDecision(signal, o.id)}>
                  {v.title}
                </Button>
                <span className="td-others-d">{v.description}</span>
              </li>
            );
          })}
        </ul>
      }
    />
  );
}
