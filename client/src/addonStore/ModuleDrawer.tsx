/** Module details (SPO-556): a drawer (bottom sheet on a phone, side panel on a wide screen) for one module of an app. */
import { addonById } from '../addons/manifest';
import { disableAddons, enableAddons } from '../addons/enabledSet';
import { SkBtn, SkNote, SkSheet, SkSwitch } from '../store-kit';
import { useState } from 'react';
import { APP_BREAKPOINT, useMinWidth } from '../components/ui/breakpoints';
import { AboutText } from './AboutText';
import { itemName, TileOf, type StoreCtx } from './storeItems';
import { PreviewViewer } from './PreviewViewer';
import { MODULE_SHOTS, previewUrl } from './weekPreviews';

export function ModuleDrawer({
  id,
  ctx,
  onClose,
}: {
  id: string | null;
  ctx: StoreCtx;
  onClose: () => void;
}) {
  const { st, enabled } = ctx;
  const [view, setView] = useState<number | null>(null);
  const wide = useMinWidth(APP_BREAKPOINT);
  const m = id ? addonById(id) : undefined;
  const parent = m?.parent ? addonById(m.parent) : undefined;
  const name = m ? itemName(st, m.id) : '';
  const shots = m ? (MODULE_SHOTS[m.id] ?? []) : [];
  const parentOn = !!parent && enabled.has(parent.id);
  return (
    <SkSheet open={!!m} onClose={onClose} label={name} variant="drawer" className="as-mod-drawer">
      {m && (
        <>
          <div className="sk-rowf sk-g12 sk-start">
            <TileOf st={st} m={m} size={64} />
            <div className="sk-f1">
              <h2 className="sk-t-h2">{name}</h2>
              {parent && <div className="sk-t-s sk-mute">{st.forApp(itemName(st, parent.id))}</div>}
            </div>
          </div>
          <div className="sk-mt16">
            <AboutText st={st} id={m.id} />
          </div>
          {shots.length > 0 && (
            <div className="as-mod-shots sk-mt16">
              {shots.map((sh, i) => (
                <img
                  key={sh}
                  src={previewUrl(sh, wide ? 'd' : 'm')}
                  alt={st.previewN(i + 1, shots.length)}
                  loading="lazy"
                  onClick={() => setView(i)}
                />
              ))}
            </div>
          )}
          {parentOn ? (
            <div className="sk-rowf sk-g12 sk-mt16 as-mod-state">
              <span className="sk-t-b sk-f1">{name}</span>
              <SkSwitch
                on={enabled.has(m.id)}
                label={name}
                onChange={(next) => (next ? enableAddons([m.id]) : disableAddons([m.id]))}
              />
            </div>
          ) : (
            parent && (
              <SkNote icon="shield" className="sk-mt16">
                {st.needs(itemName(st, parent.id))}
              </SkNote>
            )
          )}
          <div className="sk-rowf sk-g12 sk-mt24">
            <SkBtn kind="ghost" size="l" onClick={onClose}>
              {st.close}
            </SkBtn>
          </div>
        </>
      )}
      {view != null && (
        <PreviewViewer
          shots={shots}
          start={view}
          title={name}
          ctx={ctx}
          onClose={() => setView(null)}
        />
      )}
    </SkSheet>
  );
}
