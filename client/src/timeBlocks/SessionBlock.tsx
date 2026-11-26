import { useEffect, useMemo, useRef, useState } from 'react';
import { ExercisePicker } from '../components/ExercisePicker';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/Overlays';
import { deleteExercise, restoreExercise, setWorkoutBlocks, useStore } from '../store';
import type { Exercise } from '../types';
import { BlockBuilder } from './BlockBuilder';
import { BlockCountdownRun } from './BlockCountdownRun';
import { playCue, primeBlockAudio } from './blockAudio';
import {
  addBlock,
  countRound,
  editBlock,
  endBlock,
  pauseBlock,
  removeBlock,
  resumeBlock,
  saveResult,
  startBlock,
} from './blockOps';
import { blockCue } from './cues';
import {
  BlockEndedBar,
  BlockLoggedRow,
  BlockReadyCard,
  BlockResultCard,
  BlockTimerCard,
  useBlockStrings,
} from './BlockUi';
import {
  blockCapSec,
  blockOrder,
  blockRemainSec,
  blockStatus,
  blockView,
  elapsedMs,
  suggestResult,
  type BlockSpec,
  type WorkoutBlock,
} from './model';

export interface SessionBlocksProps {
  workoutId: string;
  past: boolean;
  /** undefined: all blocks as cards; null: engine only (clock, cues, overlays); id: only that block's card. */
  focusId?: string | null;
  /** Opens an exercise's details (the app's exercise screen). */
  onInfo?: (name: string) => void;
  /** "Time block…" from an exercise's options: the builder opens with that exercise inside; Add block moves it into the block. */
  /** Opens the builder each time this number goes up. */
  newSignal?: number;
  intake?: Exercise | null;
  onIntakeDone?: (moved?: { text: string; undo: () => void }) => void;
}

type Mode =
  | { kind: 'new' }
  | { kind: 'edit'; id: string }
  | { kind: 'pick'; add: (name: string) => void; back: Mode }
  | { kind: 'result'; id: string }
  | { kind: 'delete'; id: string };

