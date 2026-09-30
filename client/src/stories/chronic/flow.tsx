import type { ReactNode } from 'react';
import { ExThumb } from './parts';
import {
  AnatomyMap,
  type AnatomyLayer,
  type AnatomyOrgan,
  type AnatomyView,
} from '../../components/ui/AnatomyMap';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { IconTile } from '../../components/ui/IconTile';
import { Notice } from '../../components/ui/Notice';
import { ConfirmDialog, Sheet } from '../../components/ui/Overlays';
import { PresetChips } from '../../components/ui/PresetChips';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { SearchField } from '../../components/ui/SearchField';
import { Segmented } from '../../components/ui/Segmented';
import { StickyActionBar } from '../../components/ui/StickyActionBar';
import { Switch } from '../../components/ui/Switch';
import { Tag } from '../../components/ui/Tag';
import { BACK, CATS, ChIcon, MY, Page, PrivateNote, RESULTS, Sec, noop } from './parts';

const flagTag = (kind: 'avoid' | 'careful' | 'ok', why?: string) =>
  kind === 'avoid' ? (
    <Tag tone="chronic" solid>{`Avoid${why ? ` · ${why}` : ''}`}</Tag>
  ) : kind === 'careful' ? (
    <Tag tone="chronic">{`Careful${why ? ` · ${why}` : ''}`}</Tag>
  ) : (
    <Tag tone="neutral">Fine for you</Tag>
  );

const chips = (labels: string[], sel?: string) => (
  <PresetChips
    tone="chronic"
    size="sm"
    items={labels.map((l) => ({ id: l, label: l, selected: l === sel, onClick: noop }))}
  />
);

const AB = ({ children }: { children: ReactNode }) => (
  <div className="ul-flex ug-8" style={{ alignItems: 'flex-start' }}>
    <IconTile tone="atlas" size={36} icon="sparkle" />
    <Card pad="md" emphasis="quiet">
      <span className="ut-md">{children}</span>
    </Card>
  </div>
);

/* ───────────── Add a condition: Body map (bones · muscles · organs) ───────────── */

type Layer = 'bones' | 'muscles' | 'organs';
interface Region {
  id: string;
  label: string;
  icon: string;
  marks: AnatomyLayer[];
  view?: AnatomyView;
}
const REGIONS: Record<Layer, Region[]> = {
  bones: [
    {
      id: 'neck',
      label: 'Neck and upper back',
      icon: 'person-simple',
      marks: ['spine_cervical', 'spine_thoracic'],
      view: 'back',
    },
    {
      id: 'lumbar',
      label: 'Lower back',
      icon: 'person-simple',
      marks: ['spine_lumbar', 'sacrum'],
      view: 'back',
    },
    {
      id: 'shoulder',
      label: 'Shoulders',
      icon: 'hand-grabbing',
      marks: ['shoulder_l', 'shoulder_r'],
    },
    {
      id: 'hip',
      label: 'Hips and pelvis',
      icon: 'person-simple-walk',
      marks: ['hip_l', 'hip_r', 'pelvis'],
    },
    { id: 'knee', label: 'Knees', icon: 'sneaker-move', marks: ['knee_l', 'knee_r'] },
    { id: 'ankle', label: 'Ankles and feet', icon: 'sneaker', marks: ['ankle_l', 'ankle_r'] },
  ],
  muscles: [
    { id: 'chest', label: 'Chest', icon: 'barbell', marks: ['m_chest'] },
    { id: 'shoulder', label: 'Shoulders', icon: 'barbell', marks: ['m_shoulder'] },
    { id: 'back', label: 'Back', icon: 'barbell', marks: ['m_back'], view: 'back' },
    { id: 'core', label: 'Core', icon: 'barbell', marks: ['m_core'] },
    { id: 'quads', label: 'Thighs', icon: 'barbell', marks: ['m_quads'] },
    { id: 'calves', label: 'Calves', icon: 'barbell', marks: ['m_calves'], view: 'back' },
  ],
  organs: [
    { id: 'heart', label: 'Heart and circulation', icon: 'heartbeat', marks: ['heart_mask'] },
    { id: 'lungs', label: 'Lungs and breathing', icon: 'wind', marks: ['lungs_shape'] },
    {
      id: 'brain',
      label: 'Brain and nerves',
      icon: 'brain',
      marks: ['brain_mask', 'spinalcord_mask'],
    },
    { id: 'digest', label: 'Digestive', icon: 'first-aid-kit', marks: [] },
    { id: 'kidney', label: 'Kidneys and metabolic', icon: 'drop', marks: [] },
  ],
};
const ORGANS: AnatomyOrgan[] = [
  'heart',
  'lungs',
  'liver',
  'kidneys',
  'stomach',
  'intestines',
  'brain',
];

