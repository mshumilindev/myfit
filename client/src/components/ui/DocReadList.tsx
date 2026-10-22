import type { ReactNode } from 'react';
import { Switch } from './Switch';
import { GroupedList, ListRow } from './GroupedList';
import { IconTile } from './IconTile';
import type { DocOpened } from './docReadGate';
import { allDocsOpened } from './docReadGate';
import './DocReadList.css';

export interface ReadDoc {
  id: string;
  label: string;
}

export interface DocReadListProps {
  docs: readonly ReadDoc[];
  /** From `useDocReadGate`. */
  opened: DocOpened;
  /** Opens the document (and the caller marks it opened). */
  onOpen: (id: string) => void;
  /** Group header ("Before you continue"). */
  header?: string;
  /** Shown until every document is opened ("Open both documents ... to unlock the boxes below"). */
  lockedHint?: string;
  /** "Not opened yet" */
  notOpenedLabel: string;
  /** "Read" */
  readLabel: string;
}

/** The documents a person must open before agreeing: one row each, "Not opened yet" / "Read", chevron. */
export function DocReadList({
  docs,
  opened,
  onOpen,
  header,
  lockedHint,
  notOpenedLabel,
  readLabel,
}: DocReadListProps) {
  const all = allDocsOpened(
    docs.map((d) => d.id),
    opened,
  );
  return (
    <GroupedList surface="raised" header={header} footer={all ? undefined : lockedHint}>
      {docs.map((d) => (
        <ListRow
          key={d.id}
          icon={<IconTile size={30} icon="note" />}
          label={d.label}
          sub={opened[d.id] ? readLabel : notOpenedLabel}
          chevron
          onClick={() => onOpen(d.id)}
        />
      ))}
    </GroupedList>
  );
}

/** A switch beside its sentence, for "I am 18 or older" / "I agree to ...". Disabled until the documents were opened. */
export function AcceptCheck({
  checked,
  disabled,
  onChange,
  children,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="uidr-accept ut-sm">
      <span className="uidr-accept-t">{children}</span>
      <Switch checked={checked} disabled={disabled} onChange={onChange} />
    </label>
  );
}
