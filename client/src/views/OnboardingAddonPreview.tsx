/** The real store page of one item, inside the onboarding sheet (lazy: the store chunk loads only when "What's inside" is tapped). */
import { useMemo } from 'react';
import { ItemPage } from '../addonStore/ItemPage';
import { ItemAction, type StoreCtx } from '../addonStore/storeItems';

import { addonById } from '../addons/manifest';
import '../store-kit/tokens.css';
import '../store-kit/base.css';
import './OnboardingAddonPreview.css';

export default function OnboardingAddonPreview({
  id,
  st,
  enabled,
  queued,
  online,
}: Pick<StoreCtx, 'st' | 'enabled' | 'queued' | 'online'> & { id: string }) {
  const ctx: StoreCtx = useMemo(
    () => ({ st, enabled, queued, online, open: () => undefined }),
    [st, enabled, queued, online],
  );
  const m = addonById(id);
  return (
    <div className="sk-root sk-dark onb-peek">
      <ItemPage id={id} ctx={ctx} go={() => undefined} />
      {m ? <ItemAction m={m} ctx={ctx} lead /> : null}
    </div>
  );
}
