/**
 * Find a condition on the body: Bones · Muscles · Organs layers with an anatomical map,
 * plus an "Other" tab for everything that is not tied to a body part (nervous system,
 * circulation, pregnancy, metabolic, systemic). Every catalogue condition is reachable
 * from here (see conditions.test.ts).
 */
import { useState } from 'react';
import './BodyMapPicker.css';
import {
  type AnatomyLayer,
  type AnatomyOrgan,
  type AnatomyView,
} from '../../components/ui/AnatomyMap';
import { AnatomyTurntable, type TurnCamera } from '../../components/ui/AnatomyTurntable';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { IconTile } from '../../components/ui/IconTile';
import { Segmented } from '../../components/ui/Segmented';
import {
  CONDITION_CATALOG,
  type CatalogCondition,
  type ConditionRegion,
} from '../../data/conditionCatalog';
import { OTHER_TAB_CATEGORIES, isOtherTab } from '../../conditions';
import { useT } from '../../i18n';
import { useConditionName } from '../../useConditionName';
import type { Strings } from '../../i18n/en';

type Layer = 'bones' | 'muscles' | 'organs' | 'other';
type RegionId = keyof Strings['cndRegion'];

interface Area {
  id: RegionId;
  regions: ConditionRegion[];
  marks: AnatomyLayer[];
  /** Organ layers this area is about (Organs tab): drawn in their own colour. */
  organs?: AnatomyOrgan[];
  view?: AnatomyView;
}

