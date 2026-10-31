import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../../src/ui';
import { Card } from '../../src/components/ui/Card';
import { IconTile } from '../../src/components/ui/IconTile';
import { Sheet } from '../../src/components/ui/Overlays';
import type { Nudge } from '../../src/components/NudgeStack';

type Items = Nudge[];
const T: Record<Nudge['tone'], string> = {
  readiness: 'kcal', recovery: 'accent', analysis: 'injury', suggest: 'active',
  plan: 'accent', body: 'neutral', rest: 'rest', learn: 'learn', energy: 'kcal',
};

function Detail({ n, onClose }: { n: Nudge; onClose: () => void }) {
  return (
    <Sheet onClose={onClose} label={String(n.kicker)} closeLabel="Close">
      <div className={`bl-detail uit--${T[n.tone]}`}>
        <IconTile tone={T[n.tone] as 'accent'} size={44} icon={n.icon} />
        <div className="nudge-kicker">{n.kicker}</div>
        <div className="nudge-card-title">{n.title}</div>
        <div className="nudge-card-body">{n.body}</div>
        {n.actions && <div className="nudge-card-acts">{n.actions(onClose)}</div>}
      </div>
    </Sheet>
  );
}

function useOpen(items: Items) {
  const [at, setAt] = useState<number | null>(null);
  const sheet = at !== null && items[at] ? <Detail n={items[at]} onClose={() => setAt(null)} /> : null;
  return { at, setAt, sheet };
}

/* W1 — Heartbeat: one ECG line across the card; every advisory is a spike coloured by type. */
export function Pulse({ items }: { items: Items }) {
  const o = useOpen(items);
  const [sel, setSel] = useState(0);
  const w = 100 / (items.length + 1);
  const pts = ['0,30'];
  items.forEach((n, i) => {
    const x = w * (i + 1);
    const h = 8 + (n.priority / 100) * 22;
    pts.push(`${x - 6},30`, `${x - 3},${30 + 6}`, `${x},${30 - h}`, `${x + 3},36`, `${x + 6},30`);
  });
  pts.push('100,30');
  const n = items[sel];
  return (
    <div className="bl-wrap bl-pulse">
      <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="bl-pulse-line" aria-hidden>
        <polyline points={pts.join(' ')} />
      </svg>
      {items.map((x, i) => (
        <button key={x.id} type="button" className={`bl-spike uit--${T[x.tone]}${i === sel ? ' on' : ''}`}
          style={{ ['--x' as string]: `${w * (i + 1)}%`, ['--h' as string]: `${8 + (x.priority / 100) * 22}` }}
          aria-label={String(x.title)} onClick={() => setSel(i)} />
      ))}
      <button type="button" className={`bl-pulse-text uit--${T[n.tone]}`} onClick={() => o.setAt(sel)}>
        <span className="nudge-kicker">{n.kicker}</span>
        <span className="nudge-title">{n.title}</span>
      </button>
      {o.sheet}
    </div>
  );
}

/* W2 — Orbit: advisories as moons around a centre; tap a moon to bring it to the centre. */
export function Orbit({ items }: { items: Items }) {
  const o = useOpen(items);
  const [sel, setSel] = useState(0);
  const n = items[sel];
  return (
    <Card tone="neutral" opaque className="bl-orbit">
      <div className="bl-orbit-disc">
        <i className="bl-orbit-ring" />
        {items.map((x, i) => {
          const a = (i / items.length) * Math.PI * 2 - Math.PI / 2;
          return (
            <button key={x.id} type="button" aria-label={String(x.kicker)}
              className={`bl-moon uit--${T[x.tone]}${i === sel ? ' on' : ''}`}
              style={{ ['--dx' as string]: Math.cos(a).toFixed(3), ['--dy' as string]: Math.sin(a).toFixed(3) }}
              onClick={() => setSel(i)}>
              <Icon name={x.icon} />
            </button>
          );
        })}
        <b className="bl-orbit-n">{items.length}</b>
      </div>
      <button type="button" className={`bl-orbit-text uit--${T[n.tone]}`} onClick={() => o.setAt(sel)}>
        <span className="nudge-kicker">{n.kicker}</span>
        <span className="nudge-title">{n.title}</span>
      </button>
      {o.sheet}
    </Card>
  );
}