const layerOptions = [
  { value: 'bones' as Layer, label: 'Bones' },
  { value: 'muscles' as Layer, label: 'Muscles' },
  { value: 'organs' as Layer, label: 'Organs' },
];
const modeOptions = [
  { value: 'list', label: 'List' },
  { value: 'body', label: 'Body map' },
];

function BodyCatalog({ layer, pick, sheet }: { layer: Layer; pick: string; sheet?: ReactNode }) {
  const regions = REGIONS[layer];
  const r = regions.find((x) => x.id === pick) ?? regions[0];
  return (
    <>
      <Page
        title="Add a condition"
        foot={
          <StickyActionBar>
            <Button variant="primary" fullWidth onClick={noop}>
              {`Show conditions: ${r.label}`}
            </Button>
          </StickyActionBar>
        }
      >
        <Segmented
          options={modeOptions}
          value="body"
          onChange={noop}
          variant="track"
          tone="chronic"
          label="Find by"
        />
        <Segmented
          options={layerOptions}
          value={layer}
          onChange={noop}
          variant="track"
          tone="chronic"
          label="Layer"
        />
        <div className="ul-flex ug-12">
          <div style={{ width: 168, flex: 'none' }}>
            <AnatomyMap
              view={r.view ?? 'front'}
              base={layer === 'muscles' ? 'muscles' : 'bones'}
              organs={layer === 'organs' ? ORGANS : []}
              marks={r.marks.map((m) => ({ layer: m, tone: 'chronic' as const }))}
              label={r.label}
            />
          </div>
          <div className="uf-1">
            <GroupedList>
              {regions.map((x) => (
                <ListRow
                  key={x.id}
                  label={x.label}
                  check={x.id === r.id}
                  checkTone="chronic"
                  onClick={noop}
                />
              ))}
            </GroupedList>
          </div>
        </div>
        <span className="ut-sm ut-muted">
          Tap the body or pick an area. Switch layer to reach muscles or organs.
        </span>
      </Page>
      {sheet}
    </>
  );
}

export const aBodyBones = () => <BodyCatalog layer="bones" pick="lumbar" />;
export const aBodyMuscles = () => <BodyCatalog layer="muscles" pick="quads" />;
export const aBodyOrgans = () => <BodyCatalog layer="organs" pick="heart" />;

export const aRegionSheet = () => (
  <BodyCatalog
    layer="bones"
    pick="lumbar"
    sheet={
      <Sheet onClose={noop}>
        <div className="ul-flex ul-col ug-12">
          <span className="ut-xl ut-w7">Lower back</span>
          <GroupedList>
            {RESULTS.slice(0, 5).map((x) => (
              <ListRow
                key={x.name}
                icon={<ChIcon icon={x.icon} size={32} />}
                label={x.name}
                chevron
                onClick={noop}
              />
            ))}
            <ListRow
              icon={<ChIcon icon="warning-circle" size={32} />}
              label="Pain here, no diagnosis"
              sub="Adapts like any long-term back pain"
              chevron
              onClick={noop}
            />
          </GroupedList>
        </div>
      </Sheet>
    }
  />
);

/* ───────────── Add a condition: List (search first) ───────────── */

export const aList = () => (
  <Page title="Add a condition">
    <Segmented
      options={modeOptions}
      value="list"
      onChange={noop}
      variant="track"
      tone="chronic"
      label="Find by"
    />
    <SearchField value="back" onChange={noop} placeholder="Search conditions" clearLabel="Clear" />
    {chips(
      ['All', 'Spine', 'Joints', 'Heart', 'Breathing', 'After surgery', 'Chronic pain'],
      'Spine',
    )}
    <GroupedList header="Spine">
      {RESULTS.map((x) => (
        <ListRow
          key={x.name}
          icon={<ChIcon icon={x.icon} size={32} />}
          label={x.name}
          value={<Tag tone="neutral">{x.cat}</Tag>}
          chevron
          onClick={noop}
        />
      ))}
    </GroupedList>
  </Page>
);

