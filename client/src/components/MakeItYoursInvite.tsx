/**
 * Today card "Make it yours" (SPO-500 I5): onboarding stays one short question, and whatever the person skipped is offered
 * here, once, as a card in the hub announcements (HubSlot) like the new-theme invite. It opens the store and is gone for good
 * (`addons/startInvite.ts`). "Not interested" hides it for a month; it comes back at most twice more.
 */
import { storeHash } from '../addonStore/storeRoute';
import { markInviteSeen, snoozeInvite, useMakeItYoursInvite } from '../addons/startInvite';
import { useT } from '../i18n';
import { setHash } from '../route';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import './ThemeAnnouncement.css';

export function MakeItYoursInvite() {
  const { t } = useT();
  const due = useMakeItYoursInvite();
  if (!due) return null;
  return (
    <div className="thinv">
      <Card emphasis="glass" pad="md" className="thinv-card">
        <div className="thinv-text">
          <span className="thinv-kicker">{t.miyKicker}</span>
          <span className="thinv-name">{t.miyTitle}</span>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            markInviteSeen();
            setHash(storeHash('discover'));
          }}
        >
          {t.miyCta}
        </Button>
        <Button variant="ghost" onClick={() => snoozeInvite()}>
          {t.miyLater}
        </Button>
      </Card>
    </div>
  );
}
