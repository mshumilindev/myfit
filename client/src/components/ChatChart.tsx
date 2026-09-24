/**
 * A small line chart inside an Atlas chat bubble: title, first → last value,
 * and a sparkline with the min/max marked. No axes — it's a glance, not a report.
 */
import type { Chart } from '../atlas/intentKit';

export function ChatChart({ chart, locale }: { chart: Chart; locale: string }) {
  const pts = chart.points;
  if (pts.length < 2) return null;
  const W = 240;
  const H = 64;
  const pad = 6;
  const vs = pts.map((p) => p.v);
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  const span = hi - lo || 1;
  const t0 = pts[0].at;
  const t1 = pts[pts.length - 1].at;
  const tspan = t1 - t0 || 1;
  const x = (at: number) => pad + ((at - t0) / tspan) * (W - pad * 2);
  const y = (v: number) => (hi === lo ? H / 2 : H - pad - ((v - lo) / span) * (H - pad * 2));
  const d = pts
    .map((p, i) => `${i ? 'L' : 'M'}${x(p.at).toFixed(1)},${y(p.v).toFixed(1)}`)
    .join(' ');
  const area = `${d} L${x(t1).toFixed(1)},${H - pad} L${x(t0).toFixed(1)},${H - pad} Z`;
  const fmt = (v: number) =>
    `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(v)}${chart.unit ? ` ${chart.unit}` : ''}`;
  const date = (at: number) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(at);
  const last = pts[pts.length - 1];
  return (
    <figure className="atl-chart" aria-label={`${chart.title}: ${fmt(pts[0].v)} → ${fmt(last.v)}`}>
      <figcaption>
        <span>{chart.title}</span>
        <b>
          {fmt(pts[0].v)} → {fmt(last.v)}
        </b>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
        <path d={area} className="atl-chart-area" />
        <path d={d} className="atl-chart-line" />
        {pts.map((p) => (
          <circle
            key={p.at}
            cx={x(p.at)}
            cy={y(p.v)}
            r={p === last ? 3.2 : 1.8}
            className="atl-chart-dot"
          />
        ))}
      </svg>
      <div className="atl-chart-axis">
        <span>{date(t0)}</span>
        <span>{date(t1)}</span>
      </div>
    </figure>
  );
}
