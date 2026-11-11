/** "Of the week" hero (SPO-556): three independent slots (app / add-on / theme) on their pages, one mixed tile on Discover. */
import { useEffect, useState } from 'react';
import { getRole } from '../api';
import { addonById, type AddonManifest } from '../addons/manifest';
import { isAddonAllowed, isAddonUnlocked } from '../addons/enabledSet';
import { queueAdd, queueRemove } from '../addons/queue';
import { SkBento, SkBentoTile, SkBtn } from '../store-kit';
import { weekPick, type WeekKind } from './discoverPicks';
import { itemDesc, itemName, kindBadge, type StoreCtx } from './storeItems';
import { PreviewViewer } from './PreviewViewer';
import { previewUrl, WEEK_SHOTS } from './weekPreviews';

/** The theme's own look on the hero: a new theme needs no extra design here, only a skin class. */
export function themeSkin(m: AddonManifest, now: number): string {
  if (m.id === 'theme-cyberpunk') return 'wk-skin-cyberpunk';
  if (m.id === 'theme-brass-glass') return 'wk-skin-glass';
  if (m.id === 'holiday-themes') {
    const mo = new Date(now).getMonth();
    return mo >= 10 || mo <= 1 ? 'wk-skin-christmas' : 'wk-skin-halloween';
  }
  return '';
}

function Art({
  m,
  name,
  idx,
  onOpen,
}: {
  m: AddonManifest;
  name: string;
  idx: number;
  onOpen: () => void;
}) {
  const shots = WEEK_SHOTS[m.id];
  if (!shots) return null;
  const stack = (t: 'm' | 'd') =>
    shots.map((sh, i) => (
      <img
        key={sh}
        className={`wk-s${i === idx ? ' on' : ''}`}
        src={previewUrl(sh, t)}
        alt=""
        loading="lazy"
      />
    ));
  return (
    <div className="wk-art" onClick={onOpen}>
      <div className="wk-phone">
        <div className="wk-stack">{stack('m')}</div>
      </div>
      <div className="wk-win">
        <div className="wk-bar">
          <i />
          <i />
          <i />
          <span>{name}</span>
        </div>
        <div className="wk-stack">{stack('d')}</div>
      </div>
    </div>
  );
}

/** Slider dots: only where an item has more than one preview. */
function Dots({
  n,
  idx,
  set,
  ctx,
}: {
  n: number;
  idx: number;
  set: (i: number) => void;
  ctx: StoreCtx;
}) {
  if (n < 2) return null;
  const { st } = ctx;
  return (
    <div className="wk-dots" role="group" aria-label={st.previewsLabel}>
      {Array.from({ length: n }, (_, i) => (
        <button
          key={i}
          type="button"
          className={i === idx ? 'on' : ''}
          aria-label={st.previewN(i + 1, n)}
          aria-current={i === idx}
          onClick={() => set(i)}
        />
      ))}
    </div>
  );
}

/** The hero's one action: Add app / Add add-on / Add theme, Add with <parent>, Selected ✓; locked or offline is disabled. */
function Pick({ m, ctx }: { m: AddonManifest; ctx: StoreCtx }) {
  const { st, enabled, queued } = ctx;
  if (!isAddonAllowed(m.id, getRole())) return null;
  if (queued.includes(m.id))
    return (
      <SkBtn kind="inv" onClick={() => queueRemove([m.id])}>
        {st.pending}
      </SkBtn>
    );
  if (!ctx.online)
    return (
      <SkBtn kind="dash" disabled>
        {st.offlineAction}
      </SkBtn>
    );
  if (!isAddonUnlocked(m.id, enabled, getRole()))
    return (
      <SkBtn kind="dash" disabled>
        {st.installFirst(itemName(st, m.requires!))}
      </SkBtn>
    );
  const parent = m.parent ? addonById(m.parent) : undefined;
  const ready = !parent || enabled.has(parent.id) || queued.includes(parent.id);
  const add = m.kind === 'app' ? st.addApp : m.kind === 'theme' ? st.addTheme : st.addAddon;
  return (
    <SkBtn kind="inv" onClick={() => queueAdd([m.id])}>
      {ready ? add : st.addWith(itemName(st, parent!.id))}
    </SkBtn>
  );
}

function labelOf(m: AddonManifest, ctx: StoreCtx): string {
  const { st } = ctx;
  return m.kind === 'app'
    ? st.weekTitle
    : m.kind === 'theme'
      ? st.weekTitleTheme
      : st.weekTitleAddon;
}

/** The hero tile for a picked item (also Discover's tile). */
export function WeekTile({
  m,
  ctx,
  now,
  span,
}: {
  m: AddonManifest;
  ctx: StoreCtx;
  now: number;
  span?: 2;
}) {
  const { st } = ctx;
  const name = itemName(st, m.id);
  const n = WEEK_SHOTS[m.id]?.length ?? 0;
  const [idx, setIdx] = useState(0);
  const [full, setFull] = useState(false);
  const auto = m.id === 'holiday-themes' && n > 1 && !full;
  useEffect(() => {
    if (!auto) return;
    const t = window.setInterval(() => setIdx((i) => (i + 1) % n), 7000);
    return () => window.clearInterval(t);
  }, [auto, n, idx]);
  const skin = m.kind === 'theme' ? themeSkin(m, now) : '';
  return (
    <>
      {full && (
        <PreviewViewer
          shots={WEEK_SHOTS[m.id] ?? []}
          start={idx}
          title={name}
          ctx={ctx}
          onClose={() => setFull(false)}
        />
      )}
      <SkBentoTile
        tone={m.tone}
        size="hero"
        span={span}
        className={`wk-tile ${skin}${auto ? ` wk-holiday wk-at-${idx}` : ''}`}
        eyebrow={labelOf(m, ctx)}
        aside={m.kind === 'theme' ? undefined : kindBadge(st, m)}
        title={name}
        titleSize="hero"
        onTitle={() => ctx.open(m.id)}
        body={itemDesc(st, m.id)}
        footer={
          <>
            <div className="wk-foot">
              <Pick m={m} ctx={ctx} />
              <Dots n={n} idx={idx} set={setIdx} ctx={ctx} />
            </div>
            <Art m={m} name={name} idx={idx} onOpen={() => setFull(true)} />
          </>
        }
      />
    </>
  );
}

/** The slot on a page. Everything installed: the slot shows nothing (a Coming soon item never takes it). */
export function WeekHero({
  kind,
  ctx,
  now: nowProp,
}: {
  kind: 'app' | 'addon' | 'theme';
  ctx: StoreCtx;
  now?: number;
}) {
  const { enabled } = ctx;
  const [mounted] = useState(() => Date.now());
  const now = nowProp ?? mounted;
  const role = getRole();
  const m = weekPick(kind, role, enabled, now);
  if (m)
    return (
      <SkBento>
        <WeekTile m={m} ctx={ctx} now={now} span={2} />
      </SkBento>
    );
  // Everything installed (or nothing to offer): no banner. Coming-soon items never take the slot.
  return null;
}

export type { WeekKind };
