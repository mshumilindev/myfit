import type { ReactNode } from 'react';
import { Icon } from '../../ui';
import { IconTile } from './IconTile';
import { toneClass, type Tone } from './tones';
import './CategoryRow.css';

export interface CategoryRowProps {
  tone: Tone;
  /** Phosphor icon of the category. */
  icon: string;
  title: ReactNode;
  /** Small count after the title ("· 13"). */
  count?: ReactNode;
  /** Meta line under the title ("last: Dance · Sat"). */
  meta?: ReactNode;
  /** Example type icons, as mini tiles. */
  minis?: string[];
  /** `stack` — minis left of the meta line (mobile); `inline` — minis on the right (web). */
  layout?: 'stack' | 'inline';
  selected?: boolean;
  /** Dim the minis (e.g. while starting is locked). */
  muted?: boolean;
  chevron?: boolean;
  ariaLabel?: string;
  onClick: () => void;
  className?: string;
}

/** A browse-by-category card: IconTile in the family colour, name, count,
 *  meta, example minis and a chevron (Log activity: Conditioning / Sports / Recovery). */
export function CategoryRow({
  tone,
  icon,
  title,
  count,
  meta,
  minis = [],
  layout = 'stack',
  selected = false,
  muted = false,
  chevron = true,
  ariaLabel,
  onClick,
  className,
}: CategoryRowProps) {
  const miniTiles = (n: number, size: 22 | 30) =>
    minis.slice(0, n).map((k) => <IconTile key={k} tone="inherit" size={size} icon={k} />);
  return (
    <button
      type="button"
      className={[
        'uicat',
        `uicat--${layout}`,
        toneClass(tone),
        selected ? 'is-selected' : '',
        muted ? 'is-muted' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <IconTile tone="inherit" size={44} icon={icon} />
      <span className="uicat-body">
        <span className="uicat-t">
          {title}
          {count != null && <span className="uicat-n"> · {count}</span>}
        </span>
        {layout === 'stack' ? (
          <span className="uicat-meta">
            {minis.length > 0 && <span className="uicat-minis">{miniTiles(3, 22)}</span>}
            {meta != null && <span className="uicat-m">{meta}</span>}
          </span>
        ) : (
          meta != null && <span className="uicat-m">{meta}</span>
        )}
      </span>
      {layout === 'inline' && minis.length > 0 && (
        <span className="uicat-minis">{miniTiles(4, 30)}</span>
      )}
      {chevron && <Icon name="caret-right" className="uicat-chev" />}
    </button>
  );
}
