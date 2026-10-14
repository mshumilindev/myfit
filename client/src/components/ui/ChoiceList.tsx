import { useId, type ReactNode } from 'react';
import { Card } from './Card';
import { Radio } from './Radio';
import { Tag } from './Tag';
import './ChoiceList.css';

export interface ChoiceOption {
  id: string;
  title: string;
  /** What it does, generated from the real diff by the screen. */
  description: string;
  /** Small tag ("Suggested", "Chosen"). */
  tag?: string;
}

export interface ChoiceListProps {
  options: ChoiceOption[];
  value: string | null;
  onChange: (id: string) => void;
  label: string;
  /** After the choice is made: the picked card stays, the others dim, nothing is clickable. */
  locked?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * One-of-N cards for a decision (C-15): a radio, the option name, what it changes in the program in
 * plain words, and a "Suggested" tag. `role="radiogroup"`, arrow keys come from the native radios, the
 * description is the accessible description of each option.
 */
export function ChoiceList({
  options,
  value,
  onChange,
  label,
  locked = false,
  className,
}: ChoiceListProps) {
  const name = useId();
  return (
    <div
      className={['uichoice', locked ? 'is-locked' : '', className].filter(Boolean).join(' ')}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((o) => {
        const on = value === o.id;
        const dim = locked && !on;
        return (
          <Card
            key={o.id}
            tone={on ? 'accent' : 'neutral'}
            selected={on}
            pad="md"
            className={['uichoice-opt', dim ? 'is-dim' : ''].filter(Boolean).join(' ')}
          >
            <label className="uichoice-lab">
              {locked ? null : (
                <Radio
                  name={name}
                  checked={on}
                  onChange={() => onChange(o.id)}
                  aria-describedby={`${name}-${o.id}-d`}
                />
              )}
              <span className="uichoice-text">
                <span className="uichoice-title">{o.title}</span>
                <span className="uichoice-desc" id={`${name}-${o.id}-d`}>
                  {o.description}
                </span>
              </span>
              {o.tag && <Tag tone="accent">{o.tag}</Tag>}
            </label>
          </Card>
        );
      })}
    </div>
  );
}
