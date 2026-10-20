/**
 * Pure derivations for Today and the Decision screen from the ONE derived world (R-FE-102: counts,
 * cards and the board all read the same object). No React, no clock (the world carries `now`).
 */
import type { BoardCardData, BoardStage } from '../../components/ui/StageBoard';
import type { TodayStrings } from '../../i18n/coachToday.en';
import type { LocaleId } from '../../i18n';
import { coachDayMonth, coachMoment } from '../format';
import type { Card } from '../domain/cards';
import {
  stageOfDecision,
  type AnnotatedSignal,
  type DecisionRecord,
  type OutcomeResult,
} from '../domain/decisions';
import { rankSignals } from '../domain/signals';
import { NOISE_KG, WINDOW_DAYS } from '../domain/signalConfig';
import { DAY } from '../domain/time';
import type { CoachClient, Signal } from '../domain/types';
import type { DerivedWorld } from '../data/deriveWorld';
import { decisionTitle, kg, severityTone, severityWord, signalText } from './signalCopy';
import { firstName } from './names';

export const clientOf = (w: DerivedWorld, id: string): CoachClient | undefined =>
  w.rows.find((r) => r.client.id === id)?.client;

export interface RequestVM {
  reqId: string;
  slotId: string;
  client: CoachClient;
  /** `answer` = the client asked, you answer; `waiting` = you asked. */
  kind: 'answer' | 'waiting';
  from: number;
  to: number;
  note?: string;
  /** a team manager proposed it */
  by?: string;
}

export function requestsOf(w: DerivedWorld): RequestVM[] {
  const out: RequestVM[] = [];
  for (const s of w.pendingMoves) {
    const client = clientOf(w, s.clientId);
    if (!s.move || !client) continue;
    out.push({
      reqId: s.move.reqId,
      slotId: s.id,
      client,
      kind: s.move.from === 'client' ? 'answer' : 'waiting',
      from: s.start,
      to: s.move.start,
      note: s.move.note,
      ...(s.move.by ? { by: s.move.by } : {}),
    });
  }
  // the ones that need an answer first
  return out.sort(
    (a, b) => Number(a.kind === 'waiting') - Number(b.kind === 'waiting') || a.from - b.from,
  );
}

/** "Fri 9 Oct, 18:00" */
export const fmtMoment = (ts: number, locale: LocaleId): string => coachMoment(ts, locale);

export interface TodayModel {
  mode: 'queue' | 'week-briefs';
  requests: RequestVM[];
  needs: Card[];
  watch: Card[];
  /** open signals that did not fit into the cards: "N more in the digest" */
  digest: Signal[];
  needCount: number;
  requestCount: number;
  /** nothing to decide: no needs and no watch cards */
  allClear: boolean;
  measuring: number;
}

export function buildToday(w: DerivedWorld): TodayModel {
  const open = w.signals.filter((a) => a.state === 'open').map((a) => a.signal);
  const shown = new Set(w.picked.cards.flatMap((c) => c.signals.map((s) => s.key)));
  const requests = requestsOf(w);
  const needs = w.picked.cards.filter((c) => c.bucket === 'decide');
  const watch = w.picked.cards.filter((c) => c.bucket === 'watch');
  return {
    mode: w.picked.mode,
    requests,
    needs,
    watch,
    digest: rankSignals(open.filter((s) => !shown.has(s.key))),
    needCount: w.counts.needDecision,
    requestCount: requests.filter((r) => r.kind === 'answer').length,
    allClear: needs.length === 0 && watch.length === 0,
    measuring: w.summary.measuring,
  };
}

export const findSignal = (w: DerivedWorld, key: string): AnnotatedSignal | undefined =>
  w.signals.find((a) => a.signal.key === key);

/** First card to open by default: the first that needs a decision, else the first to watch. */
export const defaultOpenKey = (m: TodayModel): string | null =>
  m.needs[0]?.primary.key ?? m.watch[0]?.primary.key ?? null;

/** "In N of your M similar past decisions": only from 5 measured ones of the same signal type. */
export function similarDecisions(
  decisions: readonly DecisionRecord[],
  kind: Signal['kind'],
): { helped: number; total: number } | null {
  const done = decisions.filter(
    (d) =>
      d.kind === 'program' &&
      d.signal.kind === kind &&
      d.outcome &&
      d.outcome.result !== 'measuring',
  );
  if (done.length < 5) return null;
  return {
    helped: done.filter((d) => d.outcome?.result === 'improved').length,
    total: done.length,
  };
}

/* ---- board ------------------------------------------------------------------------------------------------- */

export const BOARD_STAGES = ['signal', 'evidence', 'decided', 'measuring', 'result'] as const;
export type BoardStageId = (typeof BOARD_STAGES)[number];
const STAGE_ICON: Record<BoardStageId, string> = {
  signal: 'pulse',
  evidence: 'magnifying-glass',
  decided: 'check-circle',
  measuring: 'timer',
  result: 'medal',
};
/** Signals that carry no evidence to read yet: informational / waiting for data. */
const SIGNAL_ONLY = new Set<Signal['kind']>(['nodata', 'ready', 'pr']);
const RESULT_CARDS = 4;

