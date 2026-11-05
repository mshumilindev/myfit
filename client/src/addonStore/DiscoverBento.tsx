/** The Discover bento (design 01): App of the week, Installed, Starter pack, Suggested, Coming soon, Browse. */
import type { Role } from '../api';
import { queueAdd, queueRemove } from '../addons/queue';
import { SkBadge, SkBtn, SkIcon, SkTile } from '../store-kit/parts';
import { appOfTheWeek, categoryCount, nextSoon, starterPack, suggestion } from './discoverPicks';
import { ItemAction, itemDesc, itemName, kindBadge, relOf, type StoreCtx } from './storeItems';

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
  const cats = categoryCount(role);
  const packPicked = pack ? pack.left.every((id) => queued.includes(id)) : false;
  return (
    <div className="sk-bento sk-bento-2 sk-mt16">
      {week && (
        <div className={`sk-bn sk-bn-g${week.tone} sk-span2 sk-bn-hero`}>
          <div className="sk-rowf sk-sb">
            <span className="sk-t-e">{st.weekTitle}</span>
            <SkBadge kind="app">{st.kindApp}</SkBadge>
          </div>
          <button type="button" className="sk-bn-title" onClick={() => ctx.open(week.id)}>
            {itemName(st, week.id)}
          </button>
          <div className="sk-t-b sk-mt4">{itemDesc(st, week.id)}</div>
          <div className="sk-mta">
            {queued.includes(week.id) ? (
              <SkBtn kind="inv" onClick={() => queueRemove([week.id])}>
                {st.pending}
              </SkBtn>
            ) : (
              <SkBtn kind="inv" onClick={() => queueAdd([week.id])}>
                {st.add}
              </SkBtn>
            )}
          </div>
        </div>
      )}
      <div className="sk-bn sk-bn-w">
        <span className="sk-t-e">{st.tabInstalled}</span>
        <div className="sk-big sk-mt8">{enabled.size}</div>
        <div className="sk-t-s">{st.appsAndAddons}</div>
        <button type="button" className="sk-bn-link sk-mta" onClick={() => go('installed')}>
          {st.seeAll} <SkIcon name="chev" small />
        </button>
      </div>
      {pack && (
        <div className="sk-bn sk-bn-a">
          <span className="sk-t-e">{st.startPack}</span>
          <div className="sk-t-h3 sk-mt8">{st.packRecovery}</div>
          <div className="sk-t-c">{pack.ids.map((id) => itemName(st, id)).join(', ')}</div>
          <div className="sk-mta">
            {packPicked ? (
              <SkBtn kind="inv" onClick={() => queueRemove(pack.left)}>
                {st.pending}
              </SkBtn>
            ) : (
              <SkBtn kind="inv" onClick={() => queueAdd(pack.left)}>
                {st.addN(pack.left.length)}
              </SkBtn>
            )}
          </div>
        </div>
      )}
      {sug && (
        <div className="sk-bn sk-bn-w sk-span2">
          <span className="sk-t-e">{st.suggestedFor(itemName(st, sug.parent.id))}</span>
          <div className="sk-rowf sk-g12 sk-mt12">
            <SkTile letter={itemName(st, sug.item.id).charAt(0)} tone={sug.item.tone} size={40} />
            <div className="sk-f1">
              <div className="sk-rowf sk-g8">
                <button type="button" className="sk-bn-name" onClick={() => ctx.open(sug.item.id)}>
                  {itemName(st, sug.item.id)}
                </button>
                {kindBadge(st, sug.item)}
              </div>
              <div className="sk-rel">
                <SkIcon name="link" small />
                {relOf(sug.item, ctx)}
              </div>
            </div>
            <ItemAction m={sug.item} ctx={ctx} />
          </div>
        </div>
      )}
      {soon && (
        <div className="sk-bn sk-bn-d">
          <span className="sk-t-e">{st.comingSoon}</span>
          <div className="sk-t-h2 sk-mt8">{itemName(st, soon.id)}</div>
          <div className="sk-t-c">{itemDesc(st, soon.id)}</div>
        </div>
      )}
      <button type="button" className="sk-bn sk-bn-g5 sk-bn-btn" onClick={() => go('apps')}>
        <span className="sk-t-e">{st.browse}</span>
        <span className="sk-t-h2 sk-mt8">{st.byGoal}</span>
        <span className="sk-t-c">{st.categoriesHint}</span>
        <span className="sk-bn-link sk-mta">
          {st.categoriesN(cats)} <SkIcon name="chev" small />
        </span>
      </button>
    </div>
  );
}
