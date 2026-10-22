/** "Not medical advice" (SPO-295 N9): the quiet notice at the top of the health screens and nutrition. Kit Notice. */
import { Notice } from '../components/ui/Notice';
import { useHealthT } from '../i18n/healthConsent';

export function HealthDisclaimer() {
  const h = useHealthT();
  return (
    <Notice tone="neutral" icon="info">
      {h.disclaimer}
    </Notice>
  );
}
