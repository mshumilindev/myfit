/** Shared bits of the store screens: one item row, its action, the grouped lists. */
import { isAddonAllowed, isAddonUnlocked } from '../addons/enabledSet';
import { addonById, type AddonManifest } from '../addons/manifest';
import { getRole } from '../api';
import { queueAdd, queueRemove } from '../addons/queue';
import type { AddonStoreStrings } from '../i18n/addonStore';
import { SkBadge, SkBtn, SkHighlight, SkIcon, SkInstalledLabel, SkRow, SkTile } from '../store-kit';
import { highlightParts } from './search';

export interface StoreCtx {
  st: AddonStoreStrings;
  enabled: ReadonlySet<string>;
  queued: readonly string[];
  /** False while the device is offline: adding needs the network, installed items keep working. */
  online: boolean;
  open: (id: string) => void;
}

export function itemName(st: AddonStoreStrings, id: string): string {
  return st.items[id as keyof typeof st.items]?.name ?? id;
}
export function itemDesc(st: AddonStoreStrings, id: string): string {
  return st.items[id as keyof typeof st.items]?.desc ?? '';
}

/** The item's rendered icon (Blender, public/store-icons/<id>.webp); an item without one falls back to its letter tile. */
export const iconUrl = (id: string) => `${import.meta.env.BASE_URL ?? '/'}store-icons/${id}.webp`;

export function TileOf({
  st,
  m,
  size,
}: {
  st: AddonStoreStrings;
  m: AddonManifest;
  size?: 32 | 40 | 64 | 96;
}) {
  return (
    <SkTile
      letter={itemName(st, m.id).charAt(0).toUpperCase()}
      tone={m.tone}
      size={size}
      image={iconUrl(m.id)}
    />
  );
}

export function kindBadge(st: AddonStoreStrings, m: AddonManifest) {
  if (m.soon) return <SkBadge kind="soon">{st.soon}</SkBadge>;
  return (
    <SkBadge kind={m.kind === 'app' ? 'app' : 'add'}>
      {m.kind === 'app' ? st.kindApp : m.kind === 'theme' ? st.kindTheme : st.kindAddon}
    </SkBadge>
  );
}

/** The one action of an item: Add / Add with <App> / Selected ✓ / Installed (a status, not a button). */
export function ItemAction({
  m,
  ctx,
  size,
  lead,
}: {
  m: AddonManifest;
  ctx: StoreCtx;
  size?: 'l' | 's';
  /** The add action is the screen's main one (item page bar): solid instead of tinted. */
  lead?: boolean;
}) {
  const { st, enabled, queued } = ctx;
  if (m.soon) return null;
  // an item of another role (reached by a link) has no action: the queue would drop it anyway
  if (!isAddonAllowed(m.id, getRole())) return null;
  if (enabled.has(m.id)) return <SkInstalledLabel>{st.installedLabel}</SkInstalledLabel>;
  if (queued.includes(m.id)) {
    return (
      <SkBtn kind={lead ? 'tint' : 'pri'} size={size} onClick={() => queueRemove([m.id])}>
        {st.pending}
      </SkBtn>
    );
  }
  if (!ctx.online) {
    return (
      <SkBtn kind="dash" size={size} disabled>
        {st.offlineAction}
      </SkBtn>
    );
  }
  if (!isAddonUnlocked(m.id, enabled, getRole())) {
    return (
      <SkBtn kind="dash" size={size} disabled>
        {st.installFirst(itemName(st, m.requires!))}
      </SkBtn>
    );
  }
  const parent = m.parent ? addonById(m.parent) : undefined;
  const parentReady = !parent || enabled.has(parent.id) || queued.includes(parent.id);
  return (
    <SkBtn kind={lead ? 'pri' : 'tint'} size={size} onClick={() => queueAdd([m.id])}>
      {parentReady ? st.add : st.addWith(itemName(st, parent!.id))}
    </SkBtn>
  );
}

export function relOf(m: AddonManifest, ctx: StoreCtx): string | null {
  if (m.requires && !isAddonUnlocked(m.id, ctx.enabled, getRole()))
    return ctx.st.needs(itemName(ctx.st, m.requires));
  if (!m.parent) return null;
  const parentName = itemName(ctx.st, m.parent);
  return ctx.enabled.has(m.parent) || ctx.queued.includes(m.parent)
    ? ctx.st.usesOn(parentName)
    : ctx.st.needs(parentName);
}

export function Highlight({ text, query }: { text: string; query: string }) {
  return <SkHighlight parts={highlightParts(text, query)} />;
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
  const rel = relOf(m, ctx);
  return (
    <SkRow
      className={className}
      tile={<TileOf st={st} m={m} />}
      name={<Highlight text={itemName(st, m.id)} query={query} />}
      desc={<Highlight text={itemDesc(st, m.id)} query={query} />}
      badge={kindBadge(st, m)}
      rel={
        rel && (
          <>
            <SkIcon name="link" small />
            {rel}
          </>
        )
      }
      action={action === undefined ? <ItemAction m={m} ctx={ctx} /> : action}
      onOpen={m.soon ? undefined : () => ctx.open(m.id)}
    />
  );
}
