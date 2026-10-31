import type { ReactNode } from 'react';
import { ConsentChips as RealChips } from '../../src/components/ui/ConsentControls';
import { RequestButton } from './TrainerRequestSheet';

export * from '../../src/components/ui/ConsentControls';

/** The real read-only list; the old "Ask Oleh to share N more" button becomes the request entry. */
export function ConsentChips(p: React.ComponentProps<typeof RealChips>): ReactNode {
  return <RealChips {...p} action={<RequestButton />} />;
}