export const aListBrowse = () => (
  <Page title="Add a condition">
    <Segmented
      options={modeOptions}
      value="list"
      onChange={noop}
      variant="track"
      tone="chronic"
      label="Find by"
    />
    <SearchField value="" onChange={noop} placeholder="Search conditions" clearLabel="Clear" />
    <GroupedList header="Browse by category">
      {CATS.map((c) => (
        <ListRow
          key={c.name}
          icon={<ChIcon icon={c.icon} size={32} />}
          label={c.name}
          sub={c.minis}
          value={String(c.n)}
          chevron
          onClick={noop}
        />
      ))}
    </GroupedList>
  </Page>
);

/* ───────────── Set up (effects first) ───────────── */

export const aSetup = () => (
  <Page
    title="Lower back pain"
    foot={
      <StickyActionBar>
        <Button variant="primary" fullWidth onClick={noop}>
          Add condition
        </Button>
      </StickyActionBar>
    }
  >
    <Segmented
      options={[
        { value: 1, label: 'Mild' },
        { value: 2, label: 'Moderate' },
        { value: 3, label: 'Severe' },
      ]}
      value={2}
      onChange={noop}
      variant="track"
      tone="chronic"
      label="Severity"
    />
    <span className="ut-sm ut-muted">
      Everything below is set automatically. Switch off any you do not want.
    </span>
    <GroupedList>
      {[
        ['barbell', 'Loads', 'Squat, deadlift, row targets capped', true],
        ['list-checks', 'Exercises', '6 flagged, 3 left out of auto-plans', true],
        ['gauge', 'Effort', 'RPE cap 8, no failure or max sets', true],
        ['wind', 'Breathing', 'No breath-hold cues', false],
      ].map(([i, l, d, on]) => (
        <ListRow
          key={l as string}
          icon={<ChIcon icon={i as string} size={32} />}
          label={l as string}
          sub={d as string}
          trailing={
            <Switch
              checked={on as boolean}
              onChange={noop}
              tone="chronic"
              aria-label={l as string}
            />
          }
        />
      ))}
    </GroupedList>
    <GroupedList>
      <ListRow
        icon={<ChIcon icon="eye" size={32} />}
        label="Coach sharing"
        value="Default"
        chevron
        onClick={noop}
      />
    </GroupedList>
    <PrivateNote />
  </Page>
);

/* ───────────── Condition detail ───────────── */

export const aDetail = () => (
  <Page title="Lower back pain" right={<Tag tone="chronic">Moderate</Tag>}>
    <Card pad="md">
      <div className="ul-flex ug-12 ua-center">
        <div style={{ width: 110, flex: 'none' }}>
          <AnatomyMap
            view="left"
            focus="spine"
            marks={[{ layer: 'spine_lumbar' }]}
            label="Lower back"
          />
        </div>
        <div className="ul-flex ul-col ug-4 uf-1">
          <span className="ut-md ut-w6">Lower back</span>
          <span className="ut-sm ut-muted">Added 12 Sep. Adapts squats, deadlifts and rows.</span>
        </div>
      </div>
    </Card>
    <Sec label="What changes">
      <GroupedList>
        {[
          ['barbell', 'Loads', 'Squat, deadlift, row targets capped', true],
          ['list-checks', 'Exercises', '6 flagged, 3 left out of auto-plans', true],
          ['gauge', 'Effort', 'RPE cap 8, no failure or max sets', true],
        ].map(([i, l, d, on]) => (
          <ListRow
            key={l as string}
            icon={<ChIcon icon={i as string} size={32} />}
            label={l as string}
            sub={d as string}
            trailing={
              <Switch
                checked={on as boolean}
                onChange={noop}
                tone="chronic"
                aria-label={l as string}
              />
            }
          />
        ))}
      </GroupedList>
    </Sec>
    <Sec label="Coach sharing">
      <Segmented
        label="Coach sharing"
        options={[
          { value: 'inherit', label: 'Default' },
          { value: 'off', label: 'Off' },
          { value: 'effects', label: 'Effects' },
          { value: 'full', label: 'Full' },
        ]}
        value="effects"
        onChange={noop}
        variant="track"
        tone="chronic"
      />
      <span className="ut-sm ut-muted">Coach sees only the effects. No name or area.</span>
    </Sec>
    <Button variant="danger" fullWidth onClick={noop}>
      Delete condition
    </Button>
  </Page>
);

