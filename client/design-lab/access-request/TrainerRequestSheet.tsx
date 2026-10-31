import { useEffect, useState } from 'react';
import { Button } from '../../src/components/ui/Button';
import { ConsentLevelPicker, type ConsentLevelId } from '../../src/components/ui/ConsentControls';
import { Icon } from '../../src/ui';
import { Sheet } from '../../src/components/ui/Overlays';
import { Tag } from '../../src/components/ui/Tag';
import { CATS, LEVELS, ar, type CatId } from './lab';

const SHARED: Partial<Record<CatId, ConsentLevelId>> = { totals: 'full', sets: 'effects' };

function Body({ onClose, CLIENT }: { onClose: () => void; CLIENT: string }) {
  const s = ar();
  const noApp = s.includes('noapp');
  const cool = s.includes('cooldown');
  const [vals, setVals] = useState<Record<string, ConsentLevelId>>({ sleep: 'effects', body: 'effects', injury: 'off', nutrition: 'off' });
  const closed = CATS.filter((c) => !SHARED[c.id]);
  const picked = Object.values(vals).filter((v) => v !== 'off').length;
  const disabled = noApp || cool;
  return (
    <Sheet onClose={onClose} label="Request access" closeLabel="Close" className="ar-sheet">
      <div className="ar-body">
        <div className="ar-title">Ask {CLIENT} for access</div>
        {noApp ? (
          <div className="ar-note">
            <Icon name="lock-simple" />
            <span className="ar-note-t">
              <b>{CLIENT} does not use the app</b>
              <small>Nothing can be sent. You enter this data for {CLIENT} yourself.</small>
            </span>
          </div>
        ) : (
          <p className="ar-lead">
            {CLIENT} gets one short form with these rows highlighted. He decides what to turn on; nothing changes until he does. Pick a level to suggest, or leave a row on Don’t ask.
          </p>
        )}
        {cool && (
          <div className="ar-note ar-note--quiet">
            <Icon name="clock" />
            <span className="ar-note-t">
              <b>You asked 3 hours ago</b>
              <small>You can ask again in 21 hours. {CLIENT} has not answered yet.</small>
            </span>
          </div>
        )}
        <div className="ar-rows">
          <ConsentLevelPicker
            legend="What to ask for"
            rows={closed.map((c) => ({ id: c.id, label: c.label, what: c.what, value: vals[c.id] ?? 'off' }))}
            levelLabels={{ ...LEVELS, off: 'Don’t ask' }}
            disabled={disabled}
            onChange={(id, l) => setVals({ ...vals, [id]: l })}
          />
          <div className="ar-have">
            <b>Already shared</b>
            {CATS.filter((c) => SHARED[c.id]).map((c) => (
              <span key={c.id} className="ar-have-r">
                <span>{c.label}</span>
                <Tag tone="ok">{LEVELS[SHARED[c.id]!]}</Tag>
              </span>
            ))}
          </div>
        </div>
        <div className="ar-acts">
          <Button variant="primary" fullWidth disabled={disabled || picked === 0} onClick={onClose}>
            {cool ? 'Ask again in 21 h' : picked ? `Send request for ${picked}` : 'Send request'}
          </Button>
        </div>
        <p className="ar-fine">{CLIENT} sees the request in chat and as a “New request” notification, with no details in it.</p>
      </div>
    </Sheet>
  );
}

/** The entry point: replaces the old "Ask … to share" button. */
export function RequestButton() {
  const s = ar();
  const noApp = s.includes('noapp');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (s.startsWith('trainer-sheet')) setOpen(true);
  }, [s]);
  return (
    <>
      <Button variant="secondary" size="sm" icon="key" disabled={noApp} onClick={() => setOpen(true)}>
        Request access
      </Button>
      {noApp && <small className="ar-fine">Viktoriia does not use the app. You enter this data yourself.</small>}
      {open && <Body CLIENT="Viktoriia" onClose={() => setOpen(false)} />}
    </>
  );
}

/** Over stories without that button (the trainer's chat): open the same sheet when asked. */
export function TrainerSheetHost() {
  const s = ar();
  const [open, setOpen] = useState(true);
  if (!s.startsWith('trainer-sheet-chat') || !open) return null;
  return <Body CLIENT="Oleh" onClose={() => setOpen(false)} />;
}
