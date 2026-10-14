import { forwardRef } from 'react';
import { Field, type FieldProps } from './Field';
import './TimeField.css';

export type TimeFieldProps = Omit<FieldProps, 'type' | 'trail' | 'bare'>;

/**
 * A native time picker in the Field well (kit `timefield`): optional label and
 * leading icon, `sm` for dense rows. Value is an "HH:MM" string.
 */
export const TimeField = forwardRef<HTMLInputElement, TimeFieldProps>(function TimeField(
  { className, ...rest },
  ref,
) {
  const cls = ['uitime', className].filter(Boolean).join(' ');
  return <Field ref={ref} type="time" className={cls} {...rest} />;
});