/* W3 — Sticky notes: a slightly rotated pile of paper notes; tap lifts one off. */
export function Sticky({ items }: { items: Items }) {
  const o = useOpen(items);
  const [gone, setGone] = useState<string[]>([]);
  const left = items.filter((n) => !gone.includes(n.id));
  const rot = [-2.2, 1.6, -0.8, 2.4, -1.4, 0.9];
  return (
    <div className="bl-wrap bl-sticky">
      {left.length === 0 && <div className="bl-muted">Clean desk ✓</div>}
      {left.slice(0, 3).reverse().map((n, k, arr) => {
        const top = k === arr.length - 1;
        return (
          <button key={n.id} type="button" className={`bl-note uit--${T[n.tone]}${top ? ' top' : ''}`}
            style={{ ['--r' as string]: `${rot[items.indexOf(n) % 6]}deg`, ['--k' as string]: arr.length - 1 - k }}
            onClick={() => (top ? o.setAt(items.indexOf(n)) : undefined)}>
            <span className="bl-pin" />
            <span className="nudge-kicker">{n.kicker}</span>
            <span className="bl-note-title">{n.title}</span>
            {top && (
              <span className="bl-peel" role="button" tabIndex={0} aria-label="Peel off"
                onClick={(e) => { e.stopPropagation(); setGone([...gone, n.id]); }}
                onKeyDown={(e) => { if (e.key === 'Enter') setGone([...gone, n.id]); }}>
                <Icon name="check" />
              </span>
            )}
          </button>
        );
      })}
      {o.sheet}
    </div>
  );
}

/* W4 — Radio tuner: a ruler with ticks; a needle you slide between advisories. */
export function Tuner({ items }: { items: Items }) {
  const o = useOpen(items);
  const [v, setV] = useState(0);
  const n = items[v];
  return (
    <Card tone="neutral" opaque className="bl-tuner">
      <div className="bl-ruler" aria-hidden>
        {Array.from({ length: items.length * 6 + 1 }, (_, i) => (
          <i key={i} className={i % 6 === 0 ? 'big' : ''} />
        ))}
        <b className="bl-needle" style={{ ['--p' as string]: items.length > 1 ? v / (items.length - 1) : 0 }} />
      </div>
      <input type="range" min={0} max={items.length - 1} step={1} value={v} className="bl-range"
        aria-label="Tune advice" onChange={(e) => setV(Number(e.target.value))} />
      <button type="button" className={`bl-tuner-text uit--${T[n.tone]}`} onClick={() => o.setAt(v)}>
        <IconTile tone={T[n.tone] as 'accent'} size={30} icon={n.icon} />
        <span className="bl-text"><span className="nudge-kicker">{n.kicker}</span><span className="nudge-title">{n.title}</span></span>
      </button>
      {o.sheet}
    </Card>
  );
}

/* W5 — Ticket stub: a perforated ticket per advice; “tear” stamps it as read. */
export function Ticket({ items }: { items: Items }) {
  const o = useOpen(items);
  const [torn, setTorn] = useState<string[]>([]);
  const left = items.filter((n) => !torn.includes(n.id));
  const n = left[0];
  if (!n) return <div className="bl-wrap bl-muted">All stubs torn ✓</div>;
  return (
    <div className="bl-wrap">
      <div className={`bl-ticket uit--${T[n.tone]}`}>
        <button type="button" className="bl-ticket-main" onClick={() => o.setAt(items.indexOf(n))}>
          <span className="nudge-kicker">{n.kicker}</span>
          <span className="nudge-title">{n.title}</span>
        </button>
        <i className="bl-perf" aria-hidden />
        <button type="button" className="bl-stub" onClick={() => setTorn([...torn, n.id])} aria-label="Tear off">
          <b>{left.length}</b>
          <Icon name="scissors" />
        </button>
      </div>
      {o.sheet}
    </div>
  );
}

