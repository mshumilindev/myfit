import { Icon } from '../ui';
import { Switch } from '../components/ui/Switch';
import { useSafeT } from '../i18n/coachSafe';
import { savePrefs, usePushPrefs, type PushPrefs } from '../pushPrefs';

const ROWS = [
  { key: 'requests', icon: 'envelope' },
  { key: 'reminders', icon: 'bell' },
  { key: 'team', icon: 'users' },
] as const;

/**
 * The three notification switches of the coaching pushes (SPO-237): Requests, Reminders, Team. Rows in the Profile
 * settings list, under the quiet hours. A switched-off kind sends no push; the message stays in Spotter.
 */
export function NotificationRows() {
  const { sf } = useSafeT();
  const prefs = usePushPrefs();
  const label = { requests: sf.pnRequests, reminders: sf.pnReminders, team: sf.pnTeam } as const;
  return (
    <>
      {ROWS.map((r) => (
        <div key={r.key} className="profile-setting-row static">
          <Icon name={r.icon} />
          <span>{label[r.key]}</span>
          <Switch
            checked={prefs[r.key]}
            aria-label={label[r.key]}
            onChange={() => savePrefs({ ...prefs, [r.key]: !prefs[r.key] } as PushPrefs)}
          />
        </div>
      ))}
      <p className="qh-sub">{sf.pnSub}</p>
    </>
  );
}
