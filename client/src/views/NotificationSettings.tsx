import { NotificationRows } from './NotificationRows';
import { QuietHoursRows } from './QuietHoursRows';

/** The notification block of the Profile settings list: quiet hours, then the Requests / Reminders / Team switches. */
export function NotificationSettings() {
  return (
    <>
      <QuietHoursRows />
      <NotificationRows />
    </>
  );
}
