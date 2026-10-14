import { useState } from 'react';
import { Avatar } from '../../../../components/ui/Avatar';
import { Button } from '../../../../components/ui/Button';
import { ListRow } from '../../../../components/ui/GroupedList';
import { IconTile } from '../../../../components/ui/IconTile';
import { Segmented } from '../../../../components/ui/Segmented';
import { DOW_OF_ISO, dayItems, dayName } from '../../model/doc';
import { Head, Pane, PaneCtx } from './PaneShared';

export function CopyPane({ c }: { c: PaneCtx }) {
  const { p } = c;
  const days = [
    ...new Set(c.draft.items.map((i) => i.day).concat(Object.keys(c.draft.dayNames).map(Number))),
  ]
    .filter((d) => d !== c.day)
    .sort();
  const all = [1, 2, 3, 4, 5, 6, 7].filter((d) => d !== c.day);
  void days;
  return (
    <Pane label={p.edInspCopyDay} readOnly={c.readOnly}>
      <Head c={c} title={p.edBackTo(p.edBackDay)} sub={p.edCopyDayTo(dayName(c.draft, c.day))} />
      <ul className="pe-pick">
        {all.map((d) => {
          const n = dayItems(c.draft, d).filter((i) => i.kind === 'strength').length;
          return (
            <li key={d}>
              <ListRow
                dense
                strong
                icon={<IconTile icon="copy" size={40} />}
                label={dayName(c.draft, d) || p.dowFull[DOW_OF_ISO[d - 1]]}
                sub={`${p.dowFull[DOW_OF_ISO[d - 1]]}${n ? ` · ${p.edReplaces(n)}` : ''}`}
                chevron
                onClick={() => c.copyDayTo(d)}
              />
            </li>
          );
        })}
      </ul>
      <p className="pe-p">{p.edCopyBody}</p>
    </Pane>
  );
}

export function LibPane({ c }: { c: PaneCtx }) {
  const { p } = c;
  const [tab, setTab] = useState<'template' | 'client'>('template');
  const [copied, setCopied] = useState('');
  const rows = c.library.filter((e) => e.kind === tab);
  return (
    <Pane label={p.edInspLibrary} readOnly={c.readOnly}>
      <Head c={c} title={p.edBackTo(p.edBackDay)} sub={p.edLibInto(dayName(c.draft, c.day))} />
      <Segmented
        tabs
        size="sm"
        fill
        label={p.edLibSource}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'template', label: p.edLibTemplates },
          { value: 'client', label: p.edLibClients },
        ]}
      />
      <ul className="pe-pick">
        {rows.map((e) => (
          <li key={e.key}>
            <ListRow
              dense
              strong
              icon={
                e.clientName ? (
                  <Avatar name={e.clientName} size={40} />
                ) : (
                  <IconTile icon="copy" size={40} />
                )
              }
              label={`${e.name} · ${e.dayName}`}
              sub={`${e.clientName ? `${e.clientName} · ` : ''}${p.ptExSets(e.exercises, e.sets)}`}
              trailing={
                <Button
                  variant={copied === e.key ? 'ok' : 'secondary'}
                  size="sm"
                  icon={copied === e.key ? 'check' : undefined}
                  onClick={() => {
                    setCopied(e.key);
                    c.importEntry(e);
                  }}
                >
                  {copied === e.key ? p.edLibCopied : p.edLibCopy}
                </Button>
              }
            />
          </li>
        ))}
        {!rows.length && <li className="pe-p">{p.edLibEmpty}</li>}
      </ul>
      <p className="pe-p">{p.edLibBody(dayName(c.draft, c.day))}</p>
    </Pane>
  );
}
