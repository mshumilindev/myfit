import { useState, type ReactNode } from 'react';
import { Icon } from '../../src/ui';
import { Button } from '../../src/components/ui/Button';
import { ConsentLevelPicker, type ConsentLevelId } from '../../src/components/ui/ConsentControls';
/** the real picker module brings its stylesheet; LevelRows below is its candidate variant */
export const _kit = ConsentLevelPicker;
import { Sheet } from '../../src/components/ui/Overlays';
import { Segmented } from '../../src/components/ui/Segmented';
import { Tag } from '../../src/components/ui/Tag';
import './lab.css';

/** Lab state comes from the URL (?ar=…) so one real story can be shot in every state. */
export const ar = (): string =>
  new URLSearchParams(typeof location === 'undefined' ? '' : location.search).get('ar') ?? '';

export type CatId = 'totals' | 'sets' | 'body' | 'sleep' | 'nutrition' | 'injury' | 'conditions' | 'nicotine' | 'alcohol' | 'supplements';
/** All ten settings of "Privacy and sharing", in the real groups (client/src/coach/client/shareModel.ts). */
export const GROUPS: { id: string; label: string; ids: CatId[] }[] = [
  { id: 'training', label: 'Training', ids: ['totals', 'sets'] },
  { id: 'body', label: 'Body', ids: ['body', 'sleep', 'nutrition'] },
  { id: 'life', label: 'Lifestyle and health', ids: ['injury', 'conditions', 'nicotine', 'alcohol', 'supplements'] },
];
const C = (id: CatId, label: string, what: string, health = false) => ({ id, label, what, health });
export const CATS = [
  C('totals', 'Workout totals', 'Sessions, duration, total volume'),
  C('sets', 'Sets and weights', 'Every set, weight and rep'),
  C('body', 'Body weight', 'Weight and measurements'),
  C('sleep', 'Sleep', 'How long and how well you sleep'),
  C('nutrition', 'Nutrition', 'Calories and macros', true),
  C('injury', 'Injuries', 'Injuries and pain notes', true),
  C('conditions', 'Chronic conditions', 'Conditions that affect training', true),
  C('nicotine', 'Nicotine', 'Smoking and vaping', true),
  C('alcohol', 'Alcohol', 'Whether you drank, never amounts', true),
  C('supplements', 'Supplements', 'What you take', true),
];
export const LEVELS: Record<ConsentLevelId, string> = { off: 'Off', effects: 'Effects', full: 'Full' };
/** The ask for this lab; `?ar=…-all` asks for every setting. */
export const askedIds = (): CatId[] =>
  ar().includes('every') ? CATS.map((c) => c.id) : ['sleep', 'nutrition', 'injury', 'alcohol'];
export const catOf = (id: CatId) => CATS.find((c) => c.id === id)!;
export const TRAINER = 'Iryna';
export const CLIENT = 'Oleh';

/** Client side: the one-time form. Starts at the client's own levels (all Off): the ask only highlights rows. */
/** Kit candidate (T1): `ConsentLevelPicker` with per-row `highlight`, `levels` (alcohol has no Full) and `blocked` (health consent missing). */
export function LevelRows({ ids, vals, onPick, blocked, highlight, off }: { ids: CatId[]; vals: Record<string, ConsentLevelId>; onPick: (id: CatId, l: ConsentLevelId) => void; blocked: (id: CatId) => boolean; highlight: boolean; off?: boolean }) {
  return (
    <>
      {GROUPS.map((g) => {
        const rows = g.ids.filter((i) => ids.includes(i));
        if (!rows.length) return null;
        return (
          <fieldset key={g.id} className="cc-pick" disabled={off}>
            <legend className="cc-legend">{g.label}</legend>
            {rows.map((id) => {
              const c = catOf(id);
              const lock = blocked(id);
              const levels = (id === 'alcohol' ? ['off', 'effects'] : ['off', 'effects', 'full']) as ConsentLevelId[];
              return (
                <div key={id} className={`cc-pick-row${highlight ? ' ar-hl' : ''}`}>
                  <span className="cc-t">
                    <b>{c.label}</b>
                    <small>{lock ? 'Needs your health-data consent first' : c.what}</small>
                  </span>
                  <Segmented<ConsentLevelId>
                    size="sm"
                    label={c.label}
                    value={vals[id] ?? 'off'}
                    onChange={(v) => onPick(id, v)}
                    options={levels.map((v) => ({ value: v, label: LEVELS[v], compact: true, disabled: lock || off }))}
                  />
                </div>
              );
            })}
          </fieldset>
        );
      })}
    </>
  );
}

export function ClientRequestForm({ onClose }: { onClose: () => void }) {
  const s = ar();
  const needHealth = s.includes('health');
  const offline = s.includes('offline');
  const ids = askedIds();
  const [consented, setConsented] = useState(!needHealth);
  const [vals, setVals] = useState<Record<string, ConsentLevelId>>({});
  const chosen = ids.filter((i) => (vals[i] ?? 'off') !== 'off').length;
  return (
    <Sheet onClose={onClose} label="Access request" closeLabel="Close" className="ar-sheet">
      <div className="ar-body">
        <div className="ar-title">{TRAINER} asks to see {ids.length === CATS.length ? 'everything you can share' : `${ids.length} things`}</div>
        <p className="ar-lead">
          Nothing is on until you choose. Pick how much to share for each row, or leave it Off. You can change this any time in Privacy and sharing.
        </p>
        {needHealth && (
          <div className="ar-note">
            <Icon name="lock-simple" />
            <span className="ar-note-t">
              <b>Health data needs your separate consent</b>
              <small>Nutrition, injuries, conditions, nicotine, alcohol and supplements are health data. Read and confirm it once to turn those rows on.</small>
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
          <LevelRows ids={ids} vals={vals} onPick={(id, l) => setVals({ ...vals, [id]: l })} blocked={(id) => catOf(id).health && !consented} highlight />
        </div>
        <div className="ar-acts">
          <Button variant="primary" fullWidth onClick={onClose}>
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