/* ───────────── Coach sharing ───────────── */

export const aSharing = () => (
  <Page title="Coach sharing">
    <Sec label="For all conditions">
      <Segmented
        label="Default"
        options={[
          { value: 'off', label: 'Share nothing' },
          { value: 'effects', label: 'Effects only' },
          { value: 'full', label: 'Full' },
        ]}
        value="off"
        onChange={noop}
        variant="track"
        tone="chronic"
      />
      <span className="ut-sm ut-muted">Nothing is shared until you change this.</span>
    </Sec>
    <GroupedList header="Per condition">
      {MY.map((c) => (
        <ListRow
          key={c.id}
          icon={<ChIcon icon={c.icon} size={32} />}
          label={c.name}
          value={
            c.share === 'inherit'
              ? 'Default'
              : c.share === 'off'
                ? 'Off'
                : c.share === 'effects'
                  ? 'Effects'
                  : 'Full'
          }
          chevron
          onClick={noop}
        />
      ))}
    </GroupedList>
    <Sec label="What your coach sees">
      <Card pad="md">
        <span className="ut-md">
          Avoid heavy axial loading. Effort cap 8. No condition names or areas.
        </span>
      </Card>
    </Sec>
  </Page>
);

/* ───────────── Other entry points and small screens ───────────── */

export const aAtlas = () => (
  <Page
    title="Atlas"
    foot={
      <div className="ul-flex" style={{ padding: 16 }}>
        <SearchField value="" onChange={noop} placeholder="Message Atlas" clearLabel="Clear" />
      </div>
    }
  >
    <div className="ul-flex uj-end">
      <Tag tone="chronic" className="ut-md">
        my lower back hurts after squats again
      </Tag>
    </div>
    <AB>If this is long-term I can adapt your training for good. Want me to add it?</AB>
    <Card pad="md">
      <div className="ul-flex ul-col ug-12">
        <div className="ul-flex ua-center ug-12">
          <ChIcon icon={BACK.icon} />
          <div className="ul-flex ul-col uf-1">
            <span className="ut-md ut-w6">{BACK.name}</span>
            <span className="ut-sm ut-muted">Adapts squats, deadlifts, rows</span>
          </div>
        </div>
        <div className="ul-flex ug-8">
          <Button variant="primary" onClick={noop}>
            Add it
          </Button>
          <Button variant="secondary" onClick={noop}>
            Not long-term
          </Button>
        </div>
      </div>
    </Card>
  </Page>
);

export const aOnboarding = () => (
  <Page
    title="Health"
    right={
      <Button variant="ghost" size="sm" onClick={noop}>
        Skip
      </Button>
    }
    foot={
      <StickyActionBar>
        <Button variant="primary" fullWidth onClick={noop}>
          Continue
        </Button>
      </StickyActionBar>
    }
  >
    <ProgressBar value={60} tone="chronic" label="Step 3 of 5" />
    <Sec label="Long-term conditions">
      <span className="ut-md">
        Anything permanent your training should respect. You can change it later.
      </span>
    </Sec>
    <AnatomyMap
      view="front"
      marks={[{ layer: 'spine_lumbar' }, { layer: 'knee_r' }]}
      label="Body map"
    />
    <Button variant="secondary" fullWidth icon="plus" onClick={noop}>
      Add a condition
    </Button>
  </Page>
);

