/** The Discover bento (design 01): App of the week, Installed, Starter pack, Suggested, Coming soon, Browse. */
import type { ReactElement } from 'react';
import type { Role } from '../api';
import { queueAdd, queueRemove } from '../addons/queue';
import {
  SkBadge,
  SkBento,
  SkBentoLink,
  SkBentoTile,
  SkBtn,
  SkIcon,
  SkRel,
  SkTile,
} from '../store-kit';
import { comingSoonForRole } from './storeCatalog';
import { addonCategories, appOfTheWeek, starterPack, suggestion } from './discoverPicks';
import { catLabel } from './storeCategories';
import { Rows } from './storeLists';
import { ItemAction, itemDesc, itemName, kindBadge, relOf, type StoreCtx } from './storeItems';

function PickButton({ ids, picked, ctx }: { ids: string[]; picked: boolean; ctx: StoreCtx }) {
  const { st } = ctx;
  return picked ? (
    <SkBtn kind="inv" onClick={() => queueRemove(ids)}>
      {st.pending}
    </SkBtn>
  ) : (
    <SkBtn kind="inv" onClick={() => queueAdd(ids)}>
      {ids.length > 1 ? st.addN(ids.length) : st.add}
    </SkBtn>
  );
}

export function DiscoverBento({
  role,
  ctx,
  go,
}: {
  role: Role;
  ctx: StoreCtx;
  go: (v: string) => void;
}) {
  const { st, enabled, queued } = ctx;
  const state = { role, enabled, queued };
  const week = appOfTheWeek(state);
  const pack = starterPack(state);
  const sug = suggestion(state);
  const cats = addonCategories(role);
  const soon = comingSoonForRole(role);
  // The small cells fill the grid two by two; with an odd count the last one stretches across both columns,
  // so the block never ends with a hole.
  const small: ((span?: 2) => ReactElement)[] = [
    (span) => (
      <SkBentoTile
        key="installed"
        span={span}
        eyebrow={st.tabInstalled}
        big={enabled.size}
        body={st.appsAndAddons}
        footer={
          <SkBentoLink onClick={() => go('installed')}>
            {st.seeAll} <SkIcon name="chev" small />
          </SkBentoLink>
        }
      />
    ),
  ];
  if (pack)
    small.push((span) => (
      <SkBentoTile
        key="pack"
        span={span}
        variant="accent"
        eyebrow={st.startPack}
        title={st.packRecovery}
        titleSize="h3"
        body={pack.ids.map((id) => itemName(st, id)).join(', ')}
        footer={
          <PickButton
            ids={pack.left}
            picked={pack.left.every((id) => queued.includes(id))}
            ctx={ctx}
          />
        }
      />
    ));
  small.push(
    (span) => (
      <SkBentoTile
        key="goal"
        span={span}
        tone={5}
        eyebrow={st.browse}
        title={st.byGoal}
        titleSize="h2"
        body={st.categoriesHint(cats.map((c) => catLabel(st, c)))}
        onClick={() => go('addons')}
        label={st.browse}
        footer={
          <SkBentoLink>
            {st.categoriesN(cats.length)} <SkIcon name="chev" small />
          </SkBentoLink>
        }
      />
    ),
    (span) => (
      <SkBentoTile
        key="themes"
        span={span}
        tone={6}
        eyebrow={st.tabThemes}
        title={st.themesTileTitle}
        titleSize="h2"
        body={st.themesTileBody}
        onClick={() => go('themes')}
        label={st.tabThemes}
        footer={
          <SkBentoLink>
            {st.seeAll} <SkIcon name="chev" small />
          </SkBentoLink>
        }
      />
    ),
  );
  return (
    <SkBento>
      {week && (
        <SkBentoTile
          tone={week.tone}
          size="hero"
          span={2}
          eyebrow={st.weekTitle}
          aside={<SkBadge kind="app">{st.kindApp}</SkBadge>}
          title={itemName(st, week.id)}
          titleSize="hero"
          onTitle={() => ctx.open(week.id)}
          body={itemDesc(st, week.id)}
          footer={<PickButton ids={[week.id]} picked={queued.includes(week.id)} ctx={ctx} />}
        />
      )}
      {small.map((tile, i) =>
        tile(i === small.length - 1 && small.length % 2 === 1 ? 2 : undefined),
      )}
      {soon.length > 0 && (
        <SkBentoTile size="wide" span={2} eyebrow={st.comingSoon}>
          {/* Not installable: the rows carry the Soon badge and no action. */}
          <Rows ids={soon.map((m) => m.id)} ctx={ctx} bare />
        </SkBentoTile>
      )}
      {sug && (
        <SkBentoTile size="wide" span={2} eyebrow={st.suggestedFor(itemName(st, sug.parent.id))}>
          <div className="sk-rowf sk-g12 sk-mt12">
            <SkTile letter={itemName(st, sug.item.id)} tone={sug.item.tone} size={40} />
            <div className="sk-f1">
              <div className="sk-rowf sk-g8">
                <button
                  type="button"
                  className="sk-t-h3 sk-btile-stretch"
                  onClick={() => ctx.open(sug.item.id)}
                >
                  {itemName(st, sug.item.id)}
                </button>
                {kindBadge(st, sug.item)}
              </div>
              <SkRel>{relOf(sug.item, ctx)}</SkRel>
            </div>
            <span className="sk-btile-actions">
              <ItemAction m={sug.item} ctx={ctx} />
            </span>
          </div>
        </SkBentoTile>
      )}
    </SkBento>
  );
}
