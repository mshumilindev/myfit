import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useSafeT } from '../../../i18n/coachSafe';
import { useClientT } from '../../../i18n/coachClient';
import { PushedPage } from './PushedPage';

/** "No trainer yet": the answer of every client-side trainer page when there is no link (never an eternal skeleton). */
export function NoTrainerPage({ onBack }: { onBack: () => void }) {
  const { cc } = useClientT();
  const { sf } = useSafeT();
  return (
    <PushedPage title={cc.mtTitle} backLabel={cc.ccBack} onBack={onBack}>
      <EmptyState icon="user-circle" title={sf.mtNoneTitle} body={sf.mtNoneBody} titleAs="h2">
        <Button variant="primary" onClick={onBack}>
          {sf.mtNoneCta}
        </Button>
      </EmptyState>
    </PushedPage>
  );
}
