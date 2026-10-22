import { Icon } from '../../ui';
import './Checklist.css';

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface ChecklistProps {
  title: string;
  items: readonly ChecklistItem[];
}

/** What is still to do on a page: every item stays in place, a finished one turns green with a check. Story `Kit/Checklist`. */
export function Checklist({ title, items }: ChecklistProps) {
  const all = items.every((i) => i.done);
  return (
    <section className={`uichk${all ? ' is-all' : ''}`} aria-live="polite">
      <h3 className="uichk-t ut-sm ut-w6">{title}</h3>
      <ul className="uichk-list">
        {items.map((i) => (
          <li key={i.id} className={`uichk-i ut-sm${i.done ? ' is-done' : ''}`}>
            <span className="uichk-mark" aria-hidden="true">
              {i.done ? <Icon name="check-circle" weight="fill" /> : <Icon name="circle" />}
            </span>
            <span>{i.label}</span>
            <span className="sr-only">{i.done ? ' ✓' : ''}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
