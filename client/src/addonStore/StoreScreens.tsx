/** Store screens on the store kit: Discover, Apps, Add-ons, Selected, Installed, item page, search. */
import { useMemo, useState } from 'react';
import type { Role } from '../api';
import { ADDONS, addonById, type AddonManifest } from '../addons/manifest';
import { installQueue, queueRemove } from '../addons/queue';
import {
  SkBadge,
  SkBtn,
  SkCard,
  SkChip,
  SkEmpty,
  SkIcon,
  SkList,
  SkSectionHeader,
  SkSectionLink,
  SkTile,
} from '../store-kit';
import './screens.css';
import { DiscoverBento } from './DiscoverBento';
import { recommend } from './recommend';
import { MIN_QUERY, searchItems } from './search';
import { availableForRole, comingSoonForRole, STORE_CATEGORIES } from './storeCatalog';
import {
  ItemAction,
  ItemRow,
  itemDesc,
  itemName,
  kindBadge,
  RemoveButton,
  TileOf,
  relOf,
  type StoreCtx,
} from './storeItems';

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="sk-mt24">
      <SkSectionHeader title={title} aside={aside} />
      {children}
    </section>
  );
}

function Rows({ ids, ctx, query }: { ids: string[]; ctx: StoreCtx; query?: string }) {
  const items = ids.map((id) => addonById(id)).filter((m): m is AddonManifest => !!m);
  if (!items.length) return null;
  return (
    <SkList>
      {items.map((m) => (
        <ItemRow key={m.id} m={m} ctx={ctx} query={query} />
      ))}
    </SkList>
  );
}

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
  const total = availableForRole(role).length;
  const done = total > 0 && rec.length === 0;
  return (
    <>
      <DiscoverBento role={role} ctx={ctx} go={go} />
      {!done && (
        <Section
          title={st.recommended}
          aside={<SkSectionLink onClick={() => go('apps')}>{st.seeAll}</SkSectionLink>}
        >
          <Rows ids={rec.slice(0, 4)} ctx={ctx} />
        </Section>
      )}
      {done && (
        <Section title={st.yourSpotter}>
          <SkCard className="sk-p20">
            <div className="sk-t-h3">{st.allTurnedOn}</div>
          </SkCard>
        </Section>
      )}
    </>
  );
}

/** Apps, filtered by category chips; coming-soon apps close the list. */
export function Apps({ role, ctx }: { role: Role; ctx: StoreCtx }) {
  const { st } = ctx;
  const [cat, setCat] = useState<AddonManifest['category'] | 'all'>('all');
  const apps = availableForRole(role).filter((m) => m.kind === 'app');
  const cats = STORE_CATEGORIES.filter((c) => apps.some((m) => m.category === c));
  const label = (c: string) => st[`cat${c[0].toUpperCase()}${c.slice(1)}` as 'catRecovery'];
  const shown = apps.filter((m) => cat === 'all' || m.category === cat);
  const soon = comingSoonForRole(role);
  return (
    <>
      <div className="sk-rowf sk-g8 sk-wrap sk-mt12">
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
  const parents = [...new Set(addons.map((m) => m.parent as string))];
  return (
    <>
      <div className="sk-t-s sk-mt4">{st.addonsSub}</div>
      <div className="as-cols">
        {parents.map((p) => {
          const pm = addonById(p);
          return (
            <section key={p} className="sk-mt24">
              <div className="sk-rowf sk-g8 sk-mb8">
                {pm && <TileOf st={st} m={pm} size={32} />}
                <h2 className="sk-t-h2">{st.forApp(itemName(st, p))}</h2>
              </div>
              <Rows ids={addons.filter((m) => m.parent === p).map((m) => m.id)} ctx={ctx} />
            </section>
          );
        })}
      </div>
    </>
  );
}

/** Selected: what was added but not installed yet. */
export function Selected({ ctx, go }: { ctx: StoreCtx; go: (v: string) => void }) {
  const { st, queued } = ctx;
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
          {items.map((m) => (
            <ItemRow
              key={m.id}
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
          ))}
        </SkList>
      </div>
      <div className="sk-mt24">
        <SkBtn
          kind="pri"
          size="l"
          onClick={() => {
            installQueue();
            go('installed');
          }}
        >
          {st.installN(items.length)}
        </SkBtn>
      </div>
    </>
  );
}

/** Installed: what is on, with Remove. Removing keeps data. */
export function Installed({ ctx, go }: { ctx: StoreCtx; go: (v: string) => void }) {
  const { st, enabled } = ctx;
  const items = ADDONS.filter((m) => enabled.has(m.id));
  if (!items.length) {
    return (
      <SkEmpty
        icon={
          <SkTile letter="" tone={5} size={64}>
            <SkIcon name="inst" />
          </SkTile>
        }
        title={st.installedEmptyTitle}
        body={st.installedEmptyBody}
        actions={
          <SkBtn kind="pri" onClick={() => go('discover')}>
            {st.tabDiscover}
          </SkBtn>
        }
      />
    );
  }
  return (
    <div className="sk-mt16">
      <SkList>
        {items.map((m) => (
          <ItemRow key={m.id} m={m} ctx={ctx} action={<RemoveButton id={m.id} st={st} />} />
        ))}
      </SkList>
    </div>
  );
}

/** One item: what it is, what it needs, the action. */
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
  return (
    <>
      <div className="sk-rowf sk-g16 sk-start sk-mt16">
        <TileOf st={st} m={m} size={96} />
        <div className="sk-f1">
          <div>{kindBadge(st, m)}</div>
          <h1 className="sk-t-h1 sk-mt4">{itemName(st, m.id)}</h1>
          {parent && <div className="sk-t-s sk-mt4">{st.forApp(itemName(st, parent.id))}</div>}
          <div className="sk-mt16">
            <ItemAction m={m} ctx={ctx} size="l" />
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
      <Section title={st.about}>
        <p className="sk-t-b sk-mute">{itemDesc(st, m.id)}</p>
      </Section>
    </>
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
  const suggestions = ['health', 'sleep', 'atlas', 'themes'].filter((id) => addonById(id));
  const apps = ids.filter((id) => addonById(id)?.kind === 'app');
  const adds = ids.filter((id) => addonById(id)?.kind === 'addon');
  return (
    <>
      {short ? (
        <SkEmpty icon={<SkIcon name="search" />} body={st.searchHint}>
          <div className="sk-t-e sk-mt16">{st.tryFor}</div>
          <div className="sk-rowf sk-g8 sk-wrap sk-cen sk-mt12">
            {suggestions.map((id) => (
              <SkChip key={id} onClick={() => setQuery(itemName(st, id))}>
                {itemName(st, id)}
              </SkChip>
            ))}
          </div>
        </SkEmpty>
      ) : ids.length === 0 ? (
        <SkEmpty
          icon={
            <SkTile letter="" tone={5} size={64}>
              <SkIcon name="search" />
            </SkTile>
          }
          title={st.noResultsFor(query.trim())}
          body={st.noResultsHint}
        />
      ) : (
        <>
          <div className="sk-t-s sk-mt16" aria-live="polite">
            {st.resultsCount(ids.length)}
          </div>
          <div className="as-cols">
            {apps.length > 0 && (
              <Section title={st.appsTitle}>
                <Rows ids={apps} ctx={ctx} query={query.trim()} />
              </Section>
            )}
            {adds.length > 0 && (
              <Section title={st.addonsTitle}>
                <Rows ids={adds} ctx={ctx} query={query.trim()} />
              </Section>
            )}
          </div>
        </>
      )}
    </>
  );
}
