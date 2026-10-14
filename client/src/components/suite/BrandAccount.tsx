import { Button } from '../ui/Button';
import { useSuiteAccount, type SuiteApp, type SuiteIdentity } from './useSuiteAccount';
import { requestOpenMore } from './openMore';

/**
 * The avatar at the right edge of every app's top bar (Gym, Apex, People, Nutrition, Learn, Coach). It opens the same
 * bottom sheet as the tab bar's More: the app's destinations, Apps, and the account block (name, role,
 * "Coach | My workouts" where it applies, Profile, Sign out).
 */
export function BrandAccount({ app, identity }: { app: SuiteApp; identity?: SuiteIdentity }) {
  const { title, avatar } = useSuiteAccount({ app, identity });
  return (
    <Button
      variant="ghost"
      className="uibrand-ctl uibrand-avatar"
      aria-label={title}
      aria-haspopup="dialog"
      onClick={requestOpenMore}
    >
      {avatar(34)}
    </Button>
  );
}
