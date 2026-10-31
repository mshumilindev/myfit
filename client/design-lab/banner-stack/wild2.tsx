import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from '../../src/ui';
import { Sheet } from '../../src/components/ui/Overlays';
import type { Nudge } from '../../src/components/NudgeStack';

type Items = Nudge[];
const T: Record<Nudge['tone'], string> = {
  readiness: 'kcal', recovery: 'accent', analysis: 'injury', suggest: 'active',
  plan: 'accent', body: 'neutral', rest: 'rest', learn: 'learn', energy: 'kcal',
};
const txt = (n: Nudge) => String(typeof n.title === 'string' ? n.title : n.kicker);

function Detail({ n, onClose }: { n: Nudge; onClose: () => void }) {
  return (
    <Sheet onClose={onClose} label={String(n.kicker)} closeLabel="Close">
      <div className={`bl-detail uit--${T[n.tone]}`}>
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
  return { setAt, sheet };
}

/* Barbell: every advisory is a weight plate — size and the number on it = urgency. Heaviest sits at the collar. */
export function Plates({ items }: { items: Items }) {
  const o = useOpen(items);
  const [sel, setSel] = useState(0);
  const n = items[sel];
  return (
    <div className="bl-wrap bl-barbell">
      <div className="bl-bar-stage">
        <i className="bl-bar-rod" />
        <i className="bl-bar-collar" />
        {items.map((x, i) => (
          <button key={x.id} type="button" aria-label={String(x.kicker)}
            className={`bl-plate uit--${T[x.tone]}${i === sel ? ' on' : ''}`}
            style={{ ['--ph' as string]: `${44 + x.priority * 0.9}px` }} onClick={() => setSel(i)}>
            <b>{x.priority}</b>
            <Icon name={x.icon} />
          </button>
        ))}
        <i className="bl-bar-end" />
      </div>
      <button type="button" className={`bl-bar-text uit--${T[n.tone]}`} onClick={() => o.setAt(sel)}>
        <span className="nudge-kicker">{n.kicker}</span>
        <span className="nudge-title">{n.title}</span>
      </button>
      {o.sheet}
    </div>
  );
}

/* Cable-machine stack: the selector pin picks an advisory; the slabs above it lift off like the weight stack. */
export function Stack({ items }: { items: Items }) {
  const o = useOpen(items);
  const [pin, setPin] = useState(0);
  return (
    <div className="bl-wrap bl-wstack">
      <div className="bl-rail" aria-hidden />
      {items.map((x, i) => (
        <button key={x.id} type="button"
          className={`bl-slab uit--${T[x.tone]}${i < pin ? ' lifted' : ''}${i === pin ? ' on' : ''}`}
          onClick={() => (i === pin ? o.setAt(i) : setPin(i))}>
          <span className="bl-slab-n">{x.priority}</span>
          <span className="bl-text"><span className="nudge-kicker">{x.kicker}</span><span className="nudge-title">{x.title}</span></span>
          {i === pin && <i className="bl-pin-rod" aria-hidden />}
        </button>
      ))}
      {o.sheet}
    </div>
  );
}

/* Split-flap board: the headline flips letter by letter, like a station board. */
export function Flap({ items }: { items: Items }) {
  const o = useOpen(items);
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((x) => (x + 1) % items.length), 6000);
    return () => window.clearInterval(t);
  }, [items.length]);
  const s = txt(items[i]).toUpperCase();
  const n = items[i];
  return (
    <button type="button" className={`bl-board uit--${T[n.tone]}`} onClick={() => o.setAt(i)}>
      <span className="bl-board-top">
        <span>{String(n.kicker).toUpperCase()}</span>
        <span>{i + 1}/{items.length}</span>
      </span>
      <span key={i} className="bl-flaps" aria-label={s}>
        {s.split('').map((c, k) => (
          <i key={k} className="bl-flap" style={{ ['--d' as string]: `${k * 22}ms` }} aria-hidden>{c === ' ' ? ' ' : c}</i>
        ))}
      </span>
      {o.sheet}
    </button>
  );
}

/* Locker row: one locker per advisory; the door swings open on tap. */
export function Lockers({ items }: { items: Items }) {
  const o = useOpen(items);
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="bl-wrap bl-lockers">
      {items.map((x, i) => (
        <div key={x.id} className={`bl-locker uit--${T[x.tone]}${open === i ? ' open' : ''}`}>
          <button type="button" className="bl-inside" onClick={() => o.setAt(i)} tabIndex={open === i ? 0 : -1}>
            <Icon name={x.icon} />
            <span className="nudge-kicker">{x.kicker}</span>
            <span className="bl-in-title">{x.title}</span>
          </button>
          <button type="button" className="bl-door" aria-label={String(x.kicker)} aria-expanded={open === i}
            onClick={() => setOpen(open === i ? null : i)}>
            <i className="bl-vent" /><i className="bl-vent" /><i className="bl-vent" />
            <b className="bl-locker-no">{String(i + 1).padStart(2, '0')}</b>
            <i className="bl-handle" />
          </button>
        </div>
      ))}
      {o.sheet}
    </div>
  );
}

/* Chalk slate: advice written in chalk, a tally of the day; tap to wipe and the next one is written. */
export function Chalk({ items }: { items: Items }) {
  const o = useOpen(items);
  const [i, setI] = useState(0);
  const [wipe, setWipe] = useState(false);
  const n = items[i];
  const next = () => {
    setWipe(true);
    window.setTimeout(() => { setI((x) => (x + 1) % items.length); setWipe(false); }, 320);
  };
  return (
    <div className="bl-slate">
      <button type="button" className={`bl-chalk${wipe ? ' wipe' : ''}`} onClick={() => o.setAt(i)}>
        <span className="bl-chalk-k">{n.kicker}</span>
        <span className="bl-chalk-t">{n.title}</span>
        <svg viewBox="0 0 120 8" className="bl-chalk-u" aria-hidden><path d="M2 5 C30 1 60 7 118 3" /></svg>
      </button>
      <div className="bl-tally">
        {items.map((x, k) => <i key={x.id} className={k === i ? 'on' : ''} />)}
        <button type="button" className="bl-sponge" onClick={next} aria-label="Wipe"><Icon name="eraser" /></button>
      </div>
      {o.sheet}
    </div>
  );
}

export const WILD2: { name: string; idea: string; render: (p: { items: Items }) => ReactNode }[] = [
  { name: 'Блини на штанзі', idea: 'Кожна порада — блин: розмір і число на ньому = терміновість, колір = тип', render: Plates },
  { name: 'Стек тренажера', idea: 'Штифт-селектор обирає пораду, плити над ним піднімаються, як у блочному тренажері', render: Stack },
  { name: 'Табло з літерами', idea: 'Заголовок перекидається по літері, як табло на вокзалі; саме міняє поради', render: Flap },
  { name: 'Шафки', idea: 'Ряд роздягальних шафок, тап відчиняє дверцята, всередині порада', render: Lockers },
  { name: 'Крейдяна дошка', idea: 'Порада написана крейдою, губка стирає й пише наступну, лічильник рисками', render: Chalk },
];
