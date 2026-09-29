/**
 * Settings of one core block (design B6 "Program & week", A2 "Atlas & clients",
 * plus Nudges and History). Every change lands in the Customize draft right
 * away, so the block previews behind the sheet follow, and Save / Cancel of
 * the whole edit keep their meaning. "Reset block" puts the defaults back.
 */
import type { ReactNode } from 'react';
import { Button } from '../components/ui/Button';
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { OptionCard, OptionCardGrid } from '../components/ui/OptionCard';
import { Segmented } from '../components/ui/Segmented';
import { Switch } from '../components/ui/Switch';
import { Icon, Sheet } from '../ui';
import { useT } from '../i18n';
import {
  HISTORY_DAYS,
  NUDGE_KINDS,
  coreOpts,
  setCoreOpts,
  type AtlasLayout,
  type AtlasOpts,
  type AtlasView,
  type ConfigurableCore,
  type CoreOptsMap,
  type ProgramOpts,
  type TodayLayout,
} from './layout';

export function CoreConfigSheet({
  id,
  draft,
  onChange,
  preview,
  hasClients,
  onClose,
}: {
  id: ConfigurableCore;
  draft: TodayLayout;
  onChange: (next: TodayLayout) => void;
  /** The block itself, rendered with the draft's options. */
  preview: ReactNode;
  /** Without clients only the Atlas options apply. */
  hasClients: boolean;
  onClose: () => void;
}) {
  const { t } = useT();
  const set = <K extends ConfigurableCore>(k: K, patch: Partial<CoreOptsMap[K]>) =>
    onChange(setCoreOpts(draft, k, patch));

  const toggle = (label: string, sub: string, checked: boolean, on: (v: boolean) => void) => (
    <ListRow
      key={label}
      as="label"
      label={label}
      sub={sub}
      trailing={<Switch checked={checked} onChange={on} aria-label={label} />}
    />
  );

  let body: ReactNode;
  if (id === 'program') {
    const o: ProgramOpts = coreOpts(draft, 'program');
    const p = (patch: Partial<ProgramOpts>) => set('program', patch);
    body = (
      <>
        <div className="tdc-preview tdc-cfg-preview" aria-hidden="true">
          {preview}
        </div>
        <div className="tdc-sheet-lab">{t.todayOptCardStyle}</div>
        <Segmented
          label={t.todayOptCardStyle}
          value={o.style}
          onChange={(style) => p({ style })}
          options={(['compact', 'standard', 'detailed'] as const).map((v) => ({
            value: v,
            label: t.todayProgStyle[v],
          }))}
        />
        <div className="tdc-sheet-lab">{t.todayOptShow}</div>
        <GroupedList surface="raised">
          {toggle(t.todayOptWeekPills, t.todayOptWeekPillsSub, o.weekPills, (weekPills) =>
            p({ weekPills }),
          )}
          {toggle(t.todayOptExercises, t.todayOptExercisesSub, o.exercises, (exercises) =>
            p({ exercises }),
          )}
          {toggle(t.todayOptGymStep, t.todayOptGymStepSub, o.gymStep, (gymStep) => p({ gymStep }))}
          {toggle(t.todayOptLogPast, t.todayOptLogPastSub, o.logPast, (logPast) => p({ logPast }))}
        </GroupedList>
      </>
    );
  } else if (id === 'atlas') {
    const o: AtlasOpts = coreOpts(draft, 'atlas');
    const a = (patch: Partial<AtlasOpts>) => set('atlas', patch);
    // Together is one stories strip: Atlas is a bubble there, so his view, the
    // clients view and the order don't apply. Without clients only Atlas's
    // view is left.
    const split = !hasClients || o.layout === 'split';
    body = (
      <>
        {hasClients && (
          <>
            <div className="tdc-sheet-lab">{t.todayOptLayout}</div>
            <OptionCardGrid label={t.todayOptLayout}>
              {(['together', 'split'] as AtlasLayout[]).map((v) => (
                <OptionCard
                  key={v}
                  title={t.todayAtlasLayout[v]}
                  sub={t.todayAtlasLayoutSub[v]}
                  preview={<LayoutSketch v={v} />}
                  selected={o.layout === v}
                  onSelect={() => a({ layout: v })}
                />
              ))}
            </OptionCardGrid>
          </>
        )}
        {split && (
          <>
            <div className="tdc-sheet-lab">{t.todayOptAtlasView}</div>
            <OptionCardGrid label={t.todayOptAtlasView}>
              {(['note', 'chat', 'compact', 'auto'] as AtlasView[]).map((v) => (
                <OptionCard
                  key={v}
                  title={t.todayAtlasView[v]}
                  sub={t.todayAtlasViewSub[v]}
                  preview={<ViewSketch v={v} hidden={t.todayAtlasSketchHidden} />}
                  selected={o.atlasView === v}
                  onSelect={() => a({ atlasView: v })}
                />
              ))}
            </OptionCardGrid>
          </>
        )}
        {hasClients && split && (
          <>
            <div className="tdc-sheet-lab">{t.todayOptClientsView}</div>
            <Segmented
              label={t.todayOptClientsView}
              value={o.clientsView}
              onChange={(clientsView) => a({ clientsView })}
              options={(['stories', 'list'] as const).map((v) => ({
                value: v,
                label: t.todayClientsView[v],
              }))}
            />
          </>
        )}
        {hasClients && (
          <>
            <div className="tdc-cfg-gap" />
            <GroupedList surface="raised">
              {split && (
                <ListRow
                  label={t.todayOptOrder}
                  sub={t.todayOptOrderSub}
                  trailing={
                    <Segmented
                      className="tdc-cfg-order"
                      size="sm"
                      label={t.todayOptOrder}
                      value={o.order}
                      onChange={(order) => a({ order })}
                      options={(['atlas', 'clients'] as const).map((v) => ({
                        value: v,
                        label: t.todayOrder[v],
                        compact: true,
                      }))}
                    />
                  }
                />
              )}
              {toggle(
                t.todayOptLiveFirst,
                // Split stories lead with a "Live now" card; the strip and the
                // list put live clients first.
                split && o.clientsView === 'stories'
                  ? t.todayOptLiveFirstCardSub
                  : t.todayOptLiveFirstSub,
                o.liveFirst,
                (liveFirst) => a({ liveFirst }),
              )}
              {toggle(
                t.todayOptHideInactive,
                t.todayOptHideInactiveSub,
                o.hideInactive,
                (hideInactive) => a({ hideInactive }),
              )}
            </GroupedList>
          </>
        )}
      </>
    );
  } else if (id === 'nudges') {
    const off = coreOpts(draft, 'nudges').off;
    body = (
      <>
        <div className="tdc-sheet-lab">{t.todayOptNudges}</div>
        <GroupedList surface="raised">
          {NUDGE_KINDS.map((k) => (
            <ListRow
              key={k}
              as="label"
              label={t.todayNudgeKind[k]}
              trailing={
                <Switch
                  checked={!off.includes(k)}
                  aria-label={t.todayNudgeKind[k]}
                  onChange={(on) =>
                    set('nudges', { off: on ? off.filter((x) => x !== k) : [...off, k] })
                  }
                />
              }
            />
          ))}
        </GroupedList>
      </>
    );
  } else {
    const o = coreOpts(draft, 'history');
    body = (
      <>
        {preview != null && (
          <div className="tdc-preview tdc-cfg-preview" aria-hidden="true">
            {preview}
          </div>
        )}
        <div className="tdc-sheet-lab">{t.todayOptDays}</div>
        <Segmented
          label={t.todayOptDays}
          value={o.days}
          onChange={(days) => set('history', { days })}
          options={HISTORY_DAYS.map((d) => ({ value: d, label: String(d) }))}
        />
      </>
    );
  }

  return (
    <Sheet onClose={onClose} className="tdc-picker tdc-cfg">
      <div className="tdc-sheet-title">{t.todayCore[id]}</div>
      <div className="tdc-sheet-sub tdc-cfg-lock">
        <Icon name="lock-simple" /> {t.todayCoreLocked}
      </div>
      {body}
      <div className="tdc-pick-foot tdc-cfg-foot">
        <Button variant="secondary" onClick={() => onChange(setCoreOpts(draft, id, null))}>
          {t.todayResetBlock}
        </Button>
        <Button variant="primary" fullWidth onClick={onClose}>
          {t.todayEditDone}
        </Button>
      </div>
    </Sheet>
  );
}

