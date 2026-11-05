/** Shared bits of the store screens: one item row, its action, the grouped lists. */
import { addonById, type AddonManifest } from '../addons/manifest';
import { disableAddons } from '../addons/enabledSet';
import { queueAdd, queueRemove } from '../addons/queue';
import type { AddonStoreStrings } from '../i18n/addonStore';
import { SkBadge, SkBtn, SkInstalledLabel, SkRow, SkTile } from '../store-kit/parts';
import { highlightParts } from './search';
import { cx } from '../store-kit/parts';

export interface StoreCtx {
  st: AddonStoreStrings;
  enabled: ReadonlySet<string>;
  queued: readonly string[];
  open: (id: string) => void;
}

export function itemName(st: AddonStoreStrings, id: string): string {
  return st.items[id as keyof typeof st.items]?.name ?? id;
}
export function itemDesc(st: AddonStoreStrings, id: string): string {
  return st.items[id as keyof typeof st.items]?.desc ?? '';
}

export function TileOf({
  st,
  m,
  size,
}: {
  st: AddonStoreStrings;
  m: AddonManifest;
  size?: 32 | 40 | 64 | 96;
}) {
  return <SkTile letter={itemName(st, m.id).charAt(0).toUpperCase()} tone={m.tone} size={size} />;
}

export function kindBadge(st: AddonStoreStrings, m: AddonManifest) {
  if (m.soon) return <SkBadge kind="soon">{st.soon}</SkBadge>;
  return (
    <SkBadge kind={m.kind === 'app' ? 'app' : 'add'}>
      {m.kind === 'app' ? st.kindApp : st.kindAddon}
    </SkBadge>
  );
}

/** The one action of an item: Add / Add with <App> / Selected ✓ / Installed (a status, not a button). */
export function ItemAction({
  m,
  ctx,
  size,
}: {
  m: AddonManifest;
  ctx: StoreCtx;
  size?: 'l' | 's';
}) {
  const { st, enabled, queued } = ctx;
  if (m.soon) return null;
  if (enabled.has(m.id)) return <SkInstalledLabel>{st.installedLabel}</SkInstalledLabel>;
  if (queued.includes(m.id)) {
    return (
      <SkBtn kind="pri" size={size} onClick={() => queueRemove([m.id])}>
        {st.pending}
      </SkBtn>
    );
  }
  const parent = m.parent ? addonById(m.parent) : undefined;
  const parentReady = !parent || enabled.has(parent.id) || queued.includes(parent.id);
  return (
    <SkBtn kind="tint" size={size} onClick={() => queueAdd([m.id])}>
      {parentReady ? st.add : st.addWith(itemName(st, parent!.id))}
    </SkBtn>
  );
}

export function relOf(m: AddonManifest, ctx: StoreCtx): string | null {
  if (!m.parent) return null;
  const parentName = itemName(ctx.st, m.parent);
  return ctx.enabled.has(m.parent) || ctx.queued.includes(m.parent)
    ? ctx.st.usesOn(parentName)
    : ctx.st.needs(parentName);
}

export function Highlight({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightParts(text, query).map((p, i) =>
        p.hit ? (
          <span key={i} className="sk-hl">
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

export function ItemRow({
  m,
  ctx,
  query = '',
  action,
  className,
}: {
  m: AddonManifest;
  ctx: StoreCtx;
  query?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  const { st } = ctx;
  return (
    <div className={cx(className)}>
      <SkRow
        tile={<TileOf st={st} m={m} />}
        name={<Highlight text={itemName(st, m.id)} query={query} />}
        desc={<Highlight text={itemDesc(st, m.id)} query={query} />}
        badge={kindBadge(st, m)}
        rel={relOf(m, ctx)}
        action={action === undefined ? <ItemAction m={m} ctx={ctx} /> : action}
        onOpen={m.soon ? undefined : () => ctx.open(m.id)}
      />
    </div>
  );
}

export function RemoveButton({ id, st }: { id: string; st: AddonStoreStrings }) {
  return (
    <SkBtn kind="ghost" onClick={() => disableAddons([id])}>
      {st.remove}
    </SkBtn>
  );
}
