import { EmptyState } from '../../../components/ui/EmptyState';
import { dayActivities } from '../model/doc';
import { firstName } from './text';
import { Pane, PaneCtx } from './panes/PaneShared';
import { RowPane } from './panes/RowPane';
import { PairPane, SwapPane } from './panes/SwapPairPanes';
import { AddPane } from './panes/AddPane';
import { ActAddPane, ActPane } from './panes/ActivityPanes';
import { CopyPane, LibPane } from './panes/LibraryPanes';
import { DayAsClient, MusclesPane } from './panes/DayPanes';

export function paneTitle(c: PaneCtx, pane: Pane, hasRow: boolean, hasAct: boolean): string {
  const { p } = c;
  const first = firstName(c.audience);
  if (pane === 'lib') return p.edInspLibrary;
  if (pane === 'add') return p.edInspAdd;
  if (pane === 'actadd') return p.edInspAddAct;
  if (pane === 'copy') return p.edInspCopyDay;
  if (pane === 'view') return p.edInspSees(first);
  if (hasAct) return p.edInspActivity;
  if (hasRow)
    return pane === 'swap' ? p.edInspSwap : pane === 'pair' ? p.edInspSuperset : p.edInspExercise;
  return c.mode === 'muscles' ? p.edInspMuscles : p.edInspEditor;
}

export function PaneBody(props: { c: PaneCtx; pane: Pane; onAddActivity: (type: string) => void }) {
  const { c, pane } = props;
  const { p } = c;
  const it = c.draft.items.find((i) => i.id === c.selectedId);
  const act = dayActivities(c.draft, c.day).find((a) => a.id === c.selectedId);
  if (pane === 'view') return <DayAsClient c={c} />;
  if (pane === 'lib') return <LibPane c={c} />;
  if (pane === 'copy') return <CopyPane c={c} />;
  if (pane === 'actadd') return <ActAddPane c={c} onAdd={props.onAddActivity} />;
  if (pane === 'add') return <AddPane c={c} />;
  if (act) return <ActPane c={c} a={act} />;
  if (it)
    return pane === 'swap' ? (
      <SwapPane c={c} it={it} />
    ) : pane === 'pair' ? (
      <PairPane c={c} it={it} />
    ) : (
      <RowPane c={c} it={it} />
    );
  if (c.mode === 'muscles') return <MusclesPane c={c} />;
  return (
    <Pane label={p.edInspEditor} readOnly={c.readOnly}>
      <EmptyState
        titleAs="h3"
        icon="pencil-simple"
        title={p.edSelectRow}
        body={p.edSelectRowBody}
      />
    </Pane>
  );
}

export { ExerciseAsClient } from './panes/ExerciseAsClient';
export { DayAsClient } from './panes/DayPanes';
export { Pane, type PaneCtx } from './panes/PaneShared';
