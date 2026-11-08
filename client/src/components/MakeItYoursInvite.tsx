/**
 * DESIGN DRAFT (SPO-500 I5/I8, awaiting approval): the Today card that offers the add-ons and a look after onboarding,
 * so onboarding itself stays short. Sits in the hub announcements (HubSlot) like the new-theme invite. Inert until the
 * owner approves the design: `inviteDraft.shown` is only switched on by its story.
 */
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Tag } from './ui/Tag';
import './ThemeAnnouncement.css';

export const inviteDraft = { shown: false };

export function MakeItYoursInvite() {
  if (!inviteDraft.shown) return null;
  return (
    <div className="thinv">
      <Card emphasis="glass" pad="md" className="thinv-card">
        <div className="thinv-text">
          <span className="thinv-kicker">
            Make it yours <Tag tone="accent">2 ideas</Tag>
          </span>
          <span className="thinv-name">Sleep and a new look</span>
        </div>
        <Button variant="primary">Take a look</Button>
      </Card>
    </div>
  );
}
