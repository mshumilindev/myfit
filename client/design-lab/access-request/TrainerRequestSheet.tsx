import { useEffect, useState } from 'react';
import { Button } from '../../src/components/ui/Button';
import { Checkbox } from '../../src/components/ui/Checkbox';
import type { ConsentLevelId } from '../../src/components/ui/ConsentControls';
import { Icon } from '../../src/ui';
import { Sheet } from '../../src/components/ui/Overlays';
import { Tag } from '../../src/components/ui/Tag';
import { CATS, GROUPS, LEVELS, ar, type CatId } from './lab';

const SHARED: Partial<Record<CatId, ConsentLevelId>> = { totals: 'full', sets: 'effects' };

function Body({ onClose, CLIENT }: { onClose: () => void; CLIENT: string }) {
  const s = ar();
  const noApp = s.includes('noapp');
  const cool = s.includes('cooldown');
  const [vals, setVals] = useState<Record<string, ConsentLevelId>>({ sleep: 'effects', nutrition: 'effects' });
  const closed = CATS.filter((c) => !SHARED[c.id]);
  const picked = closed.filter((c) => vals[c.id] === 'effects').length;
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
            {CLIENT} gets one short form with these rows highlighted. Tick what you need. They decide what to turn on and how much; nothing changes until he does.
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
          {GROUPS.filter((g) => g.ids.some((i) => !SHARED[i])).map((g) => (
            <fieldset key={g.id} className="ar-pick" disabled={disabled}>
              <legend className="ar-legend">{g.label}</legend>
              {g.ids.filter((i) => !SHARED[i]).map((id) => {
                const c = CATS.find((x) => x.id === id)!;
                return (
                  <label key={id} className="ar-pick-row">
                    <Checkbox checked={vals[id] === 'effects'} onChange={(v) => setVals({ ...vals, [id]: v ? 'effects' : 'off' })} />
                    <span className="ar-note-t">
                      <b>{c.label}</b>
                      <small>{c.what}</small>
                    </span>
                  </label>
                );
              })}
            </fieldset>
          ))}
          <Button variant="ghost" size="sm" disabled={disabled} onClick={() => setVals(Object.fromEntries(closed.map((c) => [c.id, 'effects'])))}>
            Ask for everything
          </Button>
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
