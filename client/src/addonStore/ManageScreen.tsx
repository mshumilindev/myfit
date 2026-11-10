/** Configure an installed app (board 13): its modules as switches. Turning one off keeps its data. */
import { addonById, itemsOfApp } from '../addons/manifest';
import { disableAddons, enableAddons } from '../addons/enabledSet';
import { SkCard, SkRow, SkSwitch } from '../store-kit';
import './screens.css';
import { itemDesc, itemName, TileOf, type StoreCtx } from './storeItems';

export function ManageScreen({ id, ctx }: { id: string; ctx: StoreCtx }) {
  const { st, enabled } = ctx;
  const app = addonById(id);
  if (!app) return null;
  const kids = itemsOfApp(id).filter((a) => !a.soon);
  return (
    <>
      <div className="sk-rowf sk-g16 as-item-head">
        <TileOf st={st} m={app} size={64} />
        <div className="sk-f1">
          <h1 className="sk-t-h1">{itemName(st, id)}</h1>
          <div className="sk-t-s sk-mt4">{st.chooseWhat}</div>
        </div>
      </div>
      {kids.length > 0 && (
        <SkCard className="as-group">
          <div className="sk-t-e as-modules-head">{st.modules}</div>
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
        </SkCard>
      )}
    </>
  );
}
