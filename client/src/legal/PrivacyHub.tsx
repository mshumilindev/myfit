/** "Your privacy" (SPO-295 N4): the entry rows in Profile → Settings. Consents opens its page; the two documents open the public pages. */
import { useState, type ReactNode } from 'react';
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { IconTile } from '../components/ui/IconTile';
import { useT } from '../i18n';
import { useDeleteT } from '../i18n/accountDelete';
import { useLegalT } from '../i18n/legal';
import { useMyDataT } from '../i18n/myData';
import { LEGAL_VERSIONS } from './consents';
import { useConsentRecords } from './consentApi';
import { countOn } from './consentsModel';
import { ConsentsScreen } from './ConsentsScreen';
import { DeleteAccountFlow } from './DeleteAccountFlow';
import { LEGAL_WINDOW } from './route';

/** Opens a public legal page in a new tab (the person keeps their place in the app). */
export function openLegalPage(id: 'privacy' | 'terms'): void {
  const w = window.open(
    `${window.location.pathname}${window.location.search}#/${id}`,
    LEGAL_WINDOW,
  );
  if (w) w.opener = null;
  else window.location.hash = `#/${id}`;
}

export function PrivacyHub({
  onOpenConsents,
  onOpenMyData,
  onOpenExport,
}: {
  onOpenConsents: () => void;
  /** Opens "What Spotter knows about you". Absent = the row is not shown. */
  onOpenMyData?: () => void;
  /** Opens the data copy as the "copy first" step of the account deletion. Absent = the copy is not offered there. */
  onOpenExport?: (thenDelete: boolean) => void;
}) {
  const { t } = useT();
  const { lg } = useLegalT();
  const d = useDeleteT();
  const md = useMyDataT();
  const { records, loading } = useConsentRecords();
  const [deleting, setDeleting] = useState(false);
  const c = countOn(records);
  return (
    <>
      <GroupedList header={t.privHubHeader}>
        <ListRow
          icon={<IconTile tone="accent" size={30} icon="shield-check" />}
          label={t.privTitle}
          sub={t.privHubSub}
          value={loading ? undefined : t.privCount(c.on, c.total)}
          chevron
          onClick={onOpenConsents}
        />
        <ListRow
          icon={<IconTile size={30} icon="note" />}
          label={lg.ui.privacyLink}
          sub={lg.ui.version(LEGAL_VERSIONS.policy)}
          chevron
          onClick={() => openLegalPage('privacy')}
        />
        <ListRow
          icon={<IconTile size={30} icon="note" />}
          label={lg.ui.termsLink}
          sub={lg.ui.version(LEGAL_VERSIONS.terms)}
          chevron
          onClick={() => openLegalPage('terms')}
        />
        {onOpenMyData && (
          <ListRow
            icon={<IconTile tone="accent" size={30} icon="eye" />}
            label={md.title}
            sub={md.hubSub}
            chevron
            onClick={onOpenMyData}
          />
        )}
        <ListRow
          tone="danger"
          icon={<IconTile tone="danger" size={30} icon="trash" />}
          label={d.rowLabel}
          sub={d.rowSub}
          onClick={() => setDeleting(true)}
        />
      </GroupedList>
      {deleting && (
        <DeleteAccountFlow
          onCancel={() => setDeleting(false)}
          onDownloadCopy={
            onOpenExport
              ? () => {
                  setDeleting(false);
                  onOpenExport(true);
                }
              : undefined
          }
        />
      )}
    </>
  );
}

/**
 * The Consents page as a screen of its own: `page` replaces the host view while open (return it early), `open` shows it.
 * `onExportFirst` opens the data copy (the "Download a copy first" choice of the required-withdraw prompt, and the link in the
 * deletion flow); the Consents page closes first.
 */
export function useConsentsPage(onExportFirst?: () => void): { page: ReactNode; open: () => void } {
  const [on, setOn] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const exportFirst = onExportFirst
    ? () => {
        setDeleting(false);
        setOn(false);
        onExportFirst();
      }
    : undefined;
  return {
    page: on ? (
      <>
        <ConsentsScreen
          onBack={() => setOn(false)}
          onDeleteAccount={(copyFirst) =>
            copyFirst && exportFirst ? exportFirst() : setDeleting(true)
          }
        />
        {deleting && (
          <DeleteAccountFlow onCancel={() => setDeleting(false)} onDownloadCopy={exportFirst} />
        )}
      </>
    ) : null,
    open: () => setOn(true),
  };
}
