import type { CSSProperties, ReactNode } from 'react';

import { Icon } from '../../ui';

import './Banner.css';

export type BannerTone = 'accent' | 'rest' | 'danger' | 'ok' | 'sport' | 'conditioning';

/** Colour families a banner can blend across (activity categories). */
export type BannerBlendTone = 'sport' | 'conditioning' | 'rest';

export interface BannerAction {
  label: string;
  icon?: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface BannerProps {
  tone?: BannerTone;
  /** Two or three families flowing into each other on a diagonal (equal shares);
   *  the first one sets the text colours. Overrides `tone`. */
  blend?: BannerBlendTone[];
  icon?: string;
  kicker?: string;
  title: ReactNode;
  body?: ReactNode;
  /** Slot for a ProgressDots row (or any node) under the body. */
  dots?: ReactNode;
  primaryAction?: BannerAction;
  skipAction?: { label: string; onClick: () => void };
  /** Animated sheen (default on; respects prefers-reduced-motion). */
  sheen?: boolean;
  children?: ReactNode;
}

/** Diagonal gradient of the gems, each family's `--color-<tone>` token, equal shares. */
function blendStyle(blend: BannerBlendTone[]): CSSProperties {
  const gems = blend
    .slice(0, 3)
    .map(
      (g) =>
        `color-mix(in srgb, var(--color-${g}) 20%, color-mix(in srgb, var(--c-18181c) 42%, transparent))`,
    );
  return { backgroundImage: `linear-gradient(135deg, ${gems.join(', ')})` };
}

/**
 * The frosted-gem banner. One `tone` sets the whole gem (glass gradient, rim,
 * icon and text shades) from token families. Absorbs the .prog-banner family.
 */
export function Banner({
  tone = 'accent',
  blend,
  icon,
  kicker,
  title,
  body,
  dots,
  primaryAction,
  skipAction,
  sheen = true,
  children,
}: BannerProps) {
  return (
    <div
      className={`uibanner uibanner--${blend?.length ? blend[0] : tone}${blend && blend.length > 1 ? ' uibanner--blend' : ''}`}
      style={blend && blend.length > 1 ? blendStyle(blend) : undefined}
    >
      {sheen && <span className="uibanner-sheen" aria-hidden />}
      <div className="uibanner-row">
        {icon && (
          <div className="uibanner-icon">
            <Icon name={icon} />
          </div>
        )}
        <div className="uibanner-main">
          {kicker && <div className="uibanner-kicker">{kicker}</div>}
          <div className="uibanner-title">{title}</div>
          {body != null && <div className="uibanner-body">{body}</div>}
          {dots != null && <div className="uibanner-dots">{dots}</div>}
          {children}
          {(primaryAction || skipAction) && (
            <div className="uibanner-acts">
              {primaryAction && (
                <button
                  type="button"
                  className="uibanner-cta"
                  onClick={primaryAction.onClick}
                  disabled={primaryAction.disabled}
                >
                  {primaryAction.icon && <Icon name={primaryAction.icon} />}
                  {primaryAction.label}
                </button>
              )}
              {skipAction && (
                <button type="button" className="uibanner-skip" onClick={skipAction.onClick}>
                  {skipAction.label}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
