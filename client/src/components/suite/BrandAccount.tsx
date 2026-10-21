import { useState } from 'react';
import { Button } from '../ui/Button';
import { MoreMenu, type MoreMenuItem } from '../ui/MoreMenu';
import { SUITE_TONE } from './suiteTone';
import {
  useSuiteAccount,
  type SuiteApp,
  type SuiteIdentity,
  type SuiteMode,
} from './useSuiteAccount';

/**
 * The avatar at the right edge of every app's top bar (Gym, Apex, People, Nutrition, Learn, Coach). It opens the
 * user drawer: the header controls that no longer fit the bar (`hidden`, e.g. the language) and the account
 * block (name, role, "Coach | My workouts" where it applies, Profile, Sign out). The app's own
 * destinations are not here: they belong to its tab bar (Coach: More).
 */
export function BrandAccount({
  app,
  identity,
  hidden,
  onOpenProfile,
  onOpenGym,
}: {
  app: SuiteApp;
  identity?: SuiteIdentity;
  /** Header controls collapsed out of the bar (BrandBar hands them to `avatar={(hidden) => …}`). */
  hidden?: MoreMenuItem[];
  onOpenProfile?: () => void;
  onOpenGym?: () => void;
}) {
  const { account, title, avatar, dialog } = useSuiteAccount({
    app,
    identity,
    onOpenProfile,
    onOpenGym,
  });
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        className="uibrand-ctl uibrand-avatar"
        aria-label={title}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {avatar(34)}
      </Button>
      <MoreMenu<SuiteMode>
        presentation="sheet"
        tone={SUITE_TONE[app]}
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        items={hidden}
        account={account}
      />
      {dialog}
    </>
  );
}
