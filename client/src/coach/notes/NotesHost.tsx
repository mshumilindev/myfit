import { useNotesT } from '../../i18n/coachNotes';
import { SidePanel } from '../layout/SidePanel';
import { NotesPanel, type NotesPanelProps } from './NotesPanel';

/** The Notes panel as a drawer (wide) or sheet (phone); `open` false renders nothing and keeps no subscription. */
export function NotesHost({
  open,
  onClose,
  ...p
}: Omit<NotesPanelProps, 'variant' | 'onClose'> & { open: boolean; onClose: () => void }) {
  const { nt } = useNotesT();
  if (!open) return null;
  return (
    <SidePanel
      open
      onClose={onClose}
      title={p.side === 'client' ? nt.nTitleClient(p.coachFirst ?? '') : nt.nTitle(p.first)}
      closeLabel={nt.nClose}
    >
      <NotesPanel {...p} variant="sheet" />
    </SidePanel>
  );
}
