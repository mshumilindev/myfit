import type { ComponentType, CSSProperties, ReactNode } from 'react';
import { Skeleton } from '../components/ui/Skeleton';
import { Sheet as KitSheet } from '../components/ui/Overlays';
import { useEffect, useState } from 'react';
import { getBlob, ref } from 'firebase/storage';
import { storage } from './firebase';
import { House } from '@phosphor-icons/react/House';
import { ChartLineUp } from '@phosphor-icons/react/ChartLineUp';
import { Target } from '@phosphor-icons/react/Target';
import { User } from '@phosphor-icons/react/User';
import { Plus } from '@phosphor-icons/react/Plus';
import { CloudSlash } from '@phosphor-icons/react/CloudSlash';
import { CaretRight } from '@phosphor-icons/react/CaretRight';
import { SquaresFour } from '@phosphor-icons/react/SquaresFour';
import { Barbell } from '@phosphor-icons/react/Barbell';
import { Drop } from '@phosphor-icons/react/Drop';
import { Bread } from '@phosphor-icons/react/Bread';
import { X } from '@phosphor-icons/react/X';
import type { IconProps } from '@phosphor-icons/react';
import { pct, round } from './calc';
import { LANGS, useT } from './i18n';
import { store, useStore } from './store';
import { Button, IconButton } from '../components/ui/Button';
import { Chip } from '../components/ui/Chip';
import type { Macros } from './types';

// ---------------------------------------------------------------- icons
type IconName =
  | 'home'
  | 'history'
  | 'goal'
  | 'profile'
  | 'plus'
  | 'close'
  | 'protein'
  | 'fat'
  | 'carbs'
  | 'cloudOff'
  | 'chevron'
  | 'apps';

const MAP: Record<IconName, ComponentType<IconProps>> = {
  home: House,
  history: ChartLineUp,
  goal: Target,
  profile: User,
  plus: Plus,
  protein: Barbell,
  fat: Drop,
  carbs: Bread,
  cloudOff: CloudSlash,
  chevron: CaretRight,
  apps: SquaresFour,
  close: X,
};

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  const C = MAP[name];
  return <C size={size} weight="regular" />;
}

// ---------------------------------------------------------------- avatar (shared Spotter photo)
const avatarCache = new Map<string, string>();

