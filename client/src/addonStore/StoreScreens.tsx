/** Store screens on the store kit: Discover, Apps, Add-ons, Selected, Installed, item page, search. */
import { useMemo, useState } from 'react';
import type { Role } from '../api';
import { ADDONS, addonById, type AddonManifest } from '../addons/manifest';
import { startInstall } from '../addons/installRun';
import { queueRemove, setModulePick, useModulePicks } from '../addons/queue';
import {
  SkBadge,
  SkBtn,
  SkChip,
  SkEmpty,
  SkHero,
  SkIcon,
  SkList,
  SkRow,
  SkSectionLink,
  SkSwitch,
  SkTile,
} from '../store-kit';
import './screens.css';
import { Rows, Section } from './storeLists';
import { DiscoverBento } from './DiscoverBento';
import { recommend } from './recommend';
import { MIN_QUERY, searchItems } from './search';
import {
  addonCategories,
  catalogProgress,
  heroMode,
  heroState,
  type HeroMode,
} from './discoverPicks';
import {
  availableForRole,
  comingSoonForRole,
  STORE_CATEGORIES,
  themesForRole,
} from './storeCatalog';
import { currentHash, setHash } from '../route';
import { catLabel } from './storeCategories';
import { storeHash } from './storeRoute';
import { ItemRow, itemDesc, itemName, TileOf, type StoreCtx } from './storeItems';

/** Discover: the recommendation queue, a nudge for the next app, what is coming. */
export function Discover({
  role,
  ctx,
  go,
}: {
  role: Role;
  ctx: StoreCtx;
  go: (v: string) => void;
}) {
  const { st, enabled, queued } = ctx;
  // Picking an item must not make it vanish: the list is built as if nothing were picked (stable order, a picked item
  // keeps its place and shows "Selected ✓"); add-ons that only appear because of a pick are appended.
  const rec = useMemo(() => {
    const stable = recommend(role, enabled, []);
    return [...stable, ...recommend(role, enabled, queued).filter((id) => !stable.includes(id))];
  }, [role, enabled, queued]);
  const prog = catalogProgress(role, enabled);
  const [mode, setMode] = useState<HeroMode>(() => heroMode('bento', prog));
  const nextMode = heroMode(mode, prog);
  if (nextMode !== mode) setMode(nextMode);
  const soonItems = comingSoonForRole(role);
  const themeIds = themesForRole(role).map((m) => m.id);
  return (
    <>
      {nextMode === 'progress' ? (
        <SkHero
          state={heroState(prog.left)}
          eyebrow={st.yourSpotter}
          done={prog.done}
          total={prog.total}
          badge={prog.left === 0 ? <SkBadge kind="ok">{st.heroComplete}</SkBadge> : undefined}
          title={prog.left === 0 ? st.allAdded : st.leftToComplete(prog.left)}
          body={prog.left === 0 ? st.nothingElse : st.finishSetup}
          progressLabel={st.yourSpotter}
        />
      ) : (
        <DiscoverBento role={role} ctx={ctx} go={go} />
      )}
      {rec.length > 0 && (
        <section className="sk-mt24">
          <SkList>
            <div className="as-rec-head">
              <h2 className="sk-t-h2">{st.recommended}</h2>
              <SkSectionLink onClick={() => go('apps')}>{st.seeAll}</SkSectionLink>
            </div>
            <Rows ids={rec.slice(0, 4)} ctx={ctx} bare />
          </SkList>
        </section>
      )}
      {/* The Themes tile lives in the bento; the list stays only under the progress hero, which has no bento. */}
      {nextMode === 'progress' && themeIds.length > 0 && (
        <section className="sk-mt24">
          <SkList>
            <div className="as-rec-head">
              <h2 className="sk-t-h2">{st.discoverThemes}</h2>
              <SkSectionLink onClick={() => go('themes')}>{st.seeAll}</SkSectionLink>
            </div>
            <Rows ids={themeIds.slice(0, 4)} ctx={ctx} bare />
          </SkList>
        </section>
      )}
      {nextMode === 'progress' && soonItems.length > 0 && (
        <Section title={st.comingSoon}>
          <Rows ids={soonItems.map((m) => m.id)} ctx={ctx} />
        </Section>
      )}
    </>
  );
}

/** `#/store/apps?cat=recovery` opens Apps with that category on. */
function catFromHash(): AddonManifest['category'] | 'all' {
  const v = new URLSearchParams(currentHash().split('?')[1] ?? '').get('cat');
  return (STORE_CATEGORIES as readonly string[]).includes(v ?? '')
    ? (v as AddonManifest['category'])
    : 'all';
}

