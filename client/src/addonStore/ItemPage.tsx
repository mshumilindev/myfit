/** One item (boards 05, 06): hero, what it needs, preview, facts, about, its add-ons. */
import { ADDONS, addonById } from '../addons/manifest';
import {
  SkBadge,
  SkCard,
  SkIcon,
  SkNote,
  SkPreviewPhone,
  SkPvBox,
  SkPvDot,
  SkPvLines,
  SkSectionLink,
  SkStat,
  type SkIconName,
} from '../store-kit';
import './screens.css';
import { Rows, Section } from './storeLists';
import { itemDesc, itemName, kindBadge, relOf, TileOf, type StoreCtx } from './storeItems';

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
  const m = addonById(id);
  if (!m) return <div className="sk-t-s sk-mt16">{st.noResults}</div>;
  const parent = m.parent ? addonById(m.parent) : undefined;
  const children = m.kind === 'app' ? ADDONS.filter((a) => a.parent === m.id && !a.soon) : [];
  const name = itemName(st, m.id);
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
        </div>
      </div>
      {parent && (
        <SkCard className="sk-p12 sk-mt16 sk-rowf sk-g12">
          <TileOf st={st} m={parent} size={40} />
          <div className="sk-f1">
            <div className="sk-t-b sk-b6">{relOf(m, ctx)}</div>
          </div>
          <SkSectionLink onClick={() => go('item', parent.id)}>
            <SkBadge kind="app">{st.kindApp}</SkBadge>
          </SkSectionLink>
        </SkCard>
      )}
      <div className="sk-t-e sk-mt24">{st.preview}</div>
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
      <SkCard className="sk-p16 sk-mt24 as-stats">
        {m.kind === 'app' && <SkStat spec value={children.length} caption={st.statAddons} />}
        <SkStat spec value={st.yes} caption={st.statOffline} />
        <SkStat spec value={st.kept} caption={st.statData} />
      </SkCard>
      <Section title={st.about}>
        <p className="sk-t-b sk-mute">{itemDesc(st, m.id)}</p>
      </Section>
      {children.length > 0 && (
        <Section title={st.addonsForApp(name)}>
          <Rows ids={children.map((a) => a.id)} ctx={ctx} />
        </Section>
      )}
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
      <SkNote icon="shield" className="sk-mt16">
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
