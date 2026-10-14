import { type ReactNode } from 'react';
import { Button } from '../../../../components/ui/Button';
import type { EditorFeatures, LibraryDay, PaneId, ProgramEditorHost } from '../../host';
import type { ProgramEditorLabels, ProgramEditorWords } from '../../labels';
import { type DayMode, type ProgramDoc } from '../../model/doc';

export type Pane = PaneId;

export interface PaneCtx {
  p: ProgramEditorLabels;
  t: ProgramEditorWords;
  host: ProgramEditorHost;
  features: EditorFeatures;
  draft: ProgramDoc;
  day: number;
  mode: DayMode;
  /** Who the program is for (the preview speaks to them); empty = the person editing. */
  audience: string;
  /** The other party of "with <partner>" days; empty = none. */
  partner: string;
  size: 'sm' | 'md';
  selectedId: string;
  readOnly: boolean;
  edit: (fn: (p: ProgramDoc) => ProgramDoc, undoLabel?: string) => void;
  setPane: (p: Pane) => void;
  select: (id: string) => void;
  /** Clear the selection (a row was removed). */
  clear: () => void;
  library: readonly LibraryDay[];
  /** Add from the library; a muscles day asks first. */
  addExercise: (name: string) => void;
  addMarker: (kind: 'warmup' | 'cooldown') => void;
  addCardio: (name: string) => void;
  /** Add an exercise the catalog does not know, by its typed name (cleaned, catalog spelling when it has one). */
  createExercise: (name: string) => void;
  /** Open the host's full exercise picker (only when the host provides one). */
  openPicker: () => void;
  /** Remove an activity: asks first when the person had changed it, and offers Undo after. */
  removeActivity: (id: string) => void;
  copyDayTo: (to: number) => void;
  importEntry: (e: LibraryDay) => void;
  /** After a removal emptied a day. */
  onRemoved: (day: number, wasLast: boolean) => void;
}

export const Pane = ({
  children,
  label,
  readOnly,
}: {
  children: ReactNode;
  label?: string;
  readOnly?: boolean;
}) =>
  readOnly ? (
    <fieldset className="pe-pane pe-ro" disabled aria-label={label}>
      {children}
    </fieldset>
  ) : (
    <div className="pe-pane" role="group" aria-label={label}>
      {children}
    </div>
  );

export function Head({ c, title, sub }: { c: PaneCtx; title: string; sub?: string }) {
  return (
    <header className="pe-ph">
      <Button variant="ghost" size={c.size} icon="caret-left" onClick={() => c.setPane('edit')}>
        {title}
      </Button>
      {sub && <span>{sub}</span>}
    </header>
  );
}
