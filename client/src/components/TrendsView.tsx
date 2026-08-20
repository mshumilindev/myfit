/** Trends / Analysis tab: curated insight cards, three across per row.
 *  Card shapes: balance · muscle-list · horizon (30/90/180/365) · trend · stat · tip. */
import { useState } from 'react';
import { computeTrends, type Insight, type Level } from '../trends';
import type { BodyMetrics, Workout } from '../types';
import { useT } from '../i18n';
import { EmptyState, Icon } from '../ui';

const LEVEL_LABEL: Record<Level, string> = {
  risk: 'Risk',
  warn: 'Warning',
  info: 'Info',
  good: 'On track',
};

function Badge({ level }: { level: Level }) {
  return (
    <span className={`ai-badge lvl-${level}`}>
      <span className="ai-badge-dot" />
      {LEVEL_LABEL[level]}
    </span>
  );
}

function Bar({ frac, cls }: { frac: number; cls?: string }) {
  return (
    <span className="ai-bar">
      <span
        className={`ai-bar-fill${cls ? ' ' + cls : ''}`}
        style={{ width: `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%` }}
      />
    </span>
  );
}

function Sparkline({ pts, level }: { pts: number[]; level: Level }) {
  if (pts.length < 2) return null;
  const w = 150;
  const h = 34;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = Math.max(max - min, 1);
  const stroke =
    level === 'good'
      ? 'var(--color-ok)'
      : level === 'risk'
        ? 'var(--color-danger)'
        : level === 'warn'
          ? '#e8933f'
          : 'var(--color-accent)';
  const points = pts
    .map((p, idx) => {
      const x = (idx / (pts.length - 1)) * (w - 4) + 2;
      const y = h - 3 - ((p - min) / span) * (h - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg
      className="ai-spark"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CardTop({ i }: { i: Insight }) {
  return (
    <div className="ai-top">
      {i.kicker && <div className="ai-kicker">{i.kicker}</div>}
      <Badge level={i.level} />
    </div>
  );
}

function BalanceCard({ i }: { i: Insight }) {
  const a = i.aVal ?? 0;
  const b = i.bVal ?? 0;
  const max = Math.max(a, b, 1);
  return (
    <section className={`ai-card ai-balance lvl-${i.level}${i.attention ? ' attention' : ''}`}>
      <CardTop i={i} />
      {i.headline && <div className="ai-headline">{i.headline}</div>}
      <div className="ai-pp">
        <div className="ai-pp-col">
          <span className="ai-pp-lab">{i.aLabel}</span>
          <Bar frac={a / max} cls={i.lowSide === 'a' ? 'low' : ''} />
        </div>
        <div className="ai-pp-col">
          <span className="ai-pp-lab">{i.bLabel}</span>
          <Bar frac={b / max} cls={i.lowSide === 'b' ? 'low' : ''} />
        </div>
      </div>
      <p className="ai-detail">{i.detail}</p>
    </section>
  );
}

function MuscleListCard({ i }: { i: Insight }) {
  return (
    <section className={`ai-card ai-mlist lvl-${i.level}`}>
      <CardTop i={i} />
      <div className="ai-rows">
        {(i.muscles ?? []).map((m) => (
          <div key={m.label} className="ai-row">
            <span className="ai-row-lab">{m.label}</span>
            <Bar frac={m.frac} cls={m.worst ? 'worst' : ''} />
          </div>
        ))}
      </div>
      <p className="ai-detail">{i.detail}</p>
    </section>
  );
}

function HorizonCard({ i }: { i: Insight }) {
  const bars = i.bars ?? [];
  const max = Math.max(...bars.map((b) => b.raw), 1);
  return (
    <section className={`ai-card ai-horizon lvl-${i.level}`}>
      <CardTop i={i} />
      {i.headline && <div className="ai-headline">{i.headline}</div>}
      <div className="ai-hz-cols">
        {bars.map((b) => (
          <div key={b.label} className="ai-hz-col">
            <span className="ai-hz-val num">{b.value}</span>
            <span className="ai-hz-track">
              <span
                className="ai-hz-bar"
                style={{ height: `${Math.round((b.raw / max) * 100)}%` }}
              />
            </span>
            <span className="ai-hz-lab">{b.label}</span>
          </div>
        ))}
      </div>
      <p className="ai-detail">{i.detail}</p>
    </section>
  );
}

function TrendCard({ i }: { i: Insight }) {
  return (
    <section className={`ai-card ai-trend lvl-${i.level}${i.attention ? ' attention' : ''}`}>
      <CardTop i={i} />
      {i.headline && <div className="ai-headline">{i.headline}</div>}
      {i.hero && (
        <div className="ai-hero">
          <span className="num">{i.hero}</span>
          {i.heroUnit && <span className="ai-hero-unit">{i.heroUnit}</span>}
          {i.deltaPct != null && (
            <span className={`ai-delta ${i.deltaPct >= 0 ? 'pos' : 'neg'}`}>
              {i.deltaPct >= 0 ? '+' : '−'}
              {Math.abs(i.deltaPct)}%
            </span>
          )}
        </div>
      )}
      {i.spark && <Sparkline pts={i.spark} level={i.level} />}
      <p className="ai-detail">{i.detail}</p>
    </section>
  );
}

function StatCard({ i }: { i: Insight }) {
  return (
    <section className={`ai-card ai-stat lvl-${i.level}`}>
      <CardTop i={i} />
      <div className="ai-stat-hero">
        <span className="num">{i.hero}</span>
        {i.heroUnit && <span className="ai-stat-unit">{i.heroUnit}</span>}
        {i.deltaPct != null && (
          <span className={`ai-delta ${i.deltaPct >= 0 ? 'pos' : 'neg'}`}>
            {i.deltaPct >= 0 ? '+' : '−'}
            {Math.abs(i.deltaPct)}%
          </span>
        )}
      </div>
      <p className="ai-detail">{i.detail}</p>
    </section>
  );
}

function TipCard({ i }: { i: Insight }) {
  return (
    <section className={`ai-card ai-tip lvl-${i.level}${i.attention ? ' attention' : ''}`}>
      <div className="ai-top">
        <div className="ai-tip-head">
          {i.icon && (
            <span className="ai-tip-icon">
              <Icon name={i.icon} weight="bold" />
            </span>
          )}
          <span className="ai-headline">{i.headline}</span>
        </div>
        <Badge level={i.level} />
      </div>
      <p className="ai-detail">{i.detail}</p>
      {i.action && i.actionHref && (
        <a className="ai-action" href={i.actionHref}>
          {i.action}
        </a>
      )}
    </section>
  );
}

function InsightCard({ i }: { i: Insight }) {
  switch (i.type) {
    case 'balance':
      return <BalanceCard i={i} />;
    case 'muscleList':
      return <MuscleListCard i={i} />;
    case 'horizon':
      return <HorizonCard i={i} />;
    case 'trend':
      return <TrendCard i={i} />;
    case 'stat':
      return <StatCard i={i} />;
    default:
      return <TipCard i={i} />;
  }
}

export function TrendsView({ finished, body }: { finished: Workout[]; body: BodyMetrics }) {
  const { t } = useT();
  const [now] = useState(() => Date.now());

  if (finished.length === 0) {
    return <EmptyState icon="chart-line-up" title={t.trendsEmptyTitle} body={t.trendsEmptyBody} />;
  }

  const { ready, insights } = computeTrends(finished, body, now);

  if (!ready) {
    return <EmptyState icon="chart-line-up" title={t.trendsNeedTitle} body={t.trendsNeedBody} />;
  }
  if (insights.length === 0) {
    return <EmptyState icon="shield-check" title={t.trendsClearTitle} body={t.trendsClearBody} />;
  }

  // Risks always first, then info, then wins — and within each, most severe
  // first. Trimmed to a clean multiple of three (max 12) so every row is full.
  const RANK: Record<Level, number> = { risk: 0, warn: 1, info: 2, good: 3 };
  const sorted = [...insights].sort(
    (a, b) => RANK[a.level] - RANK[b.level] || b.severity - a.severity,
  );
  const keep = Math.min(12, Math.max(3, Math.floor(sorted.length / 3) * 3));
  const laid = sorted.slice(0, keep);

  return (
    <div className="analysis">
      <p className="analysis-lead">{t.trendsLead}</p>
      <div className="analysis-grid analysis-grid-3">
        {laid.map((i) => (
          <InsightCard key={i.key} i={i} />
        ))}
      </div>
    </div>
  );
}