export const AREAS: Record<Exclude<Layer, 'other'>, Area[]> = {
  bones: [
    {
      id: 'neckBack',
      regions: ['neck', 'upper_back'],
      marks: ['spine_cervical', 'spine_thoracic'],
      view: 'back',
    },
    { id: 'lowerBack', regions: ['lower_back'], marks: ['spine_lumbar', 'sacrum'], view: 'back' },
    { id: 'shoulders', regions: ['shoulder'], marks: ['shoulder_l', 'shoulder_r'] },
    {
      id: 'arms',
      regions: ['elbow', 'wrist'],
      marks: ['elbow_l', 'elbow_r', 'wrist_l', 'wrist_r'],
    },
    { id: 'hips', regions: ['hip'], marks: ['hip_l', 'hip_r', 'pelvis'] },
    { id: 'knees', regions: ['knee'], marks: ['knee_l', 'knee_r'] },
    { id: 'feet', regions: ['ankle', 'foot'], marks: ['ankle_l', 'ankle_r'] },
  ],
  muscles: [
    { id: 'neck', regions: ['neck'], marks: ['m_neck'] },
    { id: 'shoulders', regions: ['shoulder'], marks: ['m_shoulder'] },
    { id: 'arms', regions: ['elbow', 'wrist'], marks: ['m_arm', 'm_forearm'] },
    { id: 'back', regions: ['upper_back', 'lower_back'], marks: ['m_back'], view: 'back' },
    { id: 'core', regions: ['abdomen'], marks: ['m_core'] },
    { id: 'hips', regions: ['hip'], marks: ['m_glutes', 'm_hipflex'] },
    { id: 'thighs', regions: ['knee'], marks: ['m_quads', 'm_hams'] },
    { id: 'lowerLegs', regions: ['ankle', 'foot'], marks: ['m_calves', 'm_shin'], view: 'back' },
  ],
  organs: [
    { id: 'heart', regions: ['heart'], marks: [], organs: ['heart'] },
    { id: 'lungs', regions: ['lungs'], marks: [], organs: ['lungs'] },
    { id: 'brain', regions: ['brain'], marks: [], organs: ['brain', 'spinalcord'] },
    {
      id: 'digestive',
      regions: ['abdomen'],
      marks: [],
      organs: ['liver', 'stomach', 'intestines', 'kidneys'],
    },
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
  'spinalcord',
];

const YAW: Record<AnatomyView, number> = { front: 0, left: 90, back: 180 };

/** Areas shown in the "Lower body" column; the rest are "Upper body". */
const LOWER = new Set<RegionId>(['hips', 'thighs', 'knees', 'lowerLegs', 'feet', 'digestive']);

/** Whole body: the default view, and what the camera returns to. */
const WHOLE = { y: 0.505, zoom: 1 };
/** Where the camera goes for each area: vertical centre on the figure (0 head … 1 feet) and zoom. */
const FOCUS: Partial<Record<RegionId, { y: number; zoom: number }>> = {
  neckBack: { y: 0.15, zoom: 2.2 },
  neck: { y: 0.12, zoom: 2.6 },
  lowerBack: { y: 0.33, zoom: 2.4 },
  shoulders: { y: 0.18, zoom: 2 },
  arms: { y: 0.3, zoom: 1.6 },
  back: { y: 0.24, zoom: 1.7 },
  core: { y: 0.3, zoom: 2 },
  hips: { y: 0.4, zoom: 2.2 },
  thighs: { y: 0.52, zoom: 1.8 },
  knees: { y: 0.64, zoom: 2.4 },
  lowerLegs: { y: 0.78, zoom: 1.8 },
  feet: { y: 0.93, zoom: 2.8 },
  heart: { y: 0.22, zoom: 2.4 },
  lungs: { y: 0.21, zoom: 2.2 },
  brain: { y: 0.06, zoom: 3 },
  digestive: { y: 0.32, zoom: 2.2 },
};

const inRegions = (c: CatalogCondition, regions: ConditionRegion[]) => regions.includes(c.region);

export function BodyMapPicker({ onPick }: { onPick: (c: CatalogCondition) => void }) {
  const { t } = useT();
  const condName = useConditionName();
  const [layer, setLayer] = useState<Layer>('bones');
  const [areaId, setAreaId] = useState<RegionId | null>(null);
  const [turn, setTurn] = useState<TurnCamera>({ yaw: 0, ...WHOLE, n: 0 });

  const areas = layer === 'other' ? [] : AREAS[layer];
  const area = areas.find((a) => a.id === areaId) ?? null;

  const results = area ? CONDITION_CATALOG.filter((c) => inRegions(c, area.regions)) : [];
  const other = OTHER_TAB_CATEGORIES.map((cat) => ({
    cat,
    items: CONDITION_CATALOG.filter((c) => isOtherTab(c) && c.category === cat),
  })).filter((g) => g.items.length);

  /** Swing round to the side the area lies on and move in on it; no area = the whole body. */
  const swing = (a?: Area, layerRef: Layer = layer) =>
    setTurn((c) => ({
      // Organs are picked from the front; the person can still turn the figure by hand.
      yaw: layerRef === 'organs' ? 0 : a ? YAW[a.view ?? 'front'] : c.yaw,
      ...((a && FOCUS[a.id]) || WHOLE),
      n: c.n + 1,
    }));

  const rows = (list: CatalogCondition[]) => (
    <GroupedList>
      {list.map((c) => (
        <ListRow
          key={c.key}
          icon={<IconTile tone="chronic" size={30} icon={c.icon} />}
          label={condName(c)}
          chevron
          onClick={() => onPick(c)}
        />
      ))}
    </GroupedList>
  );

  return (
    <div className="ul-flex ul-col ug-12">
      <Segmented
        label={t.cndLayer}
        variant="track"
        tone="chronic"
        value={layer}
        onChange={(v) => {
          setLayer(v);
          setAreaId(null);
          swing(undefined, v);
        }}
        options={[
          { value: 'bones', label: t.cndLayerBones },
          { value: 'muscles', label: t.cndLayerMuscles },
          { value: 'organs', label: t.cndLayerOrgans },
          { value: 'other', label: t.cndLayerOther },
        ]}
      />
      {layer === 'other' ? (
        <>
          <span className="ut-sm ut-muted">{t.cndOtherHint}</span>
          {other.map((g) => (
            <div key={g.cat} className="ul-flex ul-col ug-6">
              <span className="ut-sm ut-w6">{t.cndCat[g.cat]}</span>
              {rows(g.items)}
            </div>
          ))}
        </>
      ) : (
        <>
          <div className="bm-map">
            <AnatomyTurntable
              camera={turn}
              hint={t.cndRotateHint}
              rotatable
              caption={area ? t.cndRegion[area.id] : t.cndWhole}
              base={layer === 'muscles' ? 'muscles' : 'bones'}
              organs={layer === 'organs' ? ORGANS : []}
              activeOrgans={area?.organs}
              marks={(area?.marks ?? []).map((m) => ({ layer: m, tone: 'chronic' as const }))}
              label={area ? t.cndRegion[area.id] : t.cndWhole}
            />
          </div>
          <div className="bm-areas">
            {(
              [
                [t.cndUpper, areas.filter((a) => !LOWER.has(a.id))],
                [t.cndLower, areas.filter((a) => LOWER.has(a.id))],
              ] as const
            )
              .filter(([, list]) => list.length > 0)
              .map(([title, list]) => (
                <GroupedList key={title} header={title}>
                  {list.map((a) => (
                    <ListRow
                      key={a.id}
                      label={t.cndRegion[a.id]}
                      check={a.id === area?.id}
                      checkTone="chronic"
                      onClick={() => {
                        const off = a.id === area?.id; // tap again: back to the whole body
                        setAreaId(off ? null : a.id);
                        swing(off ? undefined : a);
                      }}
                    />
                  ))}
                </GroupedList>
              ))}
          </div>
          {area && (
            <>
              {results.length ? rows(results) : <span className="ut-muted">{t.cndNoResults}</span>}
            </>
          )}
        </>
      )}
    </div>
  );
}
