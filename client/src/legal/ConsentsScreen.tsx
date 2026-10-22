/** The Consents page as its own screen (SPO-295 N4), like Privacy and sharing: it replaces the host view until Back. */
import { PageHead } from '../components/ui/PageHead';
import { useT } from '../i18n';
import { ConsentsPage, type ConsentsPageProps } from './ConsentsPage';

export function ConsentsScreen({ onBack, ...page }: ConsentsPageProps & { onBack: () => void }) {
  const { t } = useT();
  return (
    <div className="screen">
      <PageHead back={{ label: t.backAction, onClick: onBack }} title={t.privTitle} />
      <div className="hl-scroll">
        <div className="hl-cnt">
          <p className="detail-muted">{t.privSub}</p>
          <ConsentsPage {...page} />
        </div>
      </div>
    </div>
  );
}
