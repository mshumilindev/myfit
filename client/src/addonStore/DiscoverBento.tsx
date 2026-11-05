/** The Discover bento (design 01): App of the week, Installed, Starter pack, Suggested, Coming soon, Browse. */
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
import { appOfTheWeek, categoryCount, nextSoon, starterPack, suggestion } from './discoverPicks';
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
  const soon = nextSoon(role);
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
      <SkBentoTile
        eyebrow={st.tabInstalled}
        big={enabled.size}
        body={st.appsAndAddons}
        footer={
          <SkBentoLink onClick={() => go('installed')}>
            {st.seeAll} <SkIcon name="chev" small />
          </SkBentoLink>
        }
      />
      {pack && (
        <SkBentoTile
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
      )}
      {sug && (
        <SkBentoTile size="wide" span={2} eyebrow={st.suggestedFor(itemName(st, sug.parent.id))}>
          <div className="sk-rowf sk-g12 sk-mt12">
            <SkTile letter={itemName(st, sug.item.id)} tone={sug.item.tone} size={40} />
            <div className="sk-f1">
              <div className="sk-rowf sk-g8">
                <button type="button" className="sk-t-h3" onClick={() => ctx.open(sug.item.id)}>
                  {itemName(st, sug.item.id)}
                </button>
                {kindBadge(st, sug.item)}
              </div>
              <SkRel>{relOf(sug.item, ctx)}</SkRel>
            </div>
            <ItemAction m={sug.item} ctx={ctx} />
          </div>
        </SkBentoTile>
      )}
      {soon && (
        <SkBentoTile
          variant="dark"
          eyebrow={st.comingSoon}
          title={itemName(st, soon.id)}
          titleSize="h2"
          body={itemDesc(st, soon.id)}
        />
      )}
      <SkBentoTile
        tone={5}
        eyebrow={st.browse}
        title={st.byGoal}
        titleSize="h2"
        body={st.categoriesHint}
        onClick={() => go('apps')}
        label={st.browse}
        footer={
          <SkBentoLink>
            {st.categoriesN(categoryCount(role))} <SkIcon name="chev" small />
          </SkBentoLink>
        }
      />
    </SkBento>
  );
}
