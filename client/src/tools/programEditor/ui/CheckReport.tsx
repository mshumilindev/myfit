import { useMemo } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { FindingRow } from '../../../components/ui/FindingRow';
import { RangeBar } from '../../../components/ui/RangeBar';
import { SectionLabel } from '../../../components/ui/SectionLabel';
import { Tag } from '../../../components/ui/Tag';
import type { Tone } from '../../../components/ui/tones';
import {
  CARDIO_BAND,
  MUSCLE_BAND,
  type Check,
  type Finding,
  type MuscleVolume,
  type Sev,
} from '../check/engine';
import type { ProgramEditorHost } from '../host';
import type { ProgramEditorLabels, ProgramEditorWords } from '../labels';
import { dayName, type ProgramDoc } from '../model/doc';
import { firstName } from './text';

export const SEV_TONE: Record<Sev, Tone> = {
  fix: 'danger',
  review: 'illness',
  note: 'rest',
  ok: 'ok',
};
export const SEV_ICON: Record<Sev, string> = {
  fix: 'warning',
  review: 'warning',
  note: 'info',
  ok: 'check-circle',
};

/** Title and reason of one finding: words from the dictionary, every number from the check's facts. */
export function findingText(
  p: ProgramEditorLabels,
  t: Pick<ProgramEditorWords, 'muscleGroups'>,
  f: Finding,
  first: string,
  host?: Pick<ProgramEditorHost, 'describeFinding'>,
): { title: string; body: string } {
  const g = (k: unknown) => t.muscleGroups[String(k)] ?? String(k);
  const list = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);
  const x = f.facts;
  switch (f.kind) {
    case 'range':
      return {
        title: x.state === 'low' ? p.ckRangeLow(g(x.group)) : p.ckRangeHigh(g(x.group)),
        body: p.ckRangeBody(String(x.sets), Number(x.min), Number(x.max), list(x.bare)),
      };
    case 'open':
      return {
        title: p.ckOpenTitle(list(x.groups).length),
        body: p.ckOpenBody(list(x.groups).map(g).join(', '), first),
      };
    case 'bare':
      return { title: p.ckBareTitle(Number(x.n)), body: p.ckBareBody(first) };
    case 'musclesDay':
      return {
        title: p.ckMusclesDayTitle(String(x.name)),
        body: p.ckMusclesDayBody(list(x.muscles).map(g).join(', '), first),
      };
    case 'pushPull':
      return f.sev === 'ok'
        ? { title: p.ckPPOkTitle(Number(x.pull), Number(x.push)), body: p.ckPPOkBody }
        : { title: p.ckPPTitle(Number(x.pull), Number(x.push)), body: p.ckPPBody(String(x.ratio)) };
    case 'pictures':
      return {
        title: p.ckPicTitle(list(x.names).length),
        body: p.ckPicBody(list(x.names).join(', '), first),
      };
    case 'onceAWeek':
      return f.sev === 'ok'
        ? { title: p.ckOnceOkTitle, body: p.ckOnceOkBody }
        : { title: p.ckOnceTitle(list(x.groups).map(g).join(', ')), body: p.ckOnceBody };
    case 'cardio':
      return {
        title: p.ckCardioTitle(Number(x.min)),
        body:
          f.sev === 'ok'
            ? p.ckCardioOk(Number(x.from), Number(x.to), Number(x.recovery))
            : p.ckCardioOff(Number(x.from), Number(x.to)),
      };
    case 'restriction':
      return {
        title: p.ckRestrTitle(String(x.exercise)),
        body: p.ckRestrBody(String(x.restriction), first),
      };
    case 'emptyDay':
      return { title: p.ckEmptyTitle(String(x.name)), body: p.ckEmptyBody };
    default:
      return host?.describeFinding?.(f) ?? { title: String(f.kind), body: '' };
  }
}

const stateWord = (p: ProgramEditorLabels, v: MuscleVolume): string =>
  v.state === 'low'
    ? p.ckBelow
    : v.state === 'high'
      ? p.ckAbove
      : v.state === 'open'
        ? p.ckNoSets
        : p.ckInRange;
const stateTone = (v: MuscleVolume): Tone =>
  v.state === 'ok'
    ? 'ok'
    : v.state === 'open'
      ? 'rest'
      : v.state === 'low' && v.sets < v.band[0] * 0.8
        ? 'danger'
        : 'illness';

