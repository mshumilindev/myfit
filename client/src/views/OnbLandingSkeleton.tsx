import { Skeleton } from '../components/ui/Skeleton';
import { LanguageSelector } from '../ui';

/**
 * Landing skeleton (O-01) — mirrors the real landing card block-for-block so the
 * invite-preview gate resolves into the landing with no layout shift. Blocks are
 * sized from the real type scale (wordmark 48px, display title 2×34px, lead
 * 2×16px, 52px CTA, footnote, inviter). Onboarding always opens on the landing,
 * so this is the only gate skeleton the flow needs.
 */
export function OnbLandingSkeleton() {
  return (
    <div className="onb-shell" role="status" aria-busy="true">
      <div className="onb-top">
        <span />
        <LanguageSelector />
      </div>
      <div className="onb-card landing onb-skel" aria-hidden>
        <Skeleton className="onb-skel-mark" />
        <div className="onb-skel-title">
          <span className="uisk" />
          <span className="uisk" />
        </div>
        <div className="onb-skel-lead">
          <span className="uisk" />
          <span className="uisk" />
        </div>
        <div className="onb-rail">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} className={`bar${i === 0 ? ' on' : ''}`} />
          ))}
        </div>
        <Skeleton className="onb-skel-btn" />
        <div className="onb-skel-foot">
          <span className="uisk" />
        </div>
        <div className="onb-inviter">
          <span className="uisk onb-skel-avatar" />
          <span className="onb-skel-inviter">
            <span className="uisk" />
            <span className="uisk" />
          </span>
        </div>
      </div>
    </div>
  );
}