/** Apps, filtered by category chips; coming-soon apps close the list. */
export function Apps({ role, ctx }: { role: Role; ctx: StoreCtx }) {
  const { st } = ctx;
  const [cat, setCat] = useState<AddonManifest['category'] | 'all'>(catFromHash);
  const apps = availableForRole(role).filter((m) => m.kind === 'app');
  const cats = STORE_CATEGORIES.filter((c) => apps.some((m) => m.category === c));
  const label = (c: string) => catLabel(st, c);
  const shown = apps.filter((m) => cat === 'all' || m.category === cat);
  const soon = comingSoonForRole(role);
  return (
    <>
      <div className="sk-rowf sk-g8 sk-wrap">
        <SkChip on={cat === 'all'} onClick={() => setCat('all')}>
          {st.catAll}
        </SkChip>
        {cats.map((c) => (
          <SkChip key={c} on={cat === c} onClick={() => setCat(c)}>
            {label(c)}
          </SkChip>
        ))}
      </div>
      <div className="sk-mt16">
        <Rows ids={shown.map((m) => m.id)} ctx={ctx} />
      </div>
      {cat === 'all' && soon.length > 0 && (
        <Section title={st.comingSoon}>
          <Rows ids={soon.map((m) => m.id)} ctx={ctx} />
        </Section>
      )}
    </>
  );
}

/** Add-ons grouped by the app they belong to. */
export function Addons({ role, ctx }: { role: Role; ctx: StoreCtx }) {
  const { st } = ctx;
  const addons = availableForRole(role).filter((m) => m.kind === 'addon');
  // Add-ons of an app are grouped under it; those that need no app (Sleep, Atlas…) come first, with no heading.
  const [cat, setCat] = useState<AddonManifest['category'] | 'all'>(catFromHash);
  // Category chips only exist for categories that really hold an add-on, and only when there is a choice to make.
  const cats = addonCategories(role);
  const shown = addons.filter((m) => cat === 'all' || m.category === cat);
  const standalone = shown.filter((m) => !m.parent);
  const parents = [...new Set(shown.flatMap((m) => (m.parent ? [m.parent] : [])))];
  if (!parents.length && !standalone.length) {
    return (
      <SkEmpty
        icon={
          <SkTile letter="" tone={5} size={64}>
            <SkIcon name="addons" />
          </SkTile>
        }
        title={st.addonsEmptyTitle}
        body={st.addonsEmptyBody}
      />
    );
  }
  return (
    <>
      {cats.length > 1 && (
        <div className="sk-rowf sk-g8 sk-wrap">
          <SkChip on={cat === 'all'} onClick={() => setCat('all')}>
            {st.catAll}
          </SkChip>
          {cats.map((c) => (
            <SkChip key={c} on={cat === c} onClick={() => setCat(c)}>
              {catLabel(st, c)}
            </SkChip>
          ))}
        </div>
      )}
      <div className="as-cols">
        {standalone.length > 0 && (
          <section className="sk-mt24">
            <Rows ids={standalone.map((m) => m.id)} ctx={ctx} />
          </section>
        )}
        {parents.map((p) => {
          const pm = addonById(p);
          return (
            <section key={p} className="sk-mt24">
              <div className="sk-rowf sk-g8 sk-mb8">
                {pm && <TileOf st={st} m={pm} size={32} />}
                <h2 className="sk-t-h2">{st.forApp(itemName(st, p))}</h2>
              </div>
              <Rows ids={shown.filter((m) => m.parent === p).map((m) => m.id)} ctx={ctx} />
            </section>
          );
        })}
      </div>
    </>
  );
}

/** Themes: every installable look, one by one. */
export function Themes({ role, ctx }: { role: Role; ctx: StoreCtx }) {
  const { st } = ctx;
  const ids = themesForRole(role).map((m) => m.id);
  if (!ids.length) {
    return (
      <SkEmpty
        icon={
          <SkTile letter="" tone={7} size={64}>
            <SkIcon name="brush" />
          </SkTile>
        }
        title={st.themesEmptyTitle}
        body={st.themesEmptyBody}
      />
    );
  }
  return (
    <div className="sk-mt16">
      <Rows ids={ids} ctx={ctx} />
    </div>
  );
}

