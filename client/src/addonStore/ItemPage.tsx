/** One item (boards 05, 06): hero, what it needs, preview, facts, about, its add-ons. */
import { useState } from 'react';
import { APP_BREAKPOINT, useMinWidth } from '../components/ui/breakpoints';
import { addonById, itemsOfApp } from '../addons/manifest';
import { disableAddons, enableAddons } from '../addons/enabledSet';
import { formatSize, useAddonSizes } from '../addons/useAddonSizes';
import { installPack, usePackState } from '../addons/packs';
import {
  SkBadge,
  SkCard,
  SkIcon,
  SkNote,
  SkPreviewPhone,
  SkPvBox,
  SkPvDot,
  SkPvLines,
  SkRow,
  SkSectionLink,
  SkStat,
  SkSwitch,
  type SkIconName,
} from '../store-kit';
import './screens.css';
import { Rows, Section } from './storeLists';
import { RemoveButton } from './RemoveSheet';
import { AboutText } from './AboutText';
import { ModuleDrawer } from './ModuleDrawer';
import { PreviewViewer } from './PreviewViewer';
import { MODULE_SHOTS, previewUrl, WEEK_SHOTS } from './weekPreviews';
import {
  ItemAction,
  itemDesc,
  itemName,
  kindBadge,
  relOf,
  TileOf,
  type StoreCtx,
} from './storeItems';