/* Mini sketches for the option cards (design A2) — each mirrors what the
   choice renders on Today. */

function LayoutSketch({ v }: { v: AtlasLayout }) {
  if (v === 'together')
    // Atlas | a client with news (brass), one training now (green), quiet ones.
    return (
      <span className="tdc-sk">
        <i className="sk-face" />
        <i className="sk-split" />
        <i className="sk-ring" />
        <i className="sk-ring is-ok" />
        <i className="sk-ring is-dim" />
        <i className="sk-ring is-dim" />
      </span>
    );
  // Atlas's band on top, the clients' row under a hairline.
  return (
    <span className="tdc-sk is-col">
      <span className="tdc-sk">
        <i className="sk-face is-sm" />
        <i className="sk-line is-atlas" />
      </span>
      <span className="tdc-sk is-under">
        <i className="sk-ring is-sm is-ok" />
        <i className="sk-ring is-sm" />
        <i className="sk-ring is-sm is-dim" />
        <i className="sk-ring is-sm is-dim" />
      </span>
    </span>
  );
}

function ViewSketch({ v, hidden }: { v: AtlasView; hidden: string }) {
  switch (v) {
    case 'note':
      return (
        <span className="tdc-sk is-top is-grow">
          <i className="sk-face" />
          <span className="tdc-sk is-col is-grow">
            <i className="sk-line is-coral is-short" />
            <i className="sk-line" />
            <i className="sk-line is-short" />
          </span>
        </span>
      );
    case 'chat':
      return (
        <span className="tdc-sk is-col is-grow">
          <i className="sk-bubble" />
          <span className="tdc-sk">
            <i className="sk-pill" />
            <i className="sk-pill is-md" />
            <i className="sk-pill is-sm" />
          </span>
        </span>
      );
    case 'compact':
      return (
        <span className="tdc-sk is-grow">
          <i className="sk-face is-sm" />
          <i className="sk-line" />
          <i className="sk-dot" />
        </span>
      );
    case 'auto':
      return <span className="sk-ghost">{hidden}</span>;
  }
}