/* W6 — Day thermometer: a vertical gauge from “do now” to “whenever”; advisories sit at their priority. */
export function Gauge({ items }: { items: Items }) {
  const o = useOpen(items);
  return (
    <Card tone="neutral" opaque className="bl-gauge">
      <div className="bl-gauge-axis" aria-hidden>
        <span>Now</span><i /><span>Later</span>
      </div>
      <div className="bl-gauge-list">
        {items.map((n, i) => (
          <button key={n.id} type="button" className={`bl-gauge-row uit--${T[n.tone]}`} onClick={() => o.setAt(i)}
            style={{ ['--w' as string]: `${Math.max(38, n.priority)}%` }}>
            <span className="bl-gauge-fill" />
            <Icon name={n.icon} />
            <span className="nudge-title">{n.title}</span>
          </button>
        ))}
      </div>
      {o.sheet}
    </Card>
  );
}

/* W7 — Tarot fan: cards fanned from the bottom corner; tap lifts one. */
export function Fan({ items }: { items: Items }) {
  const o = useOpen(items);
  const [up, setUp] = useState(0);
  const m = (items.length - 1) / 2;
  return (
    <div className="bl-wrap bl-fanx">
      {items.map((n, i) => (
        <button key={n.id} type="button" className={`bl-tarot uit--${T[n.tone]}${i === up ? ' up' : ''}`}
          style={{ ['--a' as string]: `${(i - m) * 9}deg`, ['--i' as string]: i }}
          onClick={() => (i === up ? o.setAt(i) : setUp(i))}>
          <Icon name={n.icon} />
          <span className="nudge-kicker">{n.kicker}</span>
          {i === up && <span className="bl-tarot-title">{n.title}</span>}
        </button>
      ))}
      {o.sheet}
    </div>
  );
}

/* W8 — Typewriter: Atlas types the top advice live; keys at the side flip lines. */
export function Typer({ items }: { items: Items }) {
  const o = useOpen(items);
  const [i, setI] = useState(0);
  const [k, setK] = useState(0);
  const txt = String(typeof items[i].title === 'string' ? items[i].title : items[i].kicker);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    setK(0);
    timer.current = window.setInterval(() => setK((x) => (x < txt.length ? x + 1 : x)), 28);
    return () => window.clearInterval(timer.current);
  }, [i, txt]);
  return (
    <Card tone="atlas" opaque className="bl-typer">
      <div className="bl-typer-top">
        <span className="nudge-kicker">Atlas · {items[i].kicker}</span>
        <span className="bl-keys">
          {items.map((x, j) => (
            <button key={x.id} type="button" className={j === i ? 'on' : ''} aria-label={String(x.kicker)} onClick={() => setI(j)} />
          ))}
        </span>
      </div>
      <button type="button" className="bl-typer-line" onClick={() => o.setAt(i)}>
        {txt.slice(0, k)}<i className="bl-caret" />
      </button>
      {o.sheet}
    </Card>
  );
}

export const WILD: { name: string; idea: string; render: (p: { items: Items }) => ReactNode }[] = [
  { name: 'Пульс', idea: 'ЕКГ-лінія: кожна порада — сплеск, висота = терміновість, колір = тип', render: Pulse },
  { name: 'Орбіта', idea: 'Поради-«місяці» навколо числа; тап виносить пораду в центр', render: Orbit },
  { name: 'Стікери', idea: 'Купка паперових стікерів із кнопкою «відклеїти»', render: Sticky },
  { name: 'Тюнер', idea: 'Радіо-шкала з голкою: крутиш і налаштовуєшся на пораду', render: Tuner },
  { name: 'Квиток', idea: 'Квиток із перфорацією, «відірвати» корінець = прочитано', render: Ticket },
  { name: 'Термометр дня', idea: 'Смуги довжиною за терміновістю від «Зараз» до «Потім»', render: Gauge },
  { name: 'Таро-віяло', idea: 'Карти віялом, тап піднімає одну, другий тап відкриває', render: Fan },
  { name: 'Друкарка Atlas', idea: 'Atlas набирає пораду на очах; клавіші перемикають рядки', render: Typer },
];
