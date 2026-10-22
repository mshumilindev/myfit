import type { ReactNode } from 'react';
import { Sheet } from './Overlays';
import { Button } from './Button';
import { GroupedList, ListRow } from './GroupedList';
import { IconTile } from './IconTile';
import type { Tone } from './tones';
import './ConsentPrompt.css';

export interface ConsentFact {
  icon: string;
  label: ReactNode;
  sub: ReactNode;
  tone?: Tone;
}

export interface ConsentPromptProps {
  icon: string;
  tone?: Tone;
  /** Also the accessible name of the sheet. */
  title: string;
  lead: ReactNode;
  /** What / who / conditions: one row each. */
  facts: readonly ConsentFact[];
  /** Name of the facts list for screen readers ("Details"). */
  factsLabel: string;
  /** The affirmative act. Never pre-ticked: the prompt only reports the press. */
  primary: string;
  /** "Not now": the same weight of choice, no consent. */
  secondary: string;
  /** Name of the sheet's corner close button. */
  closeLabel: string;
  foot?: ReactNode;
  /** Above the buttons: links to the full documents, the read-and-accept box. */
  before?: ReactNode;
  primaryDisabled?: boolean;
  onPrimary: () => void;
  onSecondary: () => void;
  /** Scrim / Esc / swipe. Dismissing is never consent, so it defaults to `onSecondary`. */
  onClose?: () => void;
}

/**
 * The all-or-nothing consent prompt: what is processed, by whom, on what terms, and the choice (story `Kit/ConsentPrompt`).
 * A `Sheet` with role `alertdialog` (a bottom drawer on a phone, a side panel on desktop). It draws what it is given;
 * whether a consent record is written is the caller's job.
 */
export function ConsentPrompt({
  icon,
  tone = 'accent',
  title,
  lead,
  facts,
  factsLabel,
  primary,
  secondary,
  closeLabel,
  foot,
  before,
  primaryDisabled,
  onPrimary,
  onSecondary,
  onClose,
}: ConsentPromptProps) {
  return (
    <Sheet
      onClose={onClose ?? onSecondary}
      padded
      label={title}
      role="alertdialog"
      closeLabel={closeLabel}
      overTrap
    >
      <div className="uicp">
        <div className="uicp-head">
          <IconTile tone={tone} size={44} icon={icon} />
          <h2 className="uicp-t ut-xl ut-w7">{title}</h2>
        </div>
        <p className="uicp-lead ut-base ut-muted">{lead}</p>
        <GroupedList surface="raised" label={factsLabel} list>
          {facts.map((f, i) => (
            <li key={i}>
              <ListRow
                icon={<IconTile tone={f.tone ?? 'neutral'} size={30} icon={f.icon} />}
                label={f.label}
                sub={f.sub}
              />
            </li>
          ))}
        </GroupedList>
        {before}
        <div className="uicp-actions">
          <Button variant="primary" size="lg" disabled={primaryDisabled} onClick={onPrimary}>
            {primary}
          </Button>
          <Button variant="secondary" size="lg" onClick={onSecondary}>
            {secondary}
          </Button>
        </div>
        {foot && <div className="uicp-foot">{foot}</div>}
      </div>
    </Sheet>
  );
}
