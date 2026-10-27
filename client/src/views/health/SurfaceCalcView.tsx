/**
 * "Use in calculations" for a lifestyle tracker (nicotine, alcohol): the master switch plus two groups of per-surface
 * switches, "Based on research (weak)" and "Experimental" (no research, off by default), then the disclaimer. Switches
 * apply immediately (like the other settings screens), so there is no Save; Done just leaves the page. Kit primitives
 * only. The tracker supplies its surfaces, icons, labels and setters.
 */
import type { ReactNode } from 'react';
import { PageHead } from '../../components/ui/PageHead';
import { Button } from '../../components/ui/Button';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { IconTile } from '../../components/ui/IconTile';
import { Notice } from '../../components/ui/Notice';
import { StickyActionBar } from '../../components/ui/StickyActionBar';
import { Switch } from '../../components/ui/Switch';
import { useT } from '../../i18n';

export function SurfaceCalcView<K extends string>({
  onBack,
  master,
  onMaster,
  masterLabel,
  masterSub,
  surfaces,
  onSurface,
  research,
  experimental,
  icons,
  labels,
  disclaimer,
}: {
  onBack: () => void;
  master: boolean;
  onMaster: (on: boolean) => void;
  masterLabel: string;
  masterSub: string;
  /** Per-surface switch state; a missing key counts as on. */
  surfaces: Partial<Record<K, boolean>>;
  onSurface: (k: K, on: boolean) => void;
  research: readonly K[];
  experimental: readonly K[];
  icons: Record<K, string>;
  labels: Record<K, { label: string; sub: string }>;
  disclaimer: ReactNode;
}) {
  const { t } = useT();
  const row = (k: K) => (
    <ListRow
      key={k}
      as="label"
      dim={!master}
      icon={<IconTile tone="neutral" size={30} icon={icons[k]} />}
      label={labels[k].label}
      sub={labels[k].sub}
      trailing={
        <Switch
          checked={surfaces[k] !== false}
          disabled={!master}
          onChange={(on) => onSurface(k, on)}
          aria-label={labels[k].label}
        />
      }
    />
  );
  return (
    <div className="screen hl">
      <PageHead
        className="hl-pbar"
        back={{ label: t.backAction, onClick: onBack }}
        title={t.nicCalcTitle}
      />
      <div className="hl-scroll">
        <div className="hl-cnt">
          <GroupedList footer={t.nicCalcMasterFoot}>
            <ListRow
              as="label"
              icon={<IconTile tone="accent" size={30} icon="sliders-horizontal" />}
              label={masterLabel}
              sub={masterSub}
              trailing={<Switch checked={master} onChange={onMaster} aria-label={masterLabel} />}
            />
          </GroupedList>
          <GroupedList header={t.nicCalcResearch} footer={t.nicCalcResearchFoot}>
            {research.map(row)}
          </GroupedList>
          <div className="ul-flex ul-col ug-8">
            <div className="uigl-h">{t.nicCalcExperimental}</div>
            <Notice tone="neutral" icon="info">
              {t.nicCalcExpNotice}
            </Notice>
            <GroupedList>{experimental.map(row)}</GroupedList>
          </div>
          <Notice tone="neutral" icon="info">
            {disclaimer}
          </Notice>
        </div>
      </div>
      <StickyActionBar variant="page" surface="bg">
        <Button variant="primary" fullWidth onClick={onBack}>
          {t.done}
        </Button>
      </StickyActionBar>
    </div>
  );
}
