import type { ReactNode } from 'react';
import { Icon } from '../../ui';
import { Card } from './Card';
import { IconTile } from './IconTile';
import { Skeleton } from './Skeleton';
import { Tag } from './Tag';
import './ShareCard.css';

export type ShareCardState = 'ok' | 'limited' | 'locked' | 'removed' | 'loading';

export interface ShareCardRowProps {
  name: string;
  /** "4 x 8 . 70 kg", "100 kg x 5" or a quiet "Just the exercise". */
  meta?: string;
  image?: string;
}

export interface ShareCardProps {
  state: ShareCardState;
  /** Icon + word above the content ("Program", "Workout day"). */
  typeIcon: string;
  typeLabel: string;
  /** A small tag at the right of the type line ("With trainer"). Locked / Removed tags are added by the card. */
  tag?: { icon?: string; label: string };
  /** Tag text for `locked` / `removed`. */
  deadTag?: string;
  title?: string;
  subtitle?: string;
  /** Why it is locked or gone, in plain words. */
  reason?: string;
  chips?: readonly string[];
  /** Left of the title: a photo, an anatomy highlight or an icon (see `ShareCardPhoto`). */
  media?: ReactNode;
  /** Right of the title: a mini trend. */
  trend?: ReactNode;
  rows?: readonly ShareCardRowProps[];
  /** Full-width block under the rows (route trace). */
  extra?: ReactNode;
  facts?: readonly { label: string; value: string }[];
  /** `limited`: what is hidden ("Oleh shares totals only. Sets and weights are hidden."). */
  limitedText?: string;
  /** Left of the footer: "Updates with the program". */
  caption?: string;
  /** Right of the footer: "Open in Programs". */
  openLabel?: string;
  /** Spoken name of the whole card. */
  ariaLabel: string;
  /** Spoken while loading. */
  loadingLabel?: string;
  /** Tapping the card. Absent (or locked / removed / loading) = not a link. */
  onOpen?: () => void;
  /** `peek` has no frame (it lives inside a drawer), `dock` is tighter. */
  density?: 'bubble' | 'dock' | 'peek';
  className?: string;
}

/** The thumb slot: photo, node (anatomy) or a tinted icon. */
export function ShareCardPhoto({
  src,
  icon,
  children,
}: {
  src?: string;
  icon?: string;
  children?: ReactNode;
}) {
  if (children) return <span className="uishc-th is-node">{children}</span>;
  if (src) return <img className="uishc-th is-img" src={src} alt="" loading="lazy" />;
  return (
    <span className="uishc-th is-icon">
      <Icon name={icon ?? 'barbell'} />
    </span>
  );
}

/**
 * Preview card of a shared item inside a chat bubble (kit group `Coach/Share card`). Presentational: every word is a
 * prop, so the trainer chat, the client chat and the dock draw the same card. ONE bordered panel and one fixed
 * width; the title wraps to two lines before it clips. States: `ok`, `limited` (part hidden by the sharing level),
 * `locked` and `removed` (dashed, no content, not a link) and `loading` (skeleton lines). The whole card is the link.
 */
export function ShareCard(p: ShareCardProps) {
  const density = p.density ?? 'bubble';
  const cls = ['uishc', `uishc--${density}`, `is-${p.state}`, p.className]
    .filter(Boolean)
    .join(' ');
  const dead = p.state === 'locked' || p.state === 'removed';

  if (p.state === 'loading') {
    return (
      <Card
        className={cls}
        pad="md"
        aria-busy="true"
        aria-label={p.loadingLabel ?? p.ariaLabel}
        role="status"
      >
        <span className="uishc-top">
          <Skeleton width={96} height={14} />
        </span>
        <span className="uishc-main">
          <Skeleton width={56} height={56} />
          <span className="uishc-b">
            <Skeleton width="70%" height={16} />
            <Skeleton width="45%" height={12} />
          </span>
        </span>
        <span className="uishc-foot">
          <Skeleton width={120} height={12} />
        </span>
      </Card>
    );
  }

  const body = (
    <>
      <span className="uishc-top">
        <span className="uishc-type">
          <Icon
            name={
              p.state === 'locked' ? 'lock-simple' : p.state === 'removed' ? 'trash' : p.typeIcon
            }
          />
          {p.typeLabel}
        </span>
        {!dead && p.tag && (
          <Tag tone="coach" icon={p.tag.icon ? <Icon name={p.tag.icon} /> : undefined}>
            {p.tag.label}
          </Tag>
        )}
        {dead && p.deadTag && <Tag tone="neutral">{p.deadTag}</Tag>}
      </span>
      {dead ? (
        <span className="uishc-main">
          <IconTile icon={p.state === 'locked' ? 'lock-simple' : 'trash'} size={56} />
          <span className="uishc-b">
            {p.title && <b className="uishc-title">{p.title}</b>}
            {p.reason && <small className="uishc-reason">{p.reason}</small>}
          </span>
        </span>
      ) : (
        <>
          <span className="uishc-main">
            {p.media}
            <span className="uishc-b">
              <b className="uishc-title">{p.title}</b>
              {p.subtitle && <small>{p.subtitle}</small>}
              {p.chips && p.chips.length > 0 && (
                <span className="uishc-chips">
                  {p.chips.map((c) => (
                    <Tag key={c} tone="neutral">
                      {c}
                    </Tag>
                  ))}
                </span>
              )}
            </span>
            {p.trend && <span className="uishc-trend">{p.trend}</span>}
          </span>
          {p.rows && p.rows.length > 0 && (
            <span className="uishc-rows">
              {p.rows.map((r) => (
                <span key={r.name} className="uishc-row">
                  <ShareCardPhoto src={r.image} icon="barbell" />
                  <span className="uishc-rn">{r.name}</span>
                  {r.meta && <span className="uishc-rm">{r.meta}</span>}
                </span>
              ))}
            </span>
          )}
          {p.extra}
          {p.facts && p.facts.length > 0 && (
            <span className="uishc-facts">
              {p.facts.map((f) => (
                <span key={f.label}>
                  <small>{f.label}</small>
                  <b>{f.value}</b>
                </span>
              ))}
            </span>
          )}
          {p.limitedText && (
            <span className="uishc-lim">
              <Icon name="lock-simple" />
              {p.limitedText}
            </span>
          )}
          {(p.caption || p.openLabel) && (
            <span className="uishc-foot">
              <small>{p.caption}</small>
              {p.onOpen && p.openLabel && (
                <span className="uishc-open">
                  {p.openLabel}
                  <Icon name="caret-right" />
                </span>
              )}
            </span>
          )}
        </>
      )}
    </>
  );

  if (!dead && p.onOpen) {
    return (
      <Card as="button" className={cls} pad="md" onClick={p.onOpen} aria-label={p.ariaLabel}>
        {body}
      </Card>
    );
  }
  return (
    <Card className={cls} pad="md" nested={dead} role="group" aria-label={p.ariaLabel}>
      {body}
    </Card>
  );
}
