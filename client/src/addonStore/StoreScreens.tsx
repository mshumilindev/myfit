/** Store screens on the store kit: Discover, Apps, Add-ons, Selected, Installed, item page, search. */
import { useMemo, useState } from 'react';
import type { Role } from '../api';
import { addonById, type AddonManifest } from '../addons/manifest';
import { startInstall } from '../addons/installRun';
import { queueRemove } from '../addons/queue';
import {
  SkBtn,
  SkCard,
  SkChip,
  SkEmpty,
  SkIcon,
  SkList,
  SkSectionLink,
  SkTile,
} from '../store-kit';
import './screens.css';
import { Rows, Section } from './storeLists';
import { DiscoverBento } from './DiscoverBento';
import { recommend } from './recommend';
import { MIN_QUERY, searchItems } from './search';
import { availableForRole, comingSoonForRole, STORE_CATEGORIES } from './storeCatalog';
import { ItemRow, itemName, TileOf, type StoreCtx } from './storeItems';

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
  const parents = [...new Set(addons.map((m) => m.parent as string))];
  if (!parents.length) {
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
  const suggestions = ['health', 'sleep', 'atlas', 'themes'].filter((id) => addonById(id));
  const best = ids[0];
  const bestM = best ? addonById(best) : undefined;
  const rest = ids.slice(1);
  const ofBest = bestM?.kind === 'app' ? rest.filter((id) => addonById(id)?.parent === best) : [];
  const others = rest.filter((id) => !ofBest.includes(id));
  const q = query.trim();
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
