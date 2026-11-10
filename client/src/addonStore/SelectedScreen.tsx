/** Selected screen of the store: what was added but not installed yet, with the modules to tick. */
import { addonById, ADDONS, type AddonManifest } from '../addons/manifest';
import { startInstall } from '../addons/installRun';
import { queueRemove, setModulePick, useModulePicks } from '../addons/queue';
import { SkBtn, SkEmpty, SkIcon, SkList, SkRow, SkSwitch, SkTile } from '../store-kit';
import { ItemRow, itemDesc, itemName, TileOf, type StoreCtx } from './storeItems';

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
      <div>
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
