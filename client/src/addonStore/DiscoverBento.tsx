/** The Discover bento (design 01): App of the week, Installed, Starter pack, Suggested, Coming soon, Browse. */
import { useState, type ReactElement } from 'react';
import type { Role } from '../api';
import { useT } from '../i18n';
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
import { WeekTile } from './WeekHero';
import { catLabel } from './storeCategories';
import { iconUrl, ItemAction, itemName, kindBadge, relOf, type StoreCtx } from './storeItems';

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
  const { t } = useT();
  const state = { role, enabled, queued };
  const [mountedAt] = useState(() => Date.now());
  const week = appOfTheWeek(state, mountedAt);
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
        title={pack.id === 'recovery' ? st.packRecovery : t.onbPack_coach}
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
  if (soon.length)
    small.push((span) => (
      <SkBentoTile
        key="soon"
        span={span}
        eyebrow={st.comingSoon}
        title={soon.map((m) => itemName(st, m.id)).join(', ')}
        titleSize="h3"
        body={st.soonBody}
        footer={<SkBadge kind="soon">{st.soon}</SkBadge>}
      />
    ));
  return (
    <SkBento cols={12}>
      {week && <WeekTile m={week} ctx={ctx} now={mountedAt} span={2} />}
      {small.map((tile, i) =>
        tile(i === small.length - 1 && small.length % 2 === 1 ? 2 : undefined),
      )}
      {sug && (
        <SkBentoTile size="wide" span={2} eyebrow={st.suggestedFor(itemName(st, sug.parent.id))}>
          <div className="sk-rowf sk-g12 sk-mt12">
            <SkTile
              letter={itemName(st, sug.item.id)}
              tone={sug.item.tone}
              size={40}
              image={iconUrl(sug.item.id)}
            />
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