export function ItemPage({
  id,
  ctx,
  go,
}: {
  id: string;
  ctx: StoreCtx;
  go: (v: string, id?: string) => void;
}) {
  const { st } = ctx;
  const sizes = useAddonSizes(); // a hook: before the early returns
  const pack = usePackState(id);
  const [modId, setModId] = useState<string | null>(null);
  const [view, setView] = useState<number | null>(null);
  const wide = useMinWidth(APP_BREAKPOINT);
  const m = addonById(id);
  if (!m) return <div className="sk-t-s">{st.noResults}</div>;
  const parent = m.parent ? addonById(m.parent) : undefined;
  const children = itemsOfApp(m.id).filter((a) => !a.soon && a.kind !== 'module');
  const modules = itemsOfApp(m.id).filter((a) => a.kind === 'module');
  // Real size from the last build; an app is the whole of it, and an item whose code is its parent's has none of its own.
  const sizeBytes = sizes?.[m.id] ?? null;
  const name = itemName(st, m.id);
  const shots = WEEK_SHOTS[m.id] ?? MODULE_SHOTS[m.id] ?? [];
  if (m.soon) return <ComingSoon id={m.id} ctx={ctx} />;
  return (
    <>
      <div className="sk-rowf sk-g16 sk-start as-item-head">
        <TileOf st={st} m={m} size={96} />
        <div className="sk-f1">
          <div>{kindBadge(st, m)}</div>
          <h1 className="sk-t-h1 sk-mt4">{name}</h1>
          <div className="sk-t-s sk-mt4">
            {parent ? st.forApp(itemName(st, parent.id)) : itemDesc(st, m.id)}
          </div>
          {/* Board 05, desktop: the action sits in the hero (the bottom bar is the phone's). */}
          <div className="as-item-act sk-rowf sk-g8 sk-mt12">
            <ItemAction m={m} ctx={ctx} lead />
            {ctx.enabled.has(m.id) && <RemoveButton id={m.id} ctx={ctx} />}
          </div>
        </div>
      </div>
      {parent && (
        <SkCard className="sk-p12 sk-rowf sk-g12">
          <TileOf st={st} m={parent} size={40} />
          <div className="sk-f1">
            <div className="sk-t-b sk-b6">{relOf(m, ctx)}</div>
          </div>
          <SkSectionLink onClick={() => go('item', parent.id)}>
            <SkBadge kind="app">{st.kindApp}</SkBadge>
          </SkSectionLink>
        </SkCard>
      )}
      <div className="as-item-grid">
        <div className="as-item-main">
          <div className="as-o1">
            <div className="sk-t-e">{st.preview}</div>
            {shots.length > 0 ? (
              <div className="sk-rowf sk-g12 sk-mt12 as-previews">
                {shots.map((sh, i) => (
                  <button
                    key={sh}
                    type="button"
                    className="as-prev-th"
                    aria-label={st.previewN(i + 1, shots.length)}
                    onClick={() => setView(i)}
                  >
                    <img src={previewUrl(sh, wide ? 'd' : 'm')} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="sk-rowf sk-g12 sk-mt12 as-previews">
                <SkPreviewPhone caption={name}>
                  <SkPvBox tall="plot">
                    <SkPvDot />
                  </SkPvBox>
                  <SkPvBox>
                    <SkPvLines />
                  </SkPvBox>
                </SkPreviewPhone>
                <SkPreviewPhone caption={name}>
                  <SkPvBox tall="chart" />
                  <SkPvBox>
                    <SkPvLines />
                  </SkPvBox>
                </SkPreviewPhone>
              </div>
            )}
          </div>
          <div className="as-o3">
            <Section title={st.about}>
              <AboutText st={st} id={m.id} />
            </Section>
          </div>
        </div>
        <div className="as-item-aside">
          <div className="as-o2">
            {/* Same card on every item: counts where it has them and Size, each cell a fixed third of the width. */}
            {
              <SkCard className="sk-p16 as-stats">
                {(m.kind === 'app' || children.length > 0) && (
                  <SkStat spec value={children.length} caption={st.statAddons} />
                )}
                {(m.kind === 'app' || modules.length > 0) && (
                  <SkStat spec value={modules.length} caption={st.modules} />
                )}
                <SkStat
                  spec
                  value={sizeBytes != null ? formatSize(sizeBytes) : '—'}
                  caption={st.statSize}
                />
              </SkCard>
            }
            {ctx.enabled.has(m.id) && pack.status !== 'idle' && pack.status !== 'ready' && (
              <p className="as-pack-note" role="status">
                {pack.status === 'loading'
                  ? `${st.packLoading}${Math.round((pack.done / Math.max(1, pack.total)) * 100)}%`
                  : pack.status === 'paused'
                    ? st.packPaused
                    : st.packError}
                {pack.status !== 'loading' && (
                  <button
                    type="button"
                    className="as-pack-btn"
                    onClick={() => void installPack(m.id, true)}
                  >
                    {st.packNow}
                  </button>
                )}
              </p>
            )}
          </div>
          <div className="as-o4">
            {modules.length > 0 && (
              <Section title={st.modules}>
                <SkCard className="as-group">
                  {modules.map((k) => (
                    <SkRow
                      key={k.id}
                      tile={<TileOf st={st} m={k} size={40} />}
                      name={itemName(st, k.id)}
                      desc={itemDesc(st, k.id)}
                      onOpen={() => setModId(k.id)}
                      // an installed app: each module is a switch, on or off whenever the person likes (data stays)
                      action={
                        ctx.enabled.has(m.id) ? (
                          <SkSwitch
                            on={ctx.enabled.has(k.id)}
                            label={itemName(st, k.id)}
                            onChange={(next) =>
                              next ? enableAddons([k.id]) : disableAddons([k.id])
                            }
                          />
                        ) : undefined
                      }
                    />
                  ))}
                </SkCard>
              </Section>
            )}
          </div>
          <div className="as-o5">
            {children.length > 0 && (
              <Section title={st.addonsForApp(name)}>
                <Rows ids={children.map((a) => a.id)} ctx={ctx} />
              </Section>
            )}
          </div>
        </div>
      </div>
      {view != null && (
        <PreviewViewer
          shots={shots}
          start={view}
          title={name}
          ctx={ctx}
          onClose={() => setView(null)}
        />
      )}
      <ModuleDrawer id={modId} ctx={ctx} onClose={() => setModId(null)} />
    </>
  );
}

const PLAN_ICONS: Record<string, SkIconName[]> = { music: ['play', 'today'] };

/** An item that is not available yet (board 07): what it is, a note, and what is planned. */
function ComingSoon({ id, ctx }: { id: string; ctx: StoreCtx }) {
  const { st } = ctx;
  const m = addonById(id)!;
  const plan = (st.plans as Record<string, ReadonlyArray<{ name: string; desc: string }>>)[id];
  return (
    <>
      <div className="sk-rowf sk-g16 sk-start as-item-head">
        <TileOf st={st} m={m} size={96} />
        <div className="sk-f1">
          <div>{kindBadge(st, m)}</div>
          <h1 className="sk-t-h1 sk-mt4">{itemName(st, id)}</h1>
          <div className="sk-t-s sk-mt4">{itemDesc(st, id)}</div>
        </div>
      </div>
      <SkNote icon="shield">
        <b>{st.notAvailableLead}</b> {st.notAvailableRest}
      </SkNote>
      {plan && (
        <Section title={st.planned}>
          <div className="sk-col sk-g12">
            {plan.map((p, i) => (
              <div key={p.name} className="sk-rowf sk-g12 sk-start">
                <span className="as-plan-ic">
                  <SkIcon name={PLAN_ICONS[id]?.[i] ?? 'check'} />
                </span>
                <div className="sk-f1">
                  <div className="sk-t-b sk-b6">{p.name}</div>
                  <div className="sk-t-s">{p.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
