/**
 * The non-blocking notice for an EDITORIAL policy / terms change (SPO-295 N8): a kit Banner with a link to the document
 * and a dismiss. Dismiss means "seen" for every document of the notice (an editorial change needs no re-consent).
 * "Read" opens the first document and acknowledges only the document that was actually opened; the other stays pending.
 */
import { useT } from '../i18n';
import { useUpdateT } from '../i18n/legalUpdate';
import { Banner } from '../components/ui/Banner';
import { fmtVersionDate } from './docVersion';
import { openLegalPage } from './GateLeaveActions';
import type { UpdateDoc } from './changelog';
import type { PendingUpdate } from './policyUpdate';
import './PolicyUpdateBanner.css';

const PAGE = { terms: 'terms', policy: 'privacy' } as const;

export function PolicyUpdateBanner({
  updates,
  onSeen,
}: {
  updates: readonly PendingUpdate[];
  /** The documents acknowledged: all of them on Dismiss, only the opened one on Read. */
  onSeen: (docs: readonly UpdateDoc[]) => void;
}) {
  const { locale } = useT();
  const u = useUpdateT();
  const docs = updates.map((x) => x.doc);
  const name = docs.length > 1 ? u.docName.both : u.docName[docs[0]];
  const date = fmtVersionDate(updates.map((x) => x.version).sort()[updates.length - 1], locale);
  return (
    <div className="lgub" role="region" aria-label={u.bannerTitle(name)}>
      <Banner
        tone="accent"
        icon="note"
        kicker={u.bannerKicker}
        title={u.bannerTitle(name)}
        body={u.bannerBody(date)}
        primaryAction={{
          label: u.bannerRead,
          onClick: () => {
            openLegalPage(PAGE[docs[0]]);
            onSeen([docs[0]]);
          },
        }}
        skipAction={{ label: u.bannerDismiss, onClick: () => onSeen(docs) }}
      />
    </div>
  );
}
