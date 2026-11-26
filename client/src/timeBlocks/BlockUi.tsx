import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Chip } from '../components/ui/Chip';
import { NumberStepper } from '../components/ui/NumberStepper';
import { Tag } from '../components/ui/Tag';
import { Icon } from '../ui';
import { useT } from '../i18n';
import {
  blockRemainSec,
  blockView,
  type BlockMember,
  type BlockResult,
  type BlockSpec,
  type BlockView,
  type WorkoutBlock,
} from './model';
import { mmss, specTitle } from './specText';
import { STRINGS, type TimeBlocksStrings } from './strings';
import './blocks.css';

export const FMT_ICON = {
  amrap: 'arrow-clockwise',
  emom: 'timer',
  fortime: 'flag-checkered',
  intervals: 'lightning',
} as const;

export const useBlockStrings = (): TimeBlocksStrings => STRINGS[useT().locale];

/** "5 Pullups · 10 Pushups" */
export const membersLine = (ms: readonly BlockMember[]) =>
  ms.map((m) => `${m.reps ?? ''} ${m.name}`.trim()).join(' · ');

function Members({ members }: { members: readonly BlockMember[] }) {
  if (!members.length) return null;
  return (
    <ul className="tb-mems">
      {members.map((m, i) => (
        <li key={`${m.name}-${i}`} className="tb-mem">
          <span className="tb-mem-n">{m.reps}</span>
          <span className="tb-mem-name">{m.name}</span>
        </li>
      ))}
    </ul>
  );
}

export function FormatTag({ fmt }: { fmt: BlockSpec['fmt'] }) {
  const t = useBlockStrings();
  return (
    <Tag tone="conditioning" icon={<Icon name={FMT_ICON[fmt]} />}>
      {t.formats[fmt]}
    </Tag>
  );
}

/** A built block before it starts: Edit, the members, Add exercise, one Start. */
export function BlockReadyCard(p: {
  block: WorkoutBlock;
  onEdit: () => void;
  onStart: () => void;
}) {
  const t = useBlockStrings();
  const { spec, members } = p.block;
  return (
    <div className="tb-card" data-testid="block-ready">
      <div className="tb-row">
        <Icon name={FMT_ICON[spec.fmt]} />
        <div className="tb-main">
          <div className="tb-t">{specTitle(spec)}</div>
          <div className="tb-sub tb-cap">
            <b>{t.formats[spec.fmt]}</b> {t.ready}
          </div>
        </div>
        <Button variant="ghost" size="sm" icon="sliders" onClick={p.onEdit}>
          {t.edit}
        </Button>
      </div>
      <Members members={members} />
      <Button variant="secondary" size="sm" icon="plus" fullWidth onClick={p.onEdit}>
        {t.addExercise}
      </Button>
      <Button variant="primary" size="lg" fullWidth icon="play" onClick={p.onStart}>
        {t.start}
      </Button>
    </div>
  );
}

function capText(t: TimeBlocksStrings, b: WorkoutBlock, v: BlockView): string {
  const { spec } = b;
  switch (v.fmt) {
    case 'amrap':
      return t.amrapCap((b.roundsDone ?? 0) + 1);
    case 'emom':
      return t.emomCap(v.minute, v.total);
    case 'fortime':
      return t.fortimeCap(
        (b.roundsDone ?? 0) + 1,
        spec.scheme?.length ?? spec.rounds ?? 1,
        spec.capSec != null ? mmss(spec.capSec) : '',
      );
    default:
      return t.intervalsCap(v.phase === 'rest', v.round, v.total);
  }
}

