/**
 * Drawer 2 of the legal gate (SPO-295 N12): every optional consent, all OFF. "Save my choices" reports the switches that
 * are on; "Decide later" reports nothing. Presentational: the caller writes the records (Atlas AI and gym search open their
 * own full consent prompt first, see `PROMPTED_KINDS`).
 */
import { useState } from 'react';
import { useGateT, type GateChoiceText } from '../i18n/legalGate';
import { Button } from '../components/ui/Button';
import { ConsentRow } from '../components/ui/ConsentRow';
import { GroupedList } from '../components/ui/GroupedList';
import { IconTile } from '../components/ui/IconTile';
import { Notice } from '../components/ui/Notice';
import { Sheet } from '../components/ui/Overlays';
import { GATE_CHOICES, type GateChoice } from './gateChoices';
import type { ConsentKind } from './consents';
import './LegalGate.css';

export function LegalGateChoices({
  onSave,
  onLater,
}: {
  onSave: (on: ReadonlySet<ConsentKind>) => void;
  onLater: () => void;
}) {
  const g = useGateT();
  const [on, setOn] = useState<ReadonlySet<ConsentKind>>(new Set());
  const toggle = (kind: ConsentKind, v: boolean) =>
    setOn((cur) => {
      const next = new Set(cur);
      if (v) next.add(kind);
      else next.delete(kind);
      return next;
    });
  const textOf = (c: GateChoice): GateChoiceText =>
    c.kind === 'atlas-ai' ? g.atlas : c.kind === 'geo-search' ? g.geo : g.health[c.feature!];
  const rows = (group: GateChoice['group']) =>
    GATE_CHOICES.filter((c) => c.group === group).map((c) => {
      const x = textOf(c);
      return (
        <ConsentRow
          key={c.kind}
          icon={c.icon}
          tone={c.tone}
          label={x.label}
          sub={x.sub}
          status={g.ifOff(x.hint)}
          on={on.has(c.kind)}
          onChange={(v) => toggle(c.kind, v)}
        />
      );
    });
  return (
    <Sheet onClose={onLater} dismissible={false} padded role="alertdialog" label={g.choicesTitle}>
      <div className="lgg">
        <div className="lgg-head">
          <IconTile tone="accent" size={44} icon="shield-check" />
          <h2 className="lgg-t ut-xl ut-w7">{g.choicesTitle}</h2>
        </div>
        <p className="lgg-lead ut-base ut-muted">{g.choicesLead}</p>
        <GroupedList surface="raised" header={g.atlasHeader} footer={g.atlasFooter}>
          {rows('atlas')}
        </GroupedList>
        <GroupedList surface="raised" header={g.healthHeader} footer={g.healthFooter}>
          {rows('health')}
        </GroupedList>
        <GroupedList surface="raised" header={g.outsideHeader}>
          {rows('outside')}
        </GroupedList>
        <Notice tone="neutral" icon="info">
          {g.notice}
        </Notice>
        <div className="lgg-acts">
          <Button variant="primary" size="lg" onClick={() => onSave(on)}>
            {g.save}
          </Button>
          <Button variant="link" onClick={onLater}>
            {g.later}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