/** The time blocks of one session: list of cards, the builder drawer, the countdown overlay, the result card. */
export function SessionBlocks({
  workoutId,
  past,
  focusId,
  onInfo,
  newSignal,
  intake,
  onIntakeDone,
}: SessionBlocksProps) {
  const t = useBlockStrings();
  const store = useStore();
  const workout = store.workouts.find((w) => w.id === workoutId);
  const blocks = useMemo(() => workout?.blocks ?? [], [workout?.blocks]);
  const [mode, setMode] = useState<Mode | null>(null);
  const seenSignal = useRef(0);
  const [counting, setCounting] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const prevRemain = useRef<Record<string, number>>({});
  const prefs = store.restPrefs;
  const anyRunning = blocks.some((b) => blockStatus(b) === 'running');

  useEffect(() => {
    if (!anyRunning) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [anyRunning]);

  // Cues and the end of the clock (the clock itself is derived from timestamps, so a reload never loses it).
  useEffect(() => {
    if (!workout) return;
    let next: WorkoutBlock[] | null = null;
    for (const b of blocks) {
      if (blockStatus(b) !== 'running' || !b.run) continue;
      const elapsed = elapsedMs(b.run, now) / 1000;
      const remain = blockRemainSec(b.spec, elapsed);
      const prev = prevRemain.current[b.id];
      if (remain != null && prev != null) {
        const cue = blockCue(prev, remain, blockCapSec(b.spec));
        if (cue) playCue(cue, prefs);
      }
      if (remain != null) prevRemain.current[b.id] = remain;
      if (blockView(b.spec, elapsed).done) {
        const cap = blockCapSec(b.spec) ?? 0;
        const endAt = Math.min(now, b.run.startedAt + b.run.pausedMs + cap * 1000);
        next = endBlock(next ?? blocks, b.id, endAt);
      }
    }
    if (next) setWorkoutBlocks(workoutId, next);
  }, [now, blocks, workout, workoutId, prefs]);

  useEffect(() => {
    if (!newSignal || newSignal <= seenSignal.current || !workout) return;
    seenSignal.current = newSignal;
    setMode({ kind: 'new' });
  }, [newSignal, workout]);

  if (!workout) return null;
  const save = (b: WorkoutBlock[]) => setWorkoutBlocks(workoutId, b);
  const ordered = blockOrder(blocks).filter((b) => focusId === undefined || b.id === focusId);
  const byId = (id: string) => blocks.find((b) => b.id === id);

  function begin(id: string) {
    primeBlockAudio();
    setCounting(id);
  }
  function openResult(id: string) {
    setMode({ kind: 'result', id });
  }

  const builder = (m0: Mode | null) => {
    const m: Mode | null = m0 ?? (intake ? { kind: 'new' } : null);
    if (!m || (m.kind !== 'new' && m.kind !== 'edit' && m.kind !== 'pick')) return null;
    const cur = m.kind === 'pick' ? m.back : m;
    const editing = cur.kind === 'edit' ? byId(cur.id) : undefined;
    if (m.kind === 'pick') {
      return (
        <ExercisePicker
          workout={workout}
          gym={store.gyms.find((g) => g.id === workout.gymId) ?? null}
          plain
          addLabel={t.addExercise}
          onPick={(i) => {
            m.add(i.name);
            setMode(m.back);
          }}
          onClose={() => setMode(m.back)}
        />
      );
    }
    return (
      <BlockBuilder
        key={cur.kind === 'edit' ? cur.id : 'new'}
        initial={editing ? { spec: editing.spec, members: editing.members } : undefined}
        startedFrom={!editing ? intake?.name : undefined}
        startMembers={!editing && intake ? [{ name: intake.name }] : undefined}
        onClose={() => {
          setMode(null);
          if (intake) onIntakeDone?.();
        }}
        onPickExercise={(add) => setMode({ kind: 'pick', add, back: cur })}
        onSave={(spec: BlockSpec, members) => {
          if (!editing && intake && workout) {
            // The exercise leaves the session list and takes its place as the block (Undo puts both back).
            const before = blocks;
            const idx = [...workout.exercises]
              .sort((a, b) => a.position - b.position)
              .findIndex((e) => e.id === intake.id);
            const made = addBlock(blocks, spec, members, Math.max(0, idx), Date.now());
            save(made);
            deleteExercise(workout.id, intake.id);
            setMode(null);
            onIntakeDone?.({
              text: t.movedIntoBlock(intake.name),
              undo: () => {
                restoreExercise(workout.id, intake);
                save(before);
              },
            });
            return;
          }
          save(
            editing
              ? editBlock(blocks, editing.id, spec, members)
              : addBlock(blocks, spec, members, workout.exercises.length, Date.now()),
          );
          setMode(null);
        }}
      />
    );
  };

  const counted = counting ? byId(counting) : undefined;
  const resultBlock = mode?.kind === 'result' ? byId(mode.id) : undefined;
  const deleting = mode?.kind === 'delete' ? byId(mode.id) : undefined;

  return (
    <div className="tb-blocks" data-testid="time-blocks">
      {ordered.map((b) => {
        const st = blockStatus(b);
        const elapsed = b.run ? elapsedMs(b.run, now) / 1000 : 0;
        if (st === 'ready')
          return (
            <BlockReadyCard
              key={b.id}
              block={b}
              onEdit={() => setMode({ kind: 'edit', id: b.id })}
              onStart={() => begin(b.id)}
              onInfo={onInfo}
            />
          );
        if (st === 'running' || st === 'paused')
          return (
            <BlockTimerCard
              key={b.id}
              block={b}
              elapsedSec={elapsed}
              paused={st === 'paused'}
              onPause={() => save(pauseBlock(blocks, b.id, Date.now()))}
              onResume={() => save(resumeBlock(blocks, b.id, Date.now()))}
              onRound={() => save(countRound(blocks, b.id))}
              onFinish={() => save(endBlock(blocks, b.id, Date.now()))}
              onInfo={onInfo}
            />
          );
        if (st === 'ended') {
          const cap = blockCapSec(b.spec);
          return (
            <div key={b.id}>
              {resultBlock?.id === b.id ? null : (
                <BlockEndedBar
                  block={b}
                  capHit={cap != null && elapsed >= cap - 0.5}
                  onLog={() => openResult(b.id)}
                />
              )}
            </div>
          );
        }
        return (
          <BlockLoggedRow
            key={b.id}
            block={b}
            onOpen={() => openResult(b.id)}
            onDelete={() => setMode({ kind: 'delete', id: b.id })}
          />
        );
      })}
      {resultBlock && (
        <BlockResultCard
          key={resultBlock.id}
          block={resultBlock}
          initial={
            resultBlock.result ??
            suggestResult(
              resultBlock,
              resultBlock.run ? elapsedMs(resultBlock.run, now) / 1000 : 0,
              now,
            )
          }
          onSave={(r) => {
            save(saveResult(blocks, resultBlock.id, { ...r, savedAt: Date.now() }));
            setMode(null);
          }}
        />
      )}
      {!past && focusId === undefined && (
        <Button
          variant="secondary"
          size="md"
          icon="timer"
          fullWidth
          onClick={() => setMode({ kind: 'new' })}
        >
          {t.timeBlockRow}
        </Button>
      )}
      {builder(mode)}
      {counted && counted.spec && (
        <BlockCountdownRun
          spec={counted.spec}
          prefs={prefs}
          onStart={() => {
            save(startBlock(blocks, counted.id, Date.now()));
            prevRemain.current[counted.id] = blockRemainSec(counted.spec, 0) ?? 0;
          }}
          onClose={() => setCounting(null)}
          onCancel={() => setCounting(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={t.deleteBlockTitle}
          body={t.deleteBlockBody}
          confirmLabel={t.deleteBlock}
          cancelLabel={t.keep}
          danger
          onConfirm={() => {
            save(removeBlock(blocks, deleting.id));
            setMode(null);
          }}
          onCancel={() => setMode(null)}
        />
      )}
    </div>
  );
}