/** The clock of a running or paused block. `elapsedSec` comes from the timestamps (the caller ticks). */
export function BlockTimerCard(p: {
  block: WorkoutBlock;
  elapsedSec: number;
  paused: boolean;
  onPause: () => void;
  onResume: () => void;
  onRound: () => void;
  onFinish: () => void;
}) {
  const t = useBlockStrings();
  const { spec, members } = p.block;
  const v = blockView(spec, p.elapsedSec);
  const rest = v.fmt === 'intervals' && v.phase === 'rest';
  const main = v.fmt === 'fortime' ? mmss(v.elapsedSec) : mmss(v.remainSec);
  const pct = v.fmt === 'fortime' ? (v.capPct ?? 0) : v.pct;
  const cap = capText(t, p.block, v);
  return (
    <div
      className={`tb-card${rest ? ' tb-card--rest' : ''}${p.paused ? ' is-paused' : ''}`}
      role="timer"
      aria-label={`${t.formats[spec.fmt]} ${cap}`}
    >
      <div className="tb-row">
        <Icon name={FMT_ICON[spec.fmt]} />
        <div className="tb-main">
          <div className="tb-clock">{main}</div>
          <div className="tb-sub tb-cap">
            <b>{t.formats[spec.fmt]}</b> {p.paused ? `${t.paused} · ` : ''}
            {cap}
          </div>
        </div>
        <Button
          variant="secondary"
          size="md"
          shape="round"
          icon={p.paused ? 'play' : 'pause'}
          aria-label={p.paused ? t.resume : t.pause}
          onClick={p.paused ? p.onResume : p.onPause}
        />
      </div>
      {v.fmt === 'emom' ? (
        <div className="tb-ticks" aria-hidden="true">
          {Array.from({ length: v.total }, (_, i) => (
            <i
              key={i}
              className={i + 1 < v.minute ? 'is-done' : i + 1 === v.minute ? 'is-now' : ''}
            />
          ))}
        </div>
      ) : (
        <progress className="tb-track" max={100} value={pct} aria-hidden="true" />
      )}
      <Members members={members} />
      {(v.fmt === 'amrap' || v.fmt === 'fortime') && (
        <Button
          variant="primary"
          size="lg"
          fullWidth
          icon={v.fmt === 'amrap' ? 'plus' : 'check'}
          disabled={p.paused}
          onClick={p.onRound}
        >
          {v.fmt === 'amrap' ? t.roundBtn : t.roundDone}
        </Button>
      )}
      {(v.fmt === 'fortime' || v.fmt === 'amrap') && (
        <Button variant="ghost" size="sm" fullWidth icon="flag-checkered" onClick={p.onFinish}>
          {t.finish}
        </Button>
      )}
    </div>
  );
}

/** The block has ended: one bar to log the result. */
export function BlockEndedBar(p: { block: WorkoutBlock; capHit: boolean; onLog: () => void }) {
  const t = useBlockStrings();
  return (
    <div className="tb-card tb-card--done" data-testid="block-ended">
      <div className="tb-row">
        <Icon name="check" />
        <div className="tb-main">
          <div className="tb-t">{p.capHit ? t.timeUp : t.allDone}</div>
          <div className="tb-sub">
            {t.formats[p.block.spec.fmt]} · {specTitle(p.block.spec)}
          </div>
        </div>
        <Button variant="primary" size="md" onClick={p.onLog}>
          {t.logResult}
        </Button>
      </div>
    </div>
  );
}

const repsNum = (m: BlockMember): number | null => {
  const n = Number.parseInt(m.reps ?? '', 10);
  return Number.isFinite(n) && !/[a-z]/i.test(m.reps ?? '') ? n : null;
};

