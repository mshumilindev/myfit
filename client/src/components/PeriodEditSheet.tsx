import { useState } from 'react';
import type { HealthFormSpec } from '../health';
import { HealthForm } from '../views/health/HealthForm';

/** The Health edit form (dates, kind, name, delete) in a drawer — opened from
 *  a History row so a logged illness / rest / injury is editable right there. */
export function PeriodEditSheet({ spec, onClose }: { spec: HealthFormSpec; onClose: () => void }) {
  const [now] = useState(() => Date.now());
  return (
    <HealthForm
      spec={spec}
      now={now}
      web={false}
      presentation="sheet"
      onCancel={onClose}
      onDone={onClose}
      onRehab={onClose}
    />
  );
}
