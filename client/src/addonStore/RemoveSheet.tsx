/** Remove with confirmation (board 14): what goes with it, and that the person's entries stay saved. */
import { useState } from 'react';
import { disableAddons } from '../addons/enabledSet';
import { addonById, itemsOfApp } from '../addons/manifest';
import { SkBtn, SkNote, SkSheet, type SkBtnKind } from '../store-kit';
import { itemName, TileOf, type StoreCtx } from './storeItems';

export function RemoveButton({
  id,
  ctx,
  kind = 'ghost',
  label,
  size,
  onRemoved,
}: {
  id: string;
  ctx: StoreCtx;
  kind?: SkBtnKind;
  label?: string;
  size?: 'l' | 's';
  onRemoved?: () => void;
}) {
  const { st, enabled } = ctx;
  const [open, setOpen] = useState(false);
  const m = addonById(id);
  const name = itemName(st, id);
  // An app takes its installed add-ons with it.
  const withIt = itemsOfApp(id)
    .filter((a) => enabled.has(a.id))
    .map((a) => itemName(st, a.id));
  const close = () => setOpen(false);
  return (
    <>
      <SkBtn kind={kind} size={size} onClick={() => setOpen(true)}>
        {label ?? st.remove}
      </SkBtn>
      <SkSheet open={open} onClose={close} label={st.removeTitle(name)}>
        <div className="sk-rowf sk-g12">
          {m && <TileOf st={st} m={m} size={40} />}
          <h2 className="sk-t-h2">{st.removeTitle(name)}</h2>
        </div>
        {withIt.length > 0 && <p className="sk-t-b sk-mt16">{st.removeWith(withIt)}</p>}
        <SkNote tone="ok" icon="shield" className="sk-mt16">
          {st.removeKept(name)}
        </SkNote>
        <div className="sk-rowf sk-g12 sk-mt24">
          <SkBtn kind="ghost" size="l" onClick={close}>
            {st.cancel}
          </SkBtn>
          <SkBtn
            kind="bad"
            size="l"
            onClick={() => {
              disableAddons([id]);
              close();
              onRemoved?.();
            }}
          >
            {st.remove}
          </SkBtn>
        </div>
      </SkSheet>
    </>
  );
}
