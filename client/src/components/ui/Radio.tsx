import type { InputHTMLAttributes } from 'react';
import { toneClass, type Tone } from './tones';
import './Radio.css';

export interface RadioProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'onChange' | 'size'
> {
  checked: boolean;
  onChange: () => void;
  tone?: Tone;
}

/**
 * A 22px radio (kit `radio`): a real <input type="radio"> under a drawn ring.
 * Group radios with the same `name`; label with a wrapping <label>.
 */
export function Radio({ checked, onChange, tone = 'accent', className, ...rest }: RadioProps) {
  const cls = ['uiradio', toneClass(tone), className].filter(Boolean).join(' ');
  return (
    <span className={cls}>
      <input type="radio" className="uiradio-in" checked={checked} onChange={onChange} {...rest} />
      <span className="uiradio-ring" aria-hidden="true" />
    </span>
  );
}
