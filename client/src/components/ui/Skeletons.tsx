import { Skeleton } from './Skeleton';

/** Screen-shaped loading placeholders (Today, people list, Profile). Built from the kit Skeleton. */
export function ScreenSkeleton({ label }: { label?: string }) {
  const recent = [
    { title: 120, sub: 180 },
    { title: 96, sub: 164 },
    { title: 130, sub: 150 },
  ] as const;
  return (
    <div className="screen screen-skel" role="status" aria-live="polite" aria-label={label}>
      <div className="skel-head">
        <Skeleton style={{ width: 120, height: 10 }} />
        <Skeleton style={{ width: 210, height: 26 }} />
      </div>
      <div className="skel-week">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} style={{ flex: 1, height: 46 }} />
        ))}
      </div>
      <Skeleton className="skel-cta" />
      <div className="skel-tiles">
        <Skeleton style={{ flex: 1, height: 92 }} />
        <Skeleton style={{ flex: 1, height: 92 }} />
      </div>
      <div className="skel-recent">
        <Skeleton style={{ width: 70, height: 9 }} />
        {recent.map((row, i) => (
          <div key={i} className="skel-recent-row">
            <Skeleton style={{ width: 40, height: 9 }} />
            <div className="skel-recent-body">
              <Skeleton style={{ width: row.title, height: 13 }} />
              <Skeleton style={{ width: row.sub, height: 9 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** AD-06 people rows, or S-50 avatar-row when `withMeta` is false. */
export function RowListSkeleton({
  rows = 3,
  withAvatar = true,
  withMeta = true,
  className,
}: {
  rows?: number;
  withAvatar?: boolean;
  withMeta?: boolean;
  className?: string;
}) {
  return (
    <div
      className={['row-list-skel', className].filter(Boolean).join(' ')}
      aria-hidden
      role="presentation"
    >
      {withMeta && <Skeleton style={{ width: 120, height: 10 }} />}
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="row-list-skel-item">
          {withAvatar && (
            <Skeleton
              className="row-list-skel-avatar"
              style={withMeta ? undefined : { width: 44, height: 44, borderRadius: 12 }}
            />
          )}
          {withMeta ? (
            <>
              <Skeleton className="row-list-skel-line" />
              <Skeleton className="row-list-skel-meta" style={{ width: 70 }} />
              <Skeleton className="row-list-skel-meta" style={{ width: 90 }} />
            </>
          ) : (
            <div className="row-list-skel-body">
              <Skeleton style={{ width: '40%', height: 13 }} />
              <Skeleton style={{ width: '65%', height: 9 }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** O-10 · Profile · avatar & people skeleton. */
/**
 * Profile skeleton — taken 1:1 from the Body-metrics design (§7). Same blocks,
 * sizes and order as the real page: identity card (avatar, 3 photo actions,
 * name line, 3 identity fields) → section label → weight-hero card →
 * Height+BMI two-up → weight-trend chart → labelled ~4 recent-entry rows →
 * 3×2 optional-composition grid → settings rows. Neutral shimmer, no reflow.
 */
export function ProfileSkeleton() {
  const md = 'var(--radius-md)';
  const lg = 'var(--radius-lg)';
  return (
    <div className="profile-skel" aria-hidden role="presentation">
      {/* Identity card */}
      <div className="profile-skel-card">
        <Skeleton className="ur-round" style={{ width: 96, height: 96, alignSelf: 'center' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <Skeleton style={{ flex: 1, height: 40, borderRadius: md }} />
          <Skeleton style={{ flex: 1, height: 40, borderRadius: md }} />
          <Skeleton style={{ flex: 1, height: 40, borderRadius: md }} />
        </div>
        <Skeleton style={{ width: '60%', height: 22 }} />
        <Skeleton style={{ width: '100%', height: 44, borderRadius: md }} />
        <Skeleton style={{ width: '100%', height: 44, borderRadius: md }} />
        <Skeleton style={{ width: '100%', height: 44, borderRadius: md }} />
      </div>

      {/* Body-metrics section label */}
      <Skeleton style={{ width: '40%', height: 12 }} />
      {/* Weight-hero card */}
      <Skeleton style={{ width: '100%', height: 118, borderRadius: lg }} />
      {/* Height + BMI two-up */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Skeleton style={{ height: 78, borderRadius: md }} />
        <Skeleton style={{ height: 78, borderRadius: md }} />
      </div>
      {/* Weight-trend chart */}
      <Skeleton style={{ width: '100%', height: 150, borderRadius: lg }} />
      {/* Recent entries: label + 4 rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Skeleton style={{ width: '35%', height: 12 }} />
        <Skeleton style={{ height: 20 }} />
        <Skeleton style={{ height: 20 }} />
        <Skeleton style={{ height: 20 }} />
        <Skeleton style={{ height: 20 }} />
      </div>
      {/* Optional-composition grid 3×2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} style={{ height: 64, borderRadius: md }} />
        ))}
      </div>
      {/* Settings rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Skeleton style={{ height: 20 }} />
        <Skeleton style={{ height: 20 }} />
        <Skeleton style={{ height: 20 }} />
      </div>
    </div>
  );
}