/** One line per finding that blocks Send (the host's gate dialog and the check read the same words). */
export function gateLine(
  p: ProgramEditorLabels,
  t: Pick<ProgramEditorWords, 'muscleGroups'>,
  f: { kind: string; facts: Record<string, string | number | readonly string[]> },
): string {
  if (f.kind === 'range') {
    const g = t.muscleGroups[String(f.facts.group)] ?? String(f.facts.group);
    return `${f.facts.state === 'low' ? p.ckRangeLow(g) : p.ckRangeHigh(g)}: ${p.ckRangeBody(String(f.facts.sets), Number(f.facts.min), Number(f.facts.max), [])}`;
  }
  if (f.kind === 'restriction') return p.ckRestrTitle(String(f.facts.exercise));
  if (f.kind === 'emptyDay') return p.ckEmptyTitle(String(f.facts.name));
  return p.ckFixInEditor;
}

export interface CheckReportProps {
  check: Check;
  doc: ProgramDoc;
  labels: ProgramEditorLabels;
  words: ProgramEditorWords;
  /** Who the program is for (the sentences speak about them). */
  audience: string;
  host?: Pick<ProgramEditorHost, 'describeFinding'>;
  /** "Fix in editor" on a finding that has a place to go. Omitted: the finding has no action. */
  onFix?: (f: Finding) => void;
}

/**
 * The body of "Check before sending": counts, findings, weekly sets per muscle, push / pull and planned activities.
 * Presentational: the numbers come from `runCheck`, the words from the labels. The host puts it in its own page
 * (header, send card, sticky bar).
 */
