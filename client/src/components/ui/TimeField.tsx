import { forwardRef } from 'react';
import { Field, type FieldProps } from './Field';
import './TimeField.css';

export interface TimeFieldProps extends Omit<FieldProps, 'type' | 'trail' | 'bare'> {
  /** `sm` is the compact well used in schedule rows. */
  size?: 'sm' | 'md';
}

/**
 * A native time picker in the Field well (kit `timefield`): optional label and
 * leading icon, `sm` for dense rows. Value is an "HH:MM" string.
 */
export const TimeField = forwardRef<HTMLInputElement, TimeFieldProps>(function TimeField(
  { size = 'md', className, ...rest },
  ref,
) {
  const cls = ['uitime', size === 'sm' ? 'uitime--sm' : '', className].filter(Boolean).join(' ');
  return <Field ref={ref} type="time" className={cls} {...rest} />;
});
