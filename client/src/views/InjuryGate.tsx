/** The Injury & Rehab overlay behind the consent of the Injuries feature (SPO-290): without it, "Injuries is off". */
import type { ComponentProps } from 'react';
import { HealthGate } from '../legal/HealthOff';
import { InjuryView } from './InjuryView';

export function InjuryGate(props: ComponentProps<typeof InjuryView>) {
  return (
    <HealthGate feature="injuries" onBack={props.onClose}>
      <InjuryView {...props} />
    </HealthGate>
  );
}
