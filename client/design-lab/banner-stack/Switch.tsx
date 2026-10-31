import { NudgeStack as Baseline, type Nudge } from '../../src/components/NudgeStack';
import { V2 as VARIANTS } from './v2';
import { Button } from '../../src/components/ui/Button';
import './lab.css';

export type { Nudge };

const q = () => new URLSearchParams(typeof location === 'undefined' ? '' : location.search);

/** Sample advisories padded onto the real ones so 6-banner days can be judged (real tones/icons/kicker style). */
const EXTRA: Nudge[] = [
  { id: 'x-readiness', tone: 'readiness', priority: 70, icon: 'heartbeat', kicker: 'Readiness', title: 'Legs are fresh, go heavy today', body: 'Quads and glutes recovered 100%. A good day for the top set.' },
  { id: 'x-plan', tone: 'plan', priority: 100, icon: 'calendar-check', kicker: 'Today', title: 'Lower A today at 18:00', body: '5 exercises, about 55 minutes.', actions: () => <Button size="sm" variant="secondary" icon="play">Start session</Button> },
  { id: 'x-body', tone: 'body', priority: 30, icon: 'scales', kicker: 'Body', title: 'Weigh-in is due', body: 'Your last weight was 9 days ago.' },
  { id: 'x-learn', tone: 'learn', priority: 20, icon: 'graduation-cap', kicker: 'Learn', title: '2 lessons left in Technique basics', body: 'Five minutes finishes the module.' },
  { id: 'x-rest', tone: 'rest', priority: 45, icon: 'moon', kicker: 'Recovery', title: 'Sleep was short, ease the volume', body: 'Last night 5:40. Keep RPE under 8 today.' },
];

export function NudgeStack({ nudges }: { nudges: Nudge[] }) {
  const p = q();
  const v = Number(p.get('bv') ?? '0');
  const n = p.get('bn') ?? '3';
  let list = nudges;
  if (n === '1') list = nudges.slice(0, 1);
  if (n === '6') list = [...nudges, ...EXTRA].slice(0, 6);
  if (!v || !VARIANTS[v - 1]) return <div data-bl><Baseline nudges={list} /></div>;
  const V = VARIANTS[v - 1].render;
  return <div data-bl><V items={[...list].sort((a, b) => b.priority - a.priority)} /></div>;
}