/** What was achieved: two steppers, two flags, optional actuals, one Save. */
export function BlockResultCard(p: {
  block: WorkoutBlock;
  initial: BlockResult;
  onSave: (r: BlockResult) => void;
}) {
  const t = useBlockStrings();
  const { spec, members } = p.block;
  const [r, setR] = useState<BlockResult>(p.initial);
  const [open, setOpen] = useState(false);
  const timeSec = r.timeSec ?? 0;
  const patch = (o: Partial<BlockResult>) => setR((x) => ({ ...x, ...o }));
  const rounds = Math.max(1, r.rounds ?? 1);
  const rows = members.flatMap((m, i) => {
    const n = repsNum(m);
    return n == null ? [] : [{ i, m, plan: n * rounds }];
  });
  const setActual = (i: number, plan: number, v: number) => {
    const a = { ...(r.actuals ?? {}) };
    if (v === plan) delete a[i];
    else a[i] = Math.max(0, v);
    patch({ actuals: Object.keys(a).length ? a : undefined });
  };
  return (
    <div className="tb-card tb-result" data-testid="block-result">
      <div className="tb-row">
        <FormatTag fmt={spec.fmt} />
        <span className="tb-t">{t.result}</span>
      </div>
      <div className="tb-result-row">
        {spec.fmt === 'fortime' ? (
          <>
            <NumberStepper
              label={t.minutes}
              value={Math.floor(timeSec / 60)}
              onChange={(v) => patch({ timeSec: v * 60 + (timeSec % 60) })}
            />
            <NumberStepper
              label={t.seconds}
              value={timeSec % 60}
              max={59}
              onChange={(v) => patch({ timeSec: Math.floor(timeSec / 60) * 60 + v })}
            />
          </>
        ) : (
          <>
            <NumberStepper
              label={t.rounds}
              value={r.rounds ?? 0}
              onChange={(v) => patch({ rounds: v })}
            />
            <NumberStepper
              label={t.plusReps}
              value={r.extraReps ?? 0}
              onChange={(v) => patch({ extraReps: v })}
            />
          </>
        )}
      </div>
      <div className="tb-flags">
        <Chip
          size="sm"
          tone="neutral"
          selected={!!r.capHit}
          icon="flag-checkered"
          onClick={() => patch({ capHit: !r.capHit })}
        >
          {spec.fmt === 'fortime' ? t.hitCap : t.timeUpFlag}
        </Chip>
        <Chip
          size="sm"
          tone="neutral"
          selected={!!r.scaled}
          icon="swap"
          onClick={() => patch({ scaled: !r.scaled })}
        >
          {t.scaled}
        </Chip>
        <Button variant="primary" size="md" className="tb-save" onClick={() => p.onSave(r)}>
          {t.save}
        </Button>
      </div>
      {rows.length > 0 && (
        <div className="tb-act">
          <Button
            variant="ghost"
            size="md"
            fullWidth
            icon={open ? 'caret-up' : 'caret-down'}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {t.actuallyDid} · {open ? t.optional : t.asPlanned}
          </Button>
          {open && (
            <ul className="tb-mems">
              {rows.map(({ i, m, plan }) => {
                const did = r.actuals?.[i] ?? plan;
                return (
                  <li key={i} className="tb-mem">
                    <span className="tb-mem-name">
                      <b>{m.name}</b>
                      <span className="tb-sub">{t.plannedReps(plan)}</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      shape="round"
                      icon="minus"
                      aria-label={t.less}
                      onClick={() => setActual(i, plan, did - 1)}
                    />
                    <span className={`tb-act-v${did !== plan ? ' is-edit' : ''}`}>{did}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      shape="round"
                      icon="plus"
                      aria-label={t.more}
                      onClick={() => setActual(i, plan, did + 1)}
                    />
                  </li>
                );
              })}
              <li className="tb-sub">{t.actualsNote}</li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function resultSummary(t: TimeBlocksStrings, spec: BlockSpec, r: BlockResult): string {
  if (spec.fmt === 'fortime') return mmss(r.timeSec ?? 0);
  return t.summaryRounds(r.rounds ?? 0, r.extraReps ?? 0);
}

/** A logged block: one quiet row, tap to edit the result. */
export function BlockLoggedRow(p: {
  block: WorkoutBlock;
  onOpen?: () => void;
  onDelete?: () => void;
}) {
  const t = useBlockStrings();
  const { spec, result } = p.block;
  return (
    <div className="tb-card tb-card--done" data-testid="block-logged">
      <div className="tb-row">
        <FormatTag fmt={spec.fmt} />
        <div className="tb-main">
          <div className="tb-t">{result ? resultSummary(t, spec, result) : ''}</div>
          <div className="tb-sub">{membersLine(p.block.members)}</div>
        </div>
        {p.onOpen && (
          <Button
            variant="ghost"
            size="sm"
            shape="round"
            icon="pencil-simple"
            aria-label={t.edit}
            onClick={p.onOpen}
          />
        )}
        {p.onDelete && (
          <Button
            variant="ghost"
            size="sm"
            shape="round"
            icon="trash"
            aria-label={t.deleteBlock}
            onClick={p.onDelete}
          />
        )}
      </div>
    </div>
  );
}

export { blockRemainSec };
