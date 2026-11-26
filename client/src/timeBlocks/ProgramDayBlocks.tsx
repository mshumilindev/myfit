import { useState } from 'react';
import { ExercisePicker } from '../components/ExercisePicker';
import { Button, IconButton } from '../components/ui/Button';
import { ListRow } from '../components/ui/GroupedList';
import { IconTile } from '../components/ui/IconTile';
import { ConfirmDialog } from '../components/ui/Overlays';
import { addBlock, dayBlocks, removeBlock, updateBlock } from '../tools/programEditor';
import type { DayBlocksSlotProps } from '../tools/programEditor';
import { PLAIN_WORKOUT } from '../views/programs/selfPicker';
import { BlockBuilder } from './BlockBuilder';
import { FMT_ICON, membersLine, useBlockStrings } from './BlockUi';
import type { BlockMember, BlockSpec } from './model';
import { specLong } from './specText';

type Mode =
  | { kind: 'new' }
  | { kind: 'edit'; id: string }
  | { kind: 'pick'; add: (name: string) => void; back: Mode }
  | { kind: 'delete'; id: string };

/** The time blocks of one program day in the program editor (the `dayBlocks` slot): cards under the rows, with their own add button. */
export function ProgramDayBlocks({ doc, day, readOnly, edit }: DayBlocksSlotProps) {
  const t = useBlockStrings();
  const [mode, setMode] = useState<Mode | null>(null);
  const blocks = dayBlocks(doc, day);
  if (readOnly && !blocks.length) return null;

  const builder = () => {
    if (!mode || mode.kind === 'delete') return null;
    const cur = mode.kind === 'pick' ? mode.back : mode;
    const editing = cur.kind === 'edit' ? blocks.find((b) => b.id === cur.id) : undefined;
    if (mode.kind === 'pick') {
      return (
        <ExercisePicker
          plain
          workout={PLAIN_WORKOUT}
          gym={null}
          addLabel={t.addExercise}
          onPick={(i) => {
            mode.add(i.name);
            setMode(mode.back);
          }}
          onClose={() => setMode(mode.back)}
        />
      );
    }
    return (
      <BlockBuilder
        key={cur.kind === 'edit' ? cur.id : 'new'}
        initial={
          editing
            ? { spec: editing.spec as BlockSpec, members: editing.members as BlockMember[] }
            : undefined
        }
        onClose={() => setMode(null)}
        onPickExercise={(add) => setMode({ kind: 'pick', add, back: cur })}
        onSave={(spec, members) => {
          edit(
            (d) =>
              editing
                ? updateBlock(d, editing.id, { spec, members })
                : addBlock(d, day, { spec, members }),
            'block',
          );
          setMode(null);
        }}
      />
    );
  };
  const deleting = mode?.kind === 'delete' ? blocks.find((b) => b.id === mode.id) : undefined;

  return (
    <>
      {blocks.length > 0 && (
        <ul className="tb-pblocks" aria-label={t.timeBlockRow} data-testid="program-blocks">
          {blocks.map((b) => (
            <li key={b.id}>
              <ListRow
                dense
                strong
                icon={<IconTile icon={FMT_ICON[b.spec.fmt]} tone="conditioning" size={40} />}
                label={`${t.formats[b.spec.fmt]} · ${specLong(t, b.spec as BlockSpec)}`}
                sub={membersLine(b.members)}
                chevron={!readOnly}
                onClick={readOnly ? undefined : () => setMode({ kind: 'edit', id: b.id })}
                trailing={
                  readOnly ? undefined : (
                    <IconButton
                      icon="trash"
                      label={t.deleteBlock}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMode({ kind: 'delete', id: b.id });
                      }}
                    />
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <Button
          variant="ghost"
          size="sm"
          icon="timer"
          data-testid="program-block-add"
          onClick={() => setMode({ kind: 'new' })}
        >
          {t.timeBlockRow}
        </Button>
      )}
      {builder()}
      {deleting && (
        <ConfirmDialog
          title={t.deleteBlockTitle}
          body={t.deleteBlockBody}
          confirmLabel={t.deleteBlock}
          cancelLabel={t.keep}
          danger
          onConfirm={() => {
            edit((d) => removeBlock(d, deleting.id), 'block');
            setMode(null);
          }}
          onCancel={() => setMode(null)}
        />
      )}
    </>
  );
}
