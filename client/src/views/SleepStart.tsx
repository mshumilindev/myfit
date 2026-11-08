import { Button } from '../components/ui/Button';
import { sleepBlockedBy, SLEEP_BLOCK_KEY } from '../sleepGuard';
import { startSleep, useStore } from '../store';
import { useT } from '../i18n';
import { Icon } from '../ui';

/**
 * Start a night of sleep from the Sleep screen (it used to live on the Health page). One live mode at a time: while a
 * workout, an activity or a home set runs the button is off and says why. Starting makes the night live, so the Sleep
 * screen switches to the night view by itself.
 */
export function SleepStart() {
  const { t } = useT();
  const block = sleepBlockedBy(useStore());
  return (
    <>
      <Button variant="sleep-fill" fullWidth disabled={!!block} onClick={() => void startSleep()}>
        <Icon name="moon" /> {t.sleepStart}
      </Button>
      {block && <p className="muted">{t[SLEEP_BLOCK_KEY[block]]}</p>}
    </>
  );
}
