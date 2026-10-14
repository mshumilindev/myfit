import type { RefObject } from 'react';
import { Button } from '../../../components/ui/Button';
import { ResponsivePanel } from '../../../components/ui/ResponsivePanel';
import { Select } from '../../../components/ui/Select';
import type { C360Strings } from '../../../i18n/coachClient360';
import type { DecisionsStrings } from '../../../i18n/coachDecisions';
import type { RosterStrings } from '../../../i18n/coachRoster';
import type { SignalKind } from '../../domain/types';
import { GROUPS, type GroupBy } from '../decisionModel';
import { KINDS, type Range } from './decisionsConfig';

/** The filter popover / sheet: group by, client, trigger, date range; Clear all / Show N. */
export function DecisionsFilterPanel({
  open,
  onClose,
  anchorRef,
  c,
  d,
  r,
  filtering,
  onReset,
  shownCount,
  reveal,
  group,
  setGroup,
  who,
  setWho,
  kind,
  setKind,
  range,
  setRange,
  clients,
  groupName,
  rangeLabel,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  c: C360Strings;
  d: DecisionsStrings;
  r: RosterStrings;
  filtering: boolean;
  onReset: () => void;
  shownCount: number;
  reveal: (fn: () => void) => void;
  group: GroupBy;
  setGroup: (g: GroupBy) => void;
  who: string;
  setWho: (v: string) => void;
  kind: 'all' | SignalKind;
  setKind: (k: 'all' | SignalKind) => void;
  range: Range;
  setRange: (v: Range) => void;
  clients: readonly (readonly [string, string])[];
  groupName: (g: GroupBy) => string;
  rangeLabel: (v: Range) => string;
}) {
  return (
    <ResponsivePanel
      open={open}
      onClose={onClose}
      anchorRef={anchorRef}
      label={c.drFiltersTitle}
      title={c.drFiltersTitle}
      footer={
        <>
          <Button variant="secondary" disabled={!filtering} onClick={onReset}>
            {c.drFClearAll}
          </Button>
          <Button variant="primary" onClick={onClose}>
            {c.drFShow(shownCount)}
          </Button>
        </>
      }
    >
      <Select
        label={d.dcGroupBy}
        value={group}
        onChange={(e) => reveal(() => setGroup(e.target.value as GroupBy))}
      >
        {GROUPS.map((g) => (
          <option key={g} value={g}>
            {groupName(g)}
          </option>
        ))}
      </Select>
      <Select
        label={c.drFClient}
        value={who}
        onChange={(e) => reveal(() => setWho(e.target.value))}
      >
        <option value="all">{c.drFAllClients}</option>
        {clients.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </Select>
      <Select
        label={c.drFTrigger}
        value={kind}
        onChange={(e) => reveal(() => setKind(e.target.value as 'all' | SignalKind))}
      >
        <option value="all">{c.drFAllTriggers}</option>
        {KINDS.map((k) => (
          <option key={k} value={k}>
            {r.sgKind[k]}
          </option>
        ))}
      </Select>
      <Select
        label={c.drFDate}
        value={range}
        onChange={(e) => reveal(() => setRange(e.target.value as Range))}
      >
        {(['all', '30', '90'] as Range[]).map((v) => (
          <option key={v} value={v}>
            {rangeLabel(v)}
          </option>
        ))}
      </Select>
    </ResponsivePanel>
  );
}
