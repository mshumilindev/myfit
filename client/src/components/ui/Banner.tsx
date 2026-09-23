import type { ReactNode } from 'react';

import { Icon } from '../../ui';

import './Banner.css';

export type BannerTone = 'accent' | 'rest' | 'danger' | 'ok';

export interface BannerAction {
  label: string;
  icon?: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface BannerProps {
  tone?: BannerTone;
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

/**
 * The frosted-gem banner. One `tone` sets the whole gem (glass gradient, rim,
 * icon and text shades) from token families. Absorbs the .prog-banner family.
 */
export function Banner({
  tone = 'accent',
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
    <div className={`uibanner uibanner--${tone}`}>
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
