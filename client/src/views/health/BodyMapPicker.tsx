/**
 * Find a condition on the body: Bones · Muscles · Organs layers with an anatomical map,
 * plus an "Other" tab for everything that is not tied to a body part (nervous system,
 * circulation, pregnancy, metabolic, systemic). Every catalogue condition is reachable
 * from here (see conditions.test.ts).
 */
import { useState } from 'react';
import {
  AnatomyTurntable,
  type AnatomyLayer,
  type AnatomyOrgan,
  type AnatomyView,
} from '../../components/ui/AnatomyMap';
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
import type { Strings } from '../../i18n/en';

type Layer = 'bones' | 'muscles' | 'organs' | 'other';
type RegionId = keyof Strings['cndRegion'];

interface Area {
  id: RegionId;
  regions: ConditionRegion[];
  marks: AnatomyLayer[];
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
    { id: 'heart', regions: ['heart'], marks: ['heart_mask'] },
    { id: 'lungs', regions: ['lungs'], marks: ['lungs_shape'] },
    { id: 'brain', regions: ['brain'], marks: ['brain_mask', 'spinalcord_mask'] },
    { id: 'digestive', regions: ['abdomen'], marks: [] },
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

const inRegions = (c: CatalogCondition, regions: ConditionRegion[]) => regions.includes(c.region);

export function BodyMapPicker({ onPick }: { onPick: (c: CatalogCondition) => void }) {
  const { t } = useT();
  const [layer, setLayer] = useState<Layer>('bones');
  const [areaId, setAreaId] = useState<RegionId | null>(null);

  const areas = layer === 'other' ? [] : AREAS[layer];
  const area = areas.find((a) => a.id === areaId) ?? areas[0] ?? null;

  const results = area ? CONDITION_CATALOG.filter((c) => inRegions(c, area.regions)) : [];
  const other = OTHER_TAB_CATEGORIES.map((cat) => ({
    cat,
    items: CONDITION_CATALOG.filter((c) => isOtherTab(c) && c.category === cat),
  })).filter((g) => g.items.length);

  const rows = (list: CatalogCondition[]) => (
    <GroupedList>
      {list.map((c) => (
        <ListRow
          key={c.key}
          icon={<IconTile tone="chronic" size={30} icon={c.icon} />}
          label={c.name}
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
        area && (
          <>
            <div className="ul-flex ug-12">
              <div style={{ width: 150, flex: 'none' }}>
                <AnatomyTurntable
                  side={area.view ?? 'front'}
                  base={layer === 'muscles' ? 'muscles' : 'bones'}
                  organs={layer === 'organs' ? ORGANS : []}
                  marks={area.marks.map((m) => ({ layer: m, tone: 'chronic' as const }))}
                  label={t.cndRegion[area.id]}
                />
              </div>
              <div className="uf-1">
                <GroupedList>
                  {areas.map((a) => (
                    <ListRow
                      key={a.id}
                      label={t.cndRegion[a.id]}
                      check={a.id === area.id}
                      checkTone="chronic"
                      onClick={() => setAreaId(a.id)}
                    />
                  ))}
                </GroupedList>
              </div>
            </div>
            <span className="ut-sm ut-w6">{t.cndRegion[area.id]}</span>
            {results.length ? rows(results) : <span className="ut-muted">{t.cndNoResults}</span>}
          </>
        )
      )}
    </div>
  );
}