export function initialsOf(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

/** The user's Spotter photo (Storage avatars/{uid}/photo) or initials fallback. */
export function Avatar({ uid, name, size = 34 }: { uid?: string; name: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(() =>
    uid ? (avatarCache.get(uid) ?? null) : null,
  );
  useEffect(() => {
    if (!uid || avatarCache.has(uid)) return;
    let alive = true;
    getBlob(ref(storage, `avatars/${uid}/photo`))
      .then((b) => (b && b.size ? URL.createObjectURL(b) : null))
      .then((u) => {
        if (!alive) {
          if (u) URL.revokeObjectURL(u);
          return;
        }
        if (u) {
          avatarCache.set(uid, u);
          setSrc(u);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [uid]);
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) };
  if (src) return <img className="avatar" style={style} src={src} alt="" />;
  return (
    <span className="avatar initials" style={style}>
      {initialsOf(name)}
    </span>
  );
}

// ---------------------------------------------------------------- sync + header
export function Sync() {
  const { online } = useStore();
  const { t } = useT();
  return (
    <span className={`sync ${online ? '' : 'off'}`}>
      <span className="dot" />
      {online ? t('synced') : t('offline')}
    </span>
  );
}

export function Header({
  overline,
  title,
  day,
  right,
}: {
  overline?: string;
  title: string;
  day?: string;
  right?: ReactNode;
}) {
  return (
    <div className="hdr">
      <div>
        {overline && <div className="overline">{overline}</div>}
        <h1>{title}</h1>
        {day && <span className="day">{day}</span>}
      </div>
      {right ?? <Sync />}
    </div>
  );
}

// ---------------------------------------------------------------- KBJU ring
export function KbjuRing({ eaten, target }: { eaten: number; target: number }) {
  const { t } = useT();
  const r = 50;
  const c = 2 * Math.PI * r;
  const frac = target > 0 ? eaten / target : 0;
  const over = frac > 1;
  const reached = frac >= 1;
  const dash = Math.min(1, frac) * c;
  const color = over ? 'var(--danger)' : reached ? 'var(--ok)' : 'var(--acc)';
  const remaining = round(target - eaten);
  return (
    <div className="ring">
      <svg width="116" height="116" viewBox="0 0 116 116">
        <circle cx="58" cy="58" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="9" />
        <circle
          cx="58"
          cy="58"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          transform="rotate(-90 58 58)"
        />
      </svg>
      <div className="val tnum">
        {over ? (
          <>
            <b className="ut-danger">{round(eaten - target)}</b>
            <span>
              {t('over')} · {t('kcal')}
            </span>
          </>
        ) : (
          <>
            <b style={{ color: reached ? 'var(--ok)' : undefined }}>{remaining}</b>
            <span>
              {t('kcal')} {t('left')}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function Bar({
  cls,
  icon,
  label,
  eaten,
  target,
}: {
  cls: string;
  icon: 'protein' | 'fat' | 'carbs';
  label: string;
  eaten: number;
  target: number;
}) {
  const over = target > 0 && eaten > target;
  return (
    <div className={`bar ${cls}`}>
      <div className="top">
        <span className="lbl">
          <Icon name={icon} size={14} />
          {label}
        </span>
        <span className="val tnum">
          <b>{round(eaten)}</b>/{round(target)} g
        </span>
      </div>
      <div className="track">
        <div className={`fill ${over ? 'over' : ''}`} style={{ width: `${pct(eaten, target)}%` }} />
      </div>
    </div>
  );
}

export function MacroBars({ eaten, target }: { eaten: Macros; target: Macros }) {
  const { t } = useT();
  return (
    <div className="bars">
      <Bar
        cls="p"
        icon="protein"
        label={t('protein')}
        eaten={eaten.protein}
        target={target.protein}
      />
      <Bar cls="f" icon="fat" label={t('fat')} eaten={eaten.fat} target={target.fat} />
      <Bar cls="c" icon="carbs" label={t('carbs')} eaten={eaten.carbs} target={target.carbs} />
    </div>
  );
}

// ---------------------------------------------------------------- plaque
export function Plaque({
  overline,
  children,
  onDismiss,
  cta,
}: {
  overline: string;
  children: ReactNode;
  onDismiss?: () => void;
  cta?: ReactNode;
}) {
  const { t } = useT();
  return (
    <div className="plaque">
      <div className="ov">
        <span>{overline}</span>
        {onDismiss && <IconButton size="sm" icon="x" label={t('close')} onClick={onDismiss} />}
      </div>
      <div>{children}</div>
      {cta}
    </div>
  );
}

// ---------------------------------------------------------------- sheet / dialog
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <KitSheet onClose={onClose}>
      {title && <h2 className="sheet-title">{title}</h2>}
      {children}
    </KitSheet>
  );
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useT();
  return (
    <div className="scrim center" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p>{body}</p>
        <div className="rowflex">
          <Button variant="secondary" className="grow" onClick={onCancel}>
            {t('cancel')}
          </Button>
          <Button variant="danger" className="grow" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- language chip
export function LanguageChip({ compact }: { compact?: boolean }) {
  const { lang } = useStore();
  const [open, setOpen] = useState(false);
  const cur = LANGS.find((l) => l.id === lang)!;
  const menuStyle = compact
    ? {
        position: 'absolute' as const,
        left: 0,
        bottom: '120%',
        zIndex: 40,
        padding: 8,
        minWidth: 170,
      }
    : {
        position: 'absolute' as const,
        right: 0,
        top: '110%',
        zIndex: 40,
        padding: 8,
        minWidth: 170,
      };
  return (
    <div style={{ position: 'relative' }}>
      <Chip size={compact ? 'sm' : 'md'} onClick={() => setOpen((o) => !o)}>
        {compact ? cur.flag : `${cur.flag} ${cur.label}`}
      </Chip>
      {open && (
        <div className="card" style={menuStyle}>
          {LANGS.map((l) => (
            <Button
              key={l.id}
              variant="ghost"
              fullWidth
              className="uj-start"
              onClick={() => {
                store.setLang(l.id);
                setOpen(false);
              }}
            >
              {l.flag} {l.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Empty({
  emoji,
  title,
  body,
  cta,
}: {
  emoji: string;
  title: string;
  body: string;
  cta?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="emo">{emoji}</div>
      <div className="ut-text ut-w5">{title}</div>
      <div className="mt3">{body}</div>
      {cta && <div className="mt4">{cta}</div>}
    </div>
  );
}

export function Failed({ onRetry }: { onRetry: () => void }) {
  const { t } = useT();
  return (
    <div className="failed">
      <div className="emo ut-hero umb-12">⚠️</div>
      <div className="ut-text ut-w5">{t('failedTitle')}</div>
      <div className="mt3 muted">{t('failedBody')}</div>
      <Button variant="secondary" className="mt4" onClick={onRetry}>
        {t('retry')}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- skeletons
/** A single shimmer block, shaped like the real layout (300ms–2s load window). */
export function Sk({
  w = '100%',
  h,
  r = 8,
  style,
  className,
}: {
  w?: number | string;
  h: number;
  r?: number;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <Skeleton className={className} width={w} height={h} style={{ borderRadius: r, ...style }} />
  );
}
