import { useState, type ReactNode } from 'react';
import { Icon } from '../../src/ui';
import { Button } from '../../src/components/ui/Button';
import { ConsentLevelPicker, type ConsentLevelId } from '../../src/components/ui/ConsentControls';
import { Sheet } from '../../src/components/ui/Overlays';
import { Tag } from '../../src/components/ui/Tag';
import './lab.css';

/** Lab state comes from the URL (?ar=…) so one real story can be shot in every state. */
export const ar = (): string =>
  new URLSearchParams(typeof location === 'undefined' ? '' : location.search).get('ar') ?? '';

export type CatId = 'sleep' | 'body' | 'injury' | 'sets' | 'nutrition' | 'totals';
export const CATS: { id: CatId; label: string; what: string; health: boolean }[] = [
  { id: 'totals', label: 'Workout totals', what: 'Sessions, volume and duration', health: false },
  { id: 'sets', label: 'Sets and loads', what: 'Every set, weight and rep', health: false },
  { id: 'body', label: 'Body weight', what: 'Weight and measurements', health: true },
  { id: 'sleep', label: 'Sleep', what: 'How long and how well you sleep', health: true },
  { id: 'injury', label: 'Injuries', what: 'Injuries and pain notes', health: true },
  { id: 'nutrition', label: 'Nutrition', what: 'Calories and macros', health: true },
];
export const LEVELS: Record<ConsentLevelId, string> = { off: 'Off', effects: 'Effects', full: 'Full' };
/** What this lab pretends the trainer asked for (category, proposed level). */
export const ASKED: { id: CatId; level: ConsentLevelId }[] = [
  { id: 'sleep', level: 'effects' },
  { id: 'body', level: 'effects' },
  { id: 'injury', level: 'effects' },
];
export const catOf = (id: CatId) => CATS.find((c) => c.id === id)!;
export const TRAINER = 'Iryna';
export const CLIENT = 'Oleh';

/** Client side: the one-time form. Starts at the client's own levels (all Off): the ask only highlights rows. */
export function ClientRequestForm({ onClose }: { onClose: () => void }) {
  const s = ar();
  const needHealth = s.includes('health');
  const offline = s.includes('offline');
  const [consented, setConsented] = useState(!needHealth);
  const [vals, setVals] = useState<Record<string, ConsentLevelId>>(
    Object.fromEntries(ASKED.map((a) => [a.id, 'off'])),
  );
  const rows = ASKED.map((a) => {
    const c = catOf(a.id);
    return { id: a.id, label: c.label, what: `${TRAINER} asks for this. ${c.what}`, value: vals[a.id] };
  });
  const chosen = Object.values(vals).filter((v) => v !== 'off').length;
  return (
    <Sheet onClose={onClose} label="Access request" closeLabel="Close" className="ar-sheet">
      <div className="ar-body">
        <div className="ar-title">{TRAINER} asks to see {ASKED.length} things</div>
        <p className="ar-lead">
          Nothing is on until you choose. Pick how much to share for each row, or leave it Off. You can change this any time in Privacy and sharing.
        </p>
        {needHealth && (
          <div className="ar-note">
            <Icon name="lock-simple" />
            <span className="ar-note-t">
              <b>Health data needs your separate consent</b>
              <small>Sleep, body weight and injuries are health data. Read and confirm it once to turn these rows on.</small>
            </span>
            {!consented ? (
              <Button size="sm" variant="secondary" onClick={() => setConsented(true)}>Review</Button>
            ) : (
              <Tag tone="ok">Confirmed</Tag>
            )}
          </div>
        )}
        {offline && (
          <div className="ar-note ar-note--quiet">
            <Icon name="clock" />
            <span className="ar-note-t">
              <b>You are offline</b>
              <small>Your choices are kept on this device and sent when you are back online.</small>
            </span>
          </div>
        )}
        <div className="ar-rows">
          <ConsentLevelPicker
            legend="What should Iryna see"
            rows={rows}
            levelLabels={LEVELS}
            disabled={!consented}
            onChange={(id, l) => setVals({ ...vals, [id]: l })}
          />
        </div>
        <div className="ar-acts">
          <Button variant="primary" fullWidth disabled={!consented} onClick={onClose}>
            {chosen ? `Save ${chosen} ${chosen === 1 ? 'choice' : 'choices'}` : 'Save choices'}
          </Button>
          <Button variant="ghost" fullWidth onClick={onClose}>Not now</Button>
        </div>
        <p className="ar-fine">{TRAINER} is told only “allowed”, “partly allowed” or “not now”. No reasons.</p>
      </div>
    </Sheet>
  );
}

export type AskResult = 'pending' | 'allowed' | 'partial' | 'declined' | 'expired';
export const resultOf = (s: string): AskResult =>
  s.includes('allowed') ? 'allowed' : s.includes('partial') ? 'partial' : s.includes('declined') ? 'declined' : s.includes('expired') ? 'expired' : 'pending';

export const ResultTag = ({ r }: { r: AskResult }): ReactNode =>
  r === 'allowed' ? <Tag tone="ok">Allowed</Tag>
  : r === 'partial' ? <Tag tone="accent">Partly allowed</Tag>
  : r === 'declined' ? <Tag tone="neutral">Not now</Tag>
  : r === 'expired' ? <Tag tone="neutral">Expired</Tag>
  : <Tag tone="accent">Waiting</Tag>;
