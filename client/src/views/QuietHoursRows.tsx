import { Icon } from '../ui';
import { Select } from '../components/ui/Select';
import { Switch } from '../components/ui/Switch';
import { useSafeT } from '../i18n/coachSafe';
import { fmtMinutes, saveQuiet, useQuietHours } from '../quietHours';
import './QuietHoursRows.css';

/** Every half hour of the day. */
const TIMES = Array.from({ length: 48 }, (_, i) => i * 30);

/**
 * The notification preference of the trainer chat (Q-17): quiet hours, on by default 22:00 to 07:00. Rows in the
 * Profile settings list. The messages keep counting as unread; only the sound / push is held back.
 */
export function QuietHoursRows() {
  const { sf } = useSafeT();
  const q = useQuietHours();
  return (
    <>
      <div className="profile-setting-row static">
        <Icon name="moon" />
        <span>{sf.qhTitle}</span>
        <Switch
          checked={q.on}
          aria-label={sf.qhTitle}
          onChange={() => saveQuiet({ ...q, on: !q.on })}
        />
      </div>
      {q.on && (
        <div className="qh-block">
          <p className="qh-sub">{sf.qhSub(fmtMinutes(q.from), fmtMinutes(q.to))}</p>
          <div className="qh-times">
            <label className="qh-field">
              <span>{sf.qhFrom}</span>
              <Select
                value={q.from}
                aria-label={sf.qhFrom}
                onChange={(e) => saveQuiet({ ...q, from: Number(e.target.value) })}
              >
                {TIMES.map((m) => (
                  <option key={m} value={m}>
                    {fmtMinutes(m)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="qh-field">
              <span>{sf.qhTo}</span>
              <Select
                value={q.to}
                aria-label={sf.qhTo}
                onChange={(e) => saveQuiet({ ...q, to: Number(e.target.value) })}
              >
                {TIMES.map((m) => (
                  <option key={m} value={m}>
                    {fmtMinutes(m)}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </div>
      )}
    </>
  );
}
