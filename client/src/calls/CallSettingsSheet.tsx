import { useState } from 'react';
import { CallPreflight } from '../components/ui/CallPreflight';
import { CallVideo } from '../components/ui/CallVideo';
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { Hint } from '../components/ui/Hint';
import { Switch } from '../components/ui/Switch';
import { Icon, Sheet } from '../ui';
import { useCallsT } from '../i18n/calls';
import { readCallPrefs, writeCallPrefs } from './callPrefs';
import { useCallPreview } from './useCallPreview';

/**
 * Call settings (SPO-446): this device's choices for calls, opened from Profile → Settings → Calls. The same picture,
 * level meter and pickers as the pre-call check, plus "Direct connection" (off = every call goes through a relay; on = a
 * peer-to-peer path that shows each side's network address to the other). Choices are device-local (`gym.callPrefs`).
 */
export function CallSettingsSheet({ onClose }: { onClose: () => void }) {
  const { cl } = useCallsT();
  const [prefs, setPrefs] = useState(readCallPrefs);
  const { stream, mics, cams, failed, level } = useCallPreview(prefs, prefs.camOn);
  const patch = (p: Partial<typeof prefs>) => setPrefs(writeCallPrefs(p));
  const none = [{ id: '', label: cl.callPreNoDevices }];

  return (
    <Sheet padded label={cl.callSetTitle} closeLabel={cl.callClose} onClose={onClose}>
      <div className="ul-flex ul-col ug-16">
        <div className="sheet-head">
          <Icon name="video-camera" />
          <div className="t">{cl.callSetTitle}</div>
        </div>
        <Hint>{cl.callSetNotRecorded}</Hint>
        {failed ? (
          <p role="alert">{cl.callPermDeniedB}</p>
        ) : (
          <CallPreflight
            preview={
              prefs.camOn && stream ? <CallVideo stream={stream} self label={cl.callYou} /> : null
            }
            level={level}
            levelLabel={cl.callPreLevel}
            cameraLabel={cl.callSetCamOn}
            cameraOn={prefs.camOn}
            onCamera={(on) => patch({ camOn: on })}
            micLabel={cl.callPreMic}
            micDevice={prefs.mic}
            micDevices={mics.length ? mics : none}
            onMicDevice={(id) => patch({ mic: id })}
            camLabel={cl.callPreCam}
            camDevice={prefs.cam}
            camDevices={cams.length ? cams : none}
            onCamDevice={(id) => patch({ cam: id })}
          />
        )}
        <GroupedList>
          <ListRow
            label={cl.callSetDirect}
            sub={cl.callSetDirectSub}
            trailing={
              <Switch
                checked={prefs.direct}
                aria-label={cl.callSetDirect}
                onChange={(on) => patch({ direct: on })}
              />
            }
          />
        </GroupedList>
      </div>
    </Sheet>
  );
}