/** Selected: what was added but not installed yet. */
export function Selected({ ctx, go }: { ctx: StoreCtx; go: (v: string) => void }) {
  const { st, queued } = ctx;
  const picked = useModulePicks();
  if (!queued.length) {
    return (
      <SkEmpty
        icon={
          <SkTile letter="" tone={5} size={64}>
            <SkIcon name="queue" />
          </SkTile>
        }
        title={st.selectedEmptyTitle}
        body={st.selectedEmptyBody}
        actions={
          <>
            <SkBtn kind="pri" onClick={() => go('apps')}>
              {st.browseApps}
            </SkBtn>
            <SkBtn kind="ghost" onClick={() => go('addons')}>
              {st.browseAddons}
            </SkBtn>
          </>
        }
      />
    );
  }
  const items = queued.map((id) => addonById(id)).filter((m): m is AddonManifest => !!m);
  const required = (id: string) => queued.some((q) => addonById(q)?.parent === id);
  return (
    <>
      <div className="sk-t-s sk-mt4">{st.selectedSub}</div>
      <div className="sk-mt16">
        <SkList>
          {items.map((m) => {
            // Modules start off: only the ones ticked here are switched on with the item.
            const kids = ADDONS.filter((a) => a.kind === 'module' && a.parent === m.id && !a.soon);
            return (
              <div key={m.id}>
                <ItemRow
                  m={m}
                  ctx={ctx}
                  action={
                    required(m.id) ? (
                      <SkBtn kind="ghost" disabled>
                        {st.required}
                      </SkBtn>
                    ) : (
                      <SkBtn kind="ghost" onClick={() => queueRemove([m.id])}>
                        {st.remove}
                      </SkBtn>
                    )
                  }
                />
                {kids.length > 0 && <div className="sk-t-s sk-mt8">{st.modulesPick}</div>}
                {kids.map((k) => (
                  <SkRow
                    key={k.id}
                    tile={<TileOf st={st} m={k} size={40} />}
                    name={itemName(st, k.id)}
                    desc={itemDesc(st, k.id)}
                    action={
                      <SkSwitch
                        on={picked.includes(k.id)}
                        label={itemName(st, k.id)}
                        onChange={(next) => setModulePick(k.id, next)}
                      />
                    }
                  />
                ))}
              </div>
            );
          })}
        </SkList>
      </div>
      <div className="as-sticky-act">
        <SkBtn
          kind="pri"
          size="l"
          onClick={() => {
            void startInstall();
            go('installing');
          }}
        >
          {st.installN(items.length)}
        </SkBtn>
      </div>
    </>
  );
}

function Group({
  label,
  ids,
  ctx,
  query,
}: {
  label: string;
  ids: string[];
  ctx: StoreCtx;
  query: string;
}) {
  return (
    <section className="sk-mt24">
      <div className="sk-t-e sk-mb8">{label}</div>
      <Rows ids={ids} ctx={ctx} query={query} />
    </section>
  );
}

/** Live search: starts at 3 characters, highlights what matched. */
export function Search({
  role,
  ctx,
  query,
  setQuery,
}: {
  role: Role;
  ctx: StoreCtx;
  query: string;
  setQuery: (q: string) => void;
}) {
  const { st } = ctx;
  const ids = useMemo(() => searchItems(role, query, st), [role, query, st]);
  const short = query.trim().length < MIN_QUERY;
  const suggestions = ['sleep', 'injury-log', 'theme-cyberpunk', 'atlas'].filter((id) =>
    addonById(id),
  );
  const categories = STORE_CATEGORIES.filter((cat) =>
    availableForRole(role).some((m) => m.kind === 'app' && m.category === cat),
  );
  const best = ids[0];
  const bestM = best ? addonById(best) : undefined;
  const rest = ids.slice(1);
  const ofBest = bestM?.kind === 'app' ? rest.filter((id) => addonById(id)?.parent === best) : [];
  const others = rest.filter((id) => !ofBest.includes(id));
  const q = query.trim();
  return (
    <>
      {short ? (
        <>
          <div className="as-hint sk-t-s" role="status">
            <SkIcon name="search" small />
            {st.searchHint}
          </div>
          <div className="sk-t-e sk-mt24">{st.tryFor}</div>
          <div className="sk-rowf sk-g8 sk-wrap sk-mt12">
            {suggestions.map((id) => (
              <SkChip key={id} onClick={() => setQuery(itemName(st, id))}>
                {itemName(st, id)}
              </SkChip>
            ))}
          </div>
        </>
      ) : ids.length === 0 ? (
        <SkEmpty
          icon={
            <SkTile letter="" tone={5} size={64}>
              <SkIcon name="search" />
            </SkTile>
          }
          title={st.noResultsFor(query.trim())}
          body={st.noResultsHint}
        >
          <div className="sk-t-e sk-mt24">{st.tryFor}</div>
          <div className="sk-rowf sk-g8 sk-wrap sk-cen sk-mt12">
            {suggestions.map((id) => (
              <SkChip key={id} onClick={() => setQuery(itemName(st, id))}>
                {itemName(st, id)}
              </SkChip>
            ))}
          </div>
          <div className="sk-t-e sk-mt24">{st.browseCats}</div>
          <div className="sk-rowf sk-g8 sk-wrap sk-cen sk-mt12">
            {categories.map((cat) => (
              <SkChip key={cat} onClick={() => setHash(`${storeHash('apps')}?cat=${cat}`)}>
                {catLabel(st, cat)}
              </SkChip>
            ))}
          </div>
        </SkEmpty>
      ) : (
        <>
          <div className="sk-t-s sk-mt16" aria-live="polite">
            {st.resultsCount(ids.length)}
          </div>
          <div className="as-cols">
            <Group label={st.searchBest} ids={[best]} ctx={ctx} query={q} />
            {ofBest.length > 0 && (
              <Group
                label={st.searchAddonsFor(itemName(st, best))}
                ids={ofBest}
                ctx={ctx}
                query={q}
              />
            )}
            {others.length > 0 && (
              <Group label={st.searchAlso(q)} ids={others} ctx={ctx} query={q} />
            )}
          </div>
        </>
      )}
    </>
  );
}
