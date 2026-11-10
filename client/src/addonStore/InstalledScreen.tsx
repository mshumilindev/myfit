/** Installed (board 12): one card per app with a switch per add-on. Removing keeps data. */
import { ADDONS, appOfItem, itemsOfApp } from '../addons/manifest';
import { disableAddons, enableAddons } from '../addons/enabledSet';
import {
  SkBtn,
  SkCard,
  SkEmpty,
  SkIcon,
  SkInstalledLabel,
  SkRow,
  SkSwitch,
  SkTile,
} from '../store-kit';
import './screens.css';
import { itemDesc, itemName, kindBadge, TileOf, type StoreCtx } from './storeItems';

export function Installed({ ctx, go }: { ctx: StoreCtx; go: (v: string, id?: string) => void }) {
  const { st, enabled } = ctx;
  const items = ADDONS.filter((m) => enabled.has(m.id));
  if (!items.length) {
    return (
      <SkCard className="sk-p20">
        <SkEmpty
          icon={
            <SkTile letter="" tone={5} size={64}>
              <SkIcon name="inst" />
            </SkTile>
          }
          title={st.installedEmptyTitle}
          body={st.installedEmptyBody}
          actions={
            <SkBtn kind="pri" onClick={() => go('addons')}>
              {st.browseAddons}
            </SkBtn>
          }
        />
      </SkCard>
    );
  }
  // One card per installed item that stands on its own: an app, a standalone add-on (Sleep, Atlas…), a theme. An add-on of an
  // installed app is a switch inside that app's card instead.
  const apps = items.filter(
    (m) => m.kind !== 'module' && !(appOfItem(m) && enabled.has(appOfItem(m)!)),
  );
  return (
    <div className="as-groups">
      {apps.map((app) => {
        const kids = itemsOfApp(app.id).filter((a) => !a.soon);
        const on = kids.filter((k) => enabled.has(k.id)).length;
        return (
          <SkCard key={app.id} className="as-group">
            <SkRow
              tile={<TileOf st={st} m={app} size={40} />}
              name={
                <>
                  {itemName(st, app.id)} {kindBadge(st, app)}
                </>
              }
              desc={kids.length ? st.modulesOn(on, kids.length) : undefined}
              action={<SkInstalledLabel>{st.installedLabel}</SkInstalledLabel>}
              noBorder={!kids.length}
            />
            {kids.map((k) => (
              <SkRow
                key={k.id}
                tile={<TileOf st={st} m={k} size={40} />}
                name={itemName(st, k.id)}
                desc={itemDesc(st, k.id)}
                action={
                  <SkSwitch
                    on={enabled.has(k.id)}
                    label={itemName(st, k.id)}
                    onChange={(next) => (next ? enableAddons([k.id]) : disableAddons([k.id]))}
                  />
                }
              />
            ))}
            <button type="button" className="as-manage" onClick={() => go('manage', app.id)}>
              <span>{st.manage}</span>
              <SkIcon name="chev" />
            </button>
          </SkCard>
        );
      })}
    </div>
  );
}
