import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { usePgT } from '../../i18n/coachProgram';
import { PageFrame, type PageChrome } from '../../tools/programEditor';
import { Page } from '../layout/Layout';
import type { CoachRoute } from '../routes';

/**
 * A program page whose client is missing (or only an invite): the "no client" state once the roster has loaded (or
 * failed), the skeleton before. Shared by the editor and the check page.
 */
export function NoClientPage({
  chrome,
  settled,
  onNavigate,
}: {
  chrome: PageChrome;
  /** The roster has answered (loaded or failed): show the empty state instead of the skeleton. */
  settled: boolean;
  onNavigate: (r: CoachRoute) => void;
}) {
  const { p } = usePgT();
  return (
    <Page>
      <PageFrame chrome={chrome}>
        {settled ? (
          <Card>
            <EmptyState
              titleAs="h2"
              icon="user-focus"
              title={p.edNoClientTitle}
              body={p.edNoClientBody}
            >
              <Button variant="primary" onClick={() => onNavigate({ screen: 'clients' })}>
                {p.edToClients}
              </Button>
            </EmptyState>
          </Card>
        ) : (
          <SkeletonRows rows={5} />
        )}
      </PageFrame>
    </Page>
  );
}