export function CheckReport({
  check,
  doc,
  labels: p,
  words: t,
  audience,
  host,
  onFix,
}: CheckReportProps) {
  const first = firstName(audience);
  const fixIn = (f: Finding) => onFix?.(f);
  const maxScale = useMemo(
    () => Math.max(20, ...(check?.volume ?? []).map((v) => Math.ceil(v.sets + 2))),
    [check],
  );
  const ppMax = Math.max(
    10,
    Math.ceil(Math.max(check?.pushPull.pull ?? 0, check?.pushPull.push ?? 0) * 1.2),
  );
  const actMax = Math.max(
    CARDIO_BAND[1],
    Math.ceil((check?.activities.cardioMin ?? 0) * 1.1),
    check?.activities.recoveryMin ?? 0,
  );
  const { counts } = check;
  const draft = doc;
  return (
    <>
      <Card pad="md">
        <div className="pe-counts" role="status">
          {(
            [
              [counts.fix, p.ckToFix, 'danger'],
              [counts.review, p.ckToReview, 'illness'],
              [counts.note, p.ckNoTarget, 'rest'],
              [counts.ok, p.ckFine, 'ok'],
            ] as const
          ).map(([n, word, tone]) => (
            <span key={word} className={`pe-count uit uit--${tone}`}>
              <b>{n}</b>
              <span>{word}</span>
            </span>
          ))}
        </div>
        <p className="pe-note">
          {p.ckSummary(check.inRange, check.volume.length, counts.note > 0)}
        </p>
      </Card>

      <Card pad="md">
        <SectionLabel action={<span className="pe-note">{p.ckChecks(check.findings.length)}</span>}>
          {p.ckFindings}
        </SectionLabel>
        <ul className="pe-finds">
          {check.findings.map((f) => {
            const tx = findingText(p, t, f, first, host);
            const canFix = f.sev === 'fix' || f.sev === 'review';
            return (
              <FindingRow
                key={f.id}
                icon={SEV_ICON[f.sev]}
                tone={SEV_TONE[f.sev]}
                title={tx.title}
                body={tx.body}
                status={p.ckSevLabel[f.sev]}
                action={
                  canFix && f.fix && onFix ? (
                    <Button
                      variant="link"
                      size="sm"
                      iconTrailing="arrow-right"
                      onClick={() => fixIn(f)}
                    >
                      {f.kind === 'pictures' ? p.ckAddPictures : p.ckFixInEditor}
                    </Button>
                  ) : undefined
                }
              />
            );
          })}
        </ul>
      </Card>

      <Card pad="md">
        <SectionLabel action={<span className="pe-note">{p.ckSetsMeta}</span>}>
          {p.ckSetsPerMuscle}
        </SectionLabel>
        <ul className="pe-vols">
          {check.volume.map((v) => {
            const name = t.muscleGroups[v.group] ?? v.group;
            const band = MUSCLE_BAND[v.group];
            const sets = String(v.sets);
            return (
              <li key={v.group} className="pe-vol">
                <span className="pe-vol-n">{name}</span>
                <RangeBar
                  value={v.sets}
                  max={maxScale}
                  band={band}
                  tone={stateTone(v)}
                  label={p.ckBarAria(name, sets, band[0], band[1], stateWord(p, v))}
                />
                <span className="pe-vol-v">
                  <b>{v.state === 'open' ? '–' : sets}</b>
                  <Tag tone={stateTone(v)}>{stateWord(p, v)}</Tag>
                </span>
                <span className="pe-note pe-vol-r">{p.ckRange(band[0], band[1])}</span>
              </li>
            );
          })}
        </ul>
        <p className="pe-note">{p.ckBandNote(maxScale)}</p>
      </Card>

      <Card pad="md">
        <SectionLabel>{p.ckPushPull}</SectionLabel>
        <ul className="pe-vols">
          {(
            [
              [p.ckPull, p.ckPullMuscles, check.pushPull.pull],
              [p.ckPush, p.ckPushMuscles, check.pushPull.push],
            ] as const
          ).map(([name, muscles, n]) => (
            <li key={name} className="pe-vol">
              <span className="pe-vol-n">
                {name}
                <small className="pe-note">{p.ckSetsAWeek}</small>
              </span>
              <RangeBar
                value={n}
                max={ppMax}
                tone="accent"
                label={`${name}: ${n} ${p.ckSetsAWeek}`}
              />
              <span className="pe-vol-v">
                <b>{n}</b>
              </span>
              <span className="pe-note pe-vol-r">{muscles}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card pad="md">
        <SectionLabel action={<span className="pe-note">{p.ckBeside}</span>}>
          {p.ckActivities}
        </SectionLabel>
        <ul className="pe-vols">
          <li className="pe-vol">
            <span className="pe-vol-n">
              {p.ckCardioRow}
              <small className="pe-note">{p.ckRange(CARDIO_BAND[0], CARDIO_BAND[1])}</small>
            </span>
            <RangeBar
              value={check.activities.cardioMin}
              max={actMax}
              band={CARDIO_BAND}
              tone={
                check.activities.cardioMin >= CARDIO_BAND[0] &&
                check.activities.cardioMin <= CARDIO_BAND[1]
                  ? 'ok'
                  : 'illness'
              }
              label={`${p.ckCardioRow} ${p.ckMin(check.activities.cardioMin)}, ${p.ckRange(CARDIO_BAND[0], CARDIO_BAND[1])}`}
            />
            <span className="pe-vol-v">
              <b>{p.ckMin(check.activities.cardioMin)}</b>
            </span>
          </li>
          <li className="pe-vol">
            <span className="pe-vol-n">
              {p.ckRecoveryRow}
              <small className="pe-note">{p.ckRecoveryNote}</small>
            </span>
            <RangeBar
              value={check.activities.recoveryMin}
              max={actMax}
              tone="rest"
              label={`${p.ckRecoveryRow} ${p.ckMin(check.activities.recoveryMin)}, ${p.ckNoRange}`}
            />
            <span className="pe-vol-v">
              <b>{p.ckMin(check.activities.recoveryMin)}</b>
            </span>
          </li>
        </ul>
        <ul className="pe-acts-list">
          <li>
            <b>{p.ckCardioRow}</b> <span>{p.ckMin(check.activities.cardioMin)}</span>{' '}
            <span className="pe-note">{p.ckRange(60, 150)}</span>
          </li>
          <li>
            <b>{p.ckRecoveryRow}</b> <span>{p.ckMin(check.activities.recoveryMin)}</span>{' '}
            <span className="pe-note">
              {p.ckRecoveryNote} · {p.ckNoRange}
            </span>
          </li>
          {check.activities.rows.map((a) => (
            <li key={a.id} className="pe-note">
              {p.ckActRow(
                dayName(draft, a.day),
                `${t.actType[a.type] ?? a.type} · ${p.ckMin(a.minutes)}`,
              )}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
