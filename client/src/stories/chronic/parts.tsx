import type { ReactNode } from 'react';
import { exerciseImage } from '../../data/exercises';
import {
  AnatomyMap,
  type AnatomyFocus,
  type AnatomyLayer,
  type AnatomyOrgan,
  type AnatomyView,
} from '../../components/ui/AnatomyMap';
import { BackButton } from '../../components/ui/BackButton';
import { Card } from '../../components/ui/Card';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { IconTile } from '../../components/ui/IconTile';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { Segmented } from '../../components/ui/Segmented';
import { Switch } from '../../components/ui/Switch';
import { TabBar } from '../../components/ui/TabBar';
import '../../views/Health.css';

export const noop = () => undefined;

export type Share = 'inherit' | 'off' | 'effects' | 'full';
export interface Effect {
  icon: string;
  label: string;
  detail: string;
}
export interface Cond {
  id: string;
  name: string;
  cat: string;
  icon: string;
  sev: 1 | 2 | 3;
  sub: string;
  layers: AnatomyLayer[];
  view: AnatomyView;
  focus: AnatomyFocus;
  organs?: AnatomyOrgan[];
  effects: Effect[];
  share: Share;
}
export const SEV: Record<number, string> = { 1: 'Mild', 2: 'Moderate', 3: 'Severe' };

export const BACK: Cond = {
  id: 'back',
  name: 'Chronic lower back pain',
  cat: 'Spine',
  icon: 'person-simple',
  sev: 2,
  sub: 'Squats, deadlifts, rows adapt',
  layers: ['spine_lumbar'],
  view: 'left',
  focus: 'spine',
  effects: [
    { icon: 'barbell', label: 'Loads', detail: 'Squat, deadlift, row targets −25%' },
    { icon: 'list-checks', label: 'Exercises', detail: '6 flagged, 3 left out of auto-plans' },
  ],
  share: 'effects',
};
export const KNEE: Cond = {
  id: 'knee',
  name: 'Knee pain, undiagnosed',
  cat: 'Joints',
  icon: 'sneaker-move',
  sev: 1,
  sub: 'Right knee · deep bends and jumps adapt',
  layers: ['knee_r'],
  view: 'front',
  focus: 'knees',
  effects: [
    { icon: 'list-checks', label: 'Exercises', detail: 'Jumps and deep lunges flagged' },
    { icon: 'barbell', label: 'Loads', detail: 'Leg press and squat −10%' },
  ],
  share: 'inherit',
};
export const BP: Cond = {
  id: 'bp',
  name: 'High blood pressure',
  cat: 'Heart & circulation',
  icon: 'heartbeat',
  sev: 2,
  sub: 'Effort and breathing adapt',
  layers: ['heart_mask'],
  view: 'front',
  focus: 'torso',
  organs: ['heart', 'lungs'],
  effects: [
    { icon: 'gauge', label: 'Effort', detail: 'RPE cap 8, no failure or max sets' },
    { icon: 'wind', label: 'Breathing', detail: 'No breath-hold cues' },
  ],
  share: 'off',
};
export const MY = [BACK, KNEE, BP];

export const ALL_EFFECTS: Effect[] = [
  { icon: 'barbell', label: 'Loads', detail: 'Squat, deadlift, row targets capped' },
  { icon: 'list-checks', label: 'Exercises', detail: '6 flagged, 3 left out of auto-plans' },
  { icon: 'gauge', label: 'Effort', detail: 'RPE cap 8, no failure or max sets' },
  { icon: 'wind', label: 'Breathing', detail: 'No breath-hold cues' },
];

export const CATS = [
  { name: 'Spine', icon: 'person-simple', n: 34, minis: 'Back pain · Disc herniation · Scoliosis' },
  { name: 'Joints & tendons', icon: 'sneaker-move', n: 58, minis: 'Knee · Shoulder · Hip · Wrist' },
  { name: 'Heart & circulation', icon: 'heartbeat', n: 22, minis: 'Blood pressure · Arrhythmia' },
  { name: 'Breathing', icon: 'wind', n: 12, minis: 'Asthma · COPD' },
  { name: 'Nerves & balance', icon: 'brain', n: 19, minis: 'Neuropathy · Vertigo' },
  { name: 'After surgery', icon: 'bandaids', n: 46, minis: 'Spine · Knee · Shoulder · Abdomen' },
  { name: 'Chronic pain', icon: 'warning-circle', n: 21, minis: 'By area, no diagnosis needed' },
  { name: 'Metabolic', icon: 'drop', n: 14, minis: 'Diabetes · Thyroid' },
  { name: 'Pregnancy & postpartum', icon: 'hand-heart', n: 9, minis: 'Trimesters · Recovery' },
  { name: 'Other systems', icon: 'first-aid-kit', n: 31, minis: 'Digestive · Kidney · Skin' },
];
export const RESULTS = [
  { name: 'Chronic lower back pain', cat: 'Spine', icon: 'person-simple' },
  { name: 'Lumbar disc herniation', cat: 'Spine', icon: 'person-simple' },
  { name: 'Spondylolisthesis', cat: 'Spine', icon: 'person-simple' },
  { name: 'Spinal stenosis', cat: 'Spine', icon: 'person-simple' },
  { name: 'Scoliosis', cat: 'Spine', icon: 'person-simple' },
  { name: 'After spinal surgery, thoracic', cat: 'After surgery', icon: 'bandaids' },
  { name: 'After spinal surgery, lumbar', cat: 'After surgery', icon: 'bandaids' },
];

