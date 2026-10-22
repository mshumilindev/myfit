/* Small presentational parts of the exercise picker (image, info button, badges). Leaf module. */
import { useState } from 'react';
import type { ExerciseFlag } from '../conditions';
import type { Strings } from '../i18n/en';
import type { PickItem } from '../picker';
import { Icon } from '../ui';
import { IconButton } from './ui/Button';

export function Img({
  src,
  alt,
  className,
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <span className={`xp-noimg ${className ?? ''}`} aria-hidden>
        <Icon name="barbell" />
      </span>
    );
  }
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
    />
  );
}

export function InfoButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <IconButton
      icon="info"
      size="xs"
      variant="photo"
      shape="round"
      className="xp-info"
      label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    />
  );
}

export function AddedBadge({ on, t }: { on: boolean; t: Strings }) {
  if (!on) return null;
  return (
    <span className="xp-badge done">
      <Icon name="check" />
      {t.pgAdded}
    </span>
  );
}

export function XpBadge({
  item,
  t,
  flag,
}: {
  item: PickItem;
  t: Strings;
  flag?: ExerciseFlag['level'];
}) {
  if (flag === 'avoid' || flag === 'caution')
    return (
      <span className="xp-badge care">
        <Icon name="shield-check" />
        {flag === 'avoid' ? t.pickNotAdvised : t.pickCareful}
      </span>
    );
  if (item.doneToday)
    return (
      <span className="xp-badge done">
        <Icon name="check" />
        {t.pickDoneBadge}
      </span>
    );
  if (item.timesDone > 0) return <span className="xp-badge mine">{t.pickYours}</span>;
  return null;
}