/** Sheet shown over the real session screen. */
export const HurtsSheet = () => (
  <Sheet onClose={noop}>
    <div className="ul-flex ul-col ug-12">
      <span className="ut-xl ut-w7">This hurts me</span>
      <span className="ut-sm ut-muted">Where do you feel it?</span>
      <div className="ul-flex ua-center ug-16">
        <div style={{ width: 96 }}>
          <AnatomyMap
            view="left"
            focus="spine"
            marks={[{ layer: 'spine_lumbar' }]}
            label="Lower back"
          />
        </div>
        <div className="ul-flex ul-col ug-8 uf-1">
          {chips(['Lower back', 'Knee', 'Hip', 'Shoulder'], 'Lower back')}
        </div>
      </div>
      <Segmented
        label="How often"
        options={[
          { value: 1, label: 'Today only' },
          { value: 2, label: 'Often' },
          { value: 3, label: 'Always' },
        ]}
        value={3}
        onChange={noop}
        variant="track"
        tone="chronic"
      />
      <Button variant="primary" fullWidth onClick={noop}>
        Set up as long-term condition
      </Button>
      <Button variant="ghost" fullWidth onClick={noop}>
        Just this workout
      </Button>
    </div>
  </Sheet>
);

export const SwapSheet = () => (
  <Sheet onClose={noop}>
    <div className="ul-flex ul-col ug-12">
      <span className="ut-xl ut-w7">Safer swap for Box Jump</span>
      <span className="ut-sm ut-muted">Similar muscles, gentler on the right knee.</span>
      {[
        ['Dumbbell Step Ups', 'Quads · Glutes'],
        ['Goblet Squat', 'Quads · Core'],
        ['Leg Press', 'Quads · Glutes'],
      ].map(([n, m]) => (
        <Card key={n} as="button" pad="sm" onClick={noop}>
          <div className="ul-flex ua-center ug-12 uw-full">
            <ExThumb name={n} />
            <div className="ul-flex ul-col ug-4 uf-1">
              <span className="ut-md ut-w6">{n}</span>
              <span className="ut-sm ut-muted">{m}</span>
            </div>
            {flagTag('ok')}
          </div>
        </Card>
      ))}
      <Button variant="ghost" fullWidth onClick={noop}>
        Keep Box Jump
      </Button>
    </div>
  </Sheet>
);

export const aAssign = () => (
  <Page title="Assign program">
    <GroupedList header="Client">
      <ListRow
        icon={<IconTile tone="neutral" size={36} icon="user" />}
        label="Anna K."
        sub="Strength 3×"
        chevron
        onClick={noop}
      />
    </GroupedList>
    <Sec label="What the client shares with you">
      <Card pad="md">
        <div className="ul-flex ul-col ug-8">
          <Tag tone="chronic">Effects only</Tag>
          <span className="ut-md">Avoid heavy axial loading. Effort cap 8.</span>
          <span className="ut-sm ut-muted">No condition names or areas.</span>
        </div>
      </Card>
    </Sec>
    <Notice tone="chronic" icon="shield-check">
      The program adapts on the client's device.
    </Notice>
  </Page>
);

export const aKeys = () => (
  <Page title="Recovery key">
    <Notice tone="chronic" icon="key">
      Your health data is end-to-end encrypted. If you lose this key, it cannot be recovered.
    </Notice>
    <Card pad="md">
      <span className="ut-lg ut-w7">Q7XK-2M9P-… (shown once)</span>
    </Card>
    <Button variant="primary" fullWidth onClick={noop}>
      I saved it
    </Button>
    <Button variant="ghost" fullWidth onClick={noop}>
      Unlock with key
    </Button>
  </Page>
);

export const aDelete = () => (
  <>
    <Page title="Lower back pain" right={<Tag tone="chronic">Moderate</Tag>}>
      <Card pad="md">
        <span className="ut-md">Lower back. Adapts squats, deadlifts and rows.</span>
      </Card>
    </Page>
    <ConfirmDialog
      danger
      title="Delete this condition?"
      body="Training stops adapting for it, and it is removed from your encrypted health data."
      confirmLabel="Delete"
      cancelLabel="Cancel"
      onConfirm={noop}
      onCancel={noop}
    />
  </>
);

export const aEmpty = () => (
  <Page title="Long-term conditions">
    <EmptyState
      icon="heartbeat"
      title="Nothing long-term yet"
      body="Add a condition and every workout, target and suggestion adapts on its own. Private by default."
      centered
    >
      <Button variant="primary" onClick={noop}>
        Add a condition
      </Button>
    </EmptyState>
  </Page>
);
