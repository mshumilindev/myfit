import { useMemo } from 'react';
import { featuresOf, type CanvasProps } from '../host';
import type { MuscleGroup } from '../model/doc';
import { setDayName, setRowMode, toggleMuscle } from '../model/ops';
import { DayCard } from './DayCard';
import { DayStrip } from './DayStrip';

/**
 * The default canvas: the training week as a strip of day cards, and the selected day below it. A host replaces it
 * through `host.slots.canvas` (same `CanvasProps`) without touching the inspector, history or the document.
 */
export function WeekCanvas({ state, actions, note }: CanvasProps) {
  const { doc, day, mode, host, labels: p, words: t } = state;
  const features = featuresOf(host);
  const env = useMemo(() => ({ weekOrder: host.weekOrder }), [host.weekOrder]);
  const musclesOf = (d: number) =>
    (doc.targetMuscles[String(d)] ?? []).includes('fullbody')
      ? t.muscleGroups.fullbody
      : (doc.targetMuscles[String(d)] ?? []).map((m) => t.muscleGroups[m] ?? m).join(' · ');
  return (
    <>
      <DayStrip
        p={p}
        draft={doc}
        current={day}
        partnerDays={state.partnerDays}
        partner={state.partner}
        weekOrder={env.weekOrder}
        groupLabels={musclesOf}
        onPick={actions.selectDay}
        onToggleDay={features.weekSetup && !state.readOnly ? actions.toggleDay : undefined}
        Tag={host.slots?.dayTag}
      />
      {note}
      <DayCard
        p={p}
        t={t}
        host={host}
        features={features}
        readOnly={state.readOnly}
        draft={doc}
        day={day}
        mode={mode}
        partnerDays={state.partnerDays}
        partner={state.partner}
        selectedId={state.selectedId}
        paneIsEdit={state.pane === 'edit'}
        mapInline={!state.wide}
        audience={state.audience}
        onMode={actions.setMode}
        onSelect={(id) => actions.select(id)}
        onToggleMuscle={(m: MuscleGroup) => actions.edit((d) => toggleMuscle(d, day, m), 'muscle')}
        onBareToTargets={(id) => {
          actions.edit((d) => setRowMode(d, id, false), 'targets');
          actions.select(id);
        }}
        onAddExercise={() => actions.openPane('add')}
        onAddActivity={() => actions.openPane('actadd')}
        onPreview={() => actions.openPane('view')}
        onCopyDay={() => actions.openPane('copy')}
        onLibrary={() => actions.openPane('lib')}
        onRename={
          features.dayNames && !state.readOnly
            ? (name) => actions.edit((d) => setDayName(d, day, name), 'dayName')
            : undefined
        }
      />
    </>
  );
}