const resultTone = (r: OutcomeResult) =>
  r === 'improved' ? 'ok' : r === 'declined' ? 'danger' : r === 'measuring' ? 'illness' : 'neutral';
const resultWord = (t: TodayStrings, r: OutcomeResult) =>
  r === 'improved'
    ? t.improved
    : r === 'declined'
      ? t.declined
      : r === 'measuring'
        ? t.measuring
        : t.noChange;

export type BoardTarget = { type: 'signal'; key: string } | { type: 'decision'; id: string };

export interface BoardModel {
  stages: BoardStage[];
  targets: Record<string, BoardTarget>;
  summary: string;
}

export function buildBoard(w: DerivedWorld, t: TodayStrings, locale: LocaleId): BoardModel {
  const targets: Record<string, BoardTarget> = {};
  const name = (id: string) => clientOf(w, id)?.name ?? '';
  const face = (id: string) => ({ clientId: id, hasPhoto: clientOf(w, id)?.hasPhoto });
  const fromSignal = (s: Signal): BoardCardData => {
    const id = `sig:${s.key}`;
    targets[id] = { type: 'signal', key: s.key };
    const x = signalText(t, s);
    return {
      id,
      name: firstName(name(s.clientId)),
      fullName: name(s.clientId),
      ...face(s.clientId),
      status: severityWord(t, s.severity),
      tone: severityTone(s.severity),
      title: x.title,
      line: x.line,
    };
  };
  const open = rankSignals(w.signals.filter((a) => a.state === 'open').map((a) => a.signal));
  const recs = w.decisions;
  const waiting = recs.filter(
    (d) => d.kind === 'wait' && d.windowEndsAt != null && d.windowEndsAt > w.now,
  );
  const measuring = recs.filter((d) => d.kind === 'program' && stageOfDecision(d) === 'measuring');
  const result = recs
    .filter((d) => d.kind === 'program' && stageOfDecision(d) === 'result')
    .slice(0, RESULT_CARDS);

  const fromDecision = (
    d: DecisionRecord,
    status: string,
    tone: BoardCardData['tone'],
    line: string,
  ): BoardCardData => {
    const id = `dec:${d.id}`;
    targets[id] = { type: 'decision', id: d.id };
    return {
      id,
      name: firstName(name(d.clientId)),
      fullName: name(d.clientId),
      ...face(d.clientId),
      status,
      tone,
      title: d.kind === 'wait' ? t.optWait : decisionTitle(t, d.diff, d.optionId),
      line,
    };
  };

  const stages: BoardStage[] = BOARD_STAGES.map((id) => {
    let cards: BoardCardData[] = [];
    if (id === 'signal') cards = open.filter((s) => SIGNAL_ONLY.has(s.kind)).map(fromSignal);
    if (id === 'evidence') cards = open.filter((s) => !SIGNAL_ONLY.has(s.kind)).map(fromSignal);
    if (id === 'decided')
      cards = waiting.map((d) =>
        fromDecision(d, t.waiting, 'illness', t.waitUntil(coachDayMonth(d.windowEndsAt!, locale))),
      );
    if (id === 'measuring')
      cards = measuring.map((d) => {
        const total = Math.max(
          1,
          Math.round(((d.windowEndsAt ?? d.decidedAt) - d.decidedAt) / DAY),
        );
        const day = Math.min(total, Math.max(1, Math.floor((w.now - d.decidedAt) / DAY) + 1));
        return fromDecision(d, t.measuring, 'illness', t.measuringDay(day, total));
      });
    if (id === 'result')
      cards = result.map((d) => {
        const r = d.outcome?.result ?? 'no-clear-change';
        const diff = d.outcome?.before != null && d.outcome?.after != null;
        return fromDecision(
          d,
          resultWord(t, r),
          resultTone(r),
          t.resultLine(
            resultWord(t, r),
            diff ? kg(d.outcome!.before!) : null,
            diff ? kg(d.outcome!.after!) : null,
          ),
        );
      });
    return { id, label: stageLabel(t, id), icon: STAGE_ICON[id], cards };
  });

  const s = w.summary;
  const pct = s.total ? Math.round((s.improved / s.total) * 100) : 0;
  return {
    stages,
    targets,
    summary: t.boardSummary(s.improved, s.total, pct, s.measuring, kg(NOISE_KG), WINDOW_DAYS),
  };
}

export const stageLabel = (t: TodayStrings, id: BoardStageId): string =>
  id === 'signal'
    ? t.stageSignal
    : id === 'evidence'
      ? t.stageEvidence
      : id === 'decided'
        ? t.stageDecided
        : id === 'measuring'
          ? t.stageMeasuring
          : t.stageResult;