export const ChIcon = ({
  icon,
  size = 36,
}: {
  icon: string;
  size?: 30 | 32 | 36 | 40 | 44 | 48 | 56;
}) => <IconTile tone="chronic" size={size} icon={icon} />;

/** Thumbnail of a real catalogue exercise. */
export function ExThumb({ name, className = 'xp-row-img' }: { name: string; className?: string }) {
  const src = exerciseImage(name);
  return src ? <img src={src} alt="" className={className} /> : null;
}

export function Page({
  title,
  back = true,
  right,
  children,
  foot,
  tab = false,
}: {
  title: ReactNode;
  back?: boolean;
  right?: ReactNode;
  children: ReactNode;
  foot?: ReactNode;
  tab?: boolean;
}) {
  return (
    <div className="screen hl">
      <div className="hl-pbar">
        {back && <BackButton label="Back" onClick={noop} />}
        <h1 className="hl-pt">{title}</h1>
        {right}
      </div>
      <div className="hl-scroll">
        <div className="hl-cnt">{children}</div>
      </div>
      {foot}
      {tab && <AppTabs />}
    </div>
  );
}

export function AppTabs({ active = 'health' }: { active?: string }) {
  return (
    <TabBar
      items={[
        { id: 'today', label: 'Today', icon: 'house', active: active === 'today' },
        { id: 'overview', label: 'Overview', icon: 'chart-bar', active: active === 'overview' },
        { id: 'health', label: 'Health', icon: 'heartbeat', active: active === 'health' },
        { id: 'gyms', label: 'Gyms', icon: 'barbell', active: active === 'gyms' },
      ]}
      fab={{ ariaLabel: 'Start', onClick: noop }}
      onSelect={noop}
    />
  );
}

export const shareOptions = [
  { value: 'inherit' as Share, label: 'Default' },
  { value: 'off' as Share, label: 'Off' },
  { value: 'effects' as Share, label: 'Effects' },
  { value: 'full' as Share, label: 'Full' },
];
export const shareHint: Record<Share, string> = {
  inherit: 'Follows your default: coach sees nothing until you change it.',
  off: 'Your coach sees nothing about this condition.',
  effects: 'Coach sees only: “avoid heavy axial loading, ”. No name or area.',
  full: 'Coach sees the name, area and severity.',
};
export function ShareControl({ value }: { value: Share }) {
  return (
    <div className="ul-flex ul-col ug-8">
      <Segmented
        label="Coach sharing"
        options={shareOptions}
        value={value}
        onChange={noop}
        variant="track"
        tone="chronic"
      />
      <span className="ut-sm ut-muted">{shareHint[value]}</span>
    </div>
  );
}

export function EffectRows({ list, toggle = false }: { list: Effect[]; toggle?: boolean }) {
  return (
    <GroupedList>
      {list.map((e, i) => (
        <ListRow
          key={e.label}
          icon={<ChIcon icon={e.icon} size={32} />}
          label={e.label}
          sub={e.detail}
          trailing={
            toggle ? (
              <Switch checked={i !== 3} onChange={noop} tone="chronic" aria-label={e.label} />
            ) : undefined
          }
        />
      ))}
    </GroupedList>
  );
}

export function CondMap({
  c,
  view,
  focus,
  organs,
  layers,
  label,
}: {
  c?: Cond;
  view?: AnatomyView;
  focus?: AnatomyFocus;
  organs?: AnatomyOrgan[];
  layers?: AnatomyLayer[];
  label?: string;
}) {
  const ls = layers ?? c?.layers ?? [];
  return (
    <AnatomyMap
      view={view ?? c?.view}
      focus={focus ?? c?.focus}
      organs={organs ?? c?.organs}
      marks={ls.map((layer) => ({ layer, tone: 'chronic' as const }))}
      label={label ?? c?.name ?? 'Body map'}
    />
  );
}

export function PrivateNote() {
  return (
    <div className="ul-flex ua-center ug-8 ut-sm ut-muted">
      <IconTile tone="neutral" size={22} icon="lock" />
      Private. Encrypted on this device and in the cloud.
    </div>
  );
}
export const Card2 = Card;

/** Labelled block: section label + content with the app's tight header gap. */
export function Sec({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="ul-flex ul-col ug-8">
      <SectionLabel>{label}</SectionLabel>
      {children}
    </div>
  );
}
