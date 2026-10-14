import type { ReactNode } from 'react';
import { Icon } from '../../ui';
import { InfoTable } from './InfoTable';
import { Segmented } from './Segmented';
import './ConsentControls.css';

/**
 * Consent in the Coach UI (story group `Coach/Consent`). Levels are the stored enum (off | effects | full); the
 * words come from the caller. Both pieces only DRAW what they are given: whether a category may show data is
 * decided upstream (useCoachWorld / domain), a locked row never carries a value.
 */
export type ConsentLevelId = 'off' | 'effects' | 'full';

export interface ConsentItem {
  id: string;
  label: string;
  level: ConsentLevelId;
  /** "Full", "Effects only", "Not shared" */
  levelLabel: string;
  /** One line under the label (what the category contains, or "X has not shared this"). */
  what?: string;
}

/**
 * Read-only facts: what a client shares, one plain `InfoTable` row per category (a small static check / lock mark, the
 * name, what it contains, the level word on the right). Nothing here can be pressed, so nothing looks pressable: no
 * raised surface, no icon tile, no chevron. The one real button is `action`.
 */
export function ConsentChips({
  items,
  label,
  action,
}: {
  items: readonly ConsentItem[];
  label: string;
  /** e.g. "Ask Oleh to share 2 more" */
  action?: ReactNode;
}) {
  return (
    <div className="cc-list">
      {action}
      <InfoTable
        label={label}
        rows={items.map((it) => ({
          id: it.id,
          className: `cc-row cc-row--${it.level}`,
          label: (
            <span className="cc-fact">
              <Icon
                name={it.level === 'off' ? 'lock-simple' : 'check-circle'}
                className={`cc-mark cc-mark--${it.level}`}
                aria-hidden
              />
              <span className="cc-t">
                <b>{it.label}</b>
                {it.what && <small>{it.what}</small>}
              </span>
            </span>
          ),
          value: it.levelLabel,
        }))}
      />
    </div>
  );
}

export interface ConsentPickerRow {
  id: string;
  label: string;
  what?: string;
  value: ConsentLevelId;
}

/** One Off / Effects only / Full control per category (invite request, later the sharing editor). */
export function ConsentLevelPicker({
  rows,
  levelLabels,
  onChange,
  legend,
  disabled,
}: {
  rows: readonly ConsentPickerRow[];
  levelLabels: Record<ConsentLevelId, string>;
  onChange: (id: string, level: ConsentLevelId) => void;
  legend: string;
  disabled?: boolean;
}) {
  return (
    <fieldset className="cc-pick" disabled={disabled}>
      <legend className="cc-legend">{legend}</legend>
      {rows.map((r) => (
        <div key={r.id} className="cc-pick-row">
          <span className="cc-t">
            <b>{r.label}</b>
            {r.what && <small>{r.what}</small>}
          </span>
          <Segmented<ConsentLevelId>
            size="sm"
            label={r.label}
            value={r.value}
            onChange={(v) => onChange(r.id, v)}
            options={(['off', 'effects', 'full'] as const).map((v) => ({
              value: v,
              label: levelLabels[v],
              compact: true,
              disabled,
            }))}
          />
        </div>
      ))}
    </fieldset>
  );
}
