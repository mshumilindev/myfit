import { useRef, useState, type ReactNode } from 'react';
import { Icon } from '../../src/ui';
import { Button, IconButton } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { IconTile } from '../../src/components/ui/IconTile';
import { Segmented } from '../../src/components/ui/Segmented';
import { Sheet } from '../../src/components/ui/Overlays';
import { Tag } from '../../src/components/ui/Tag';
import type { Tone } from '../../src/components/ui/tones';
import type { Nudge } from '../../src/components/NudgeStack';

/* SPO-41 rules (docs: SPO-41-banner-stack-rules):
   level = honest urgency (Apple HIG): NOW (happens within the day's session) > TODAY (state of the body, advice) > LATER (passive).
   No autoplay. One primary banner with its action in view. "Later" snoozes to tomorrow. */
type Level = 'now' | 'today' | 'later';
const LV: Record<Level, string> = { now: 'Now', today: 'Today', later: 'Later' };
const level = (n: Nudge): Level => (n.priority >= 90 ? 'now' : n.priority >= 50 ? 'today' : 'later');
const TONE: Record<Nudge['tone'], Tone> = {
  readiness: 'kcal', recovery: 'accent', analysis: 'injury', suggest: 'active',
  plan: 'accent', body: 'neutral', rest: 'rest', learn: 'learn', energy: 'kcal',
};
type P = { items: Nudge[] };

const Glyph = ({ n, size = 34 }: { n: Nudge; size?: number }) => (
  <IconTile tone={TONE[n.tone]} size={size as 30} icon={n.icon} />
);
const LevelTag = ({ n }: { n: Nudge }) => (
  <Tag tone={level(n) === 'now' ? 'accent' : 'neutral'}>{LV[level(n)]}</Tag>
);

function Primary({ n, later }: { n: Nudge; later?: () => void }) {
  return (
    <Card tone={TONE[n.tone]} emphasis={level(n) === 'now' ? 'glass' : 'card'} className="bl2-primary">
      <div className="bl2-head">
        <Glyph n={n} size={34} />
        <span className="nudge-kicker">{n.kicker}</span>
        <LevelTag n={n} />
      </div>
      <div className="nudge-card-title">{n.title}</div>
      <div className="nudge-card-body bl2-clamp">{n.body}</div>
      <div className="nudge-card-acts">
        {n.actions?.(() => undefined)}
        {later && (
          <Button variant="ghost" size="sm" onClick={later}>Tomorrow</Button>
        )}
      </div>
    </Card>
  );
}
const Row = ({ n, onClick }: { n: Nudge; onClick?: () => void }) => (
  <button type="button" className="bl2-row" onClick={onClick}>
    <Glyph n={n} size={30} />
    <span className="bl-text">
      <span className="nudge-title">{n.title}</span>
      <span className="nudge-kicker">{n.kicker}</span>
    </span>
    <Icon name="caret-right" className="nudge-chev" />
  </button>
);

/** The shared "all banners" sheet: the same three levels, in order, nothing else to learn. */
function AllSheet({ items, onClose, later }: { items: Nudge[]; onClose: () => void; later: (id: string) => void }) {
  const groups = (['now', 'today', 'later'] as Level[]).map((l) => [l, items.filter((n) => level(n) === l)] as const);
  return (
    <Sheet onClose={onClose} label="All advice" closeLabel="Close" className="bl-sheet">
      <div className="bl-sheet-body">
        <div className="bl-sheet-title">Advice · {items.length}</div>
        {groups.filter(([, g]) => g.length).map(([l, g]) => (
          <section key={l} className="bl2-group">
            <div className="bl2-glabel"><span>{LV[l]}</span><span>{g.length}</span></div>
            {g.map((n) => <Primary key={n.id} n={n} later={() => later(n.id)} />)}
          </section>
        ))}
      </div>
    </Sheet>
  );
}

function useStack(items: Nudge[]) {
  const [gone, setGone] = useState<string[]>([]);
  const [all, setAll] = useState(false);
  const live = items.filter((n) => !gone.includes(n.id));
  const later = (id: string) => setGone((g) => [...g, id]);
  const sheet = all ? <AllSheet items={live} onClose={() => setAll(false)} later={later} /> : null;
  return { live, later, openAll: () => setAll(true), sheet };
}

/* A · Focus + queue: one primary with its action; the next two as quiet rows; "All" at the end. */
export function FocusQueue({ items }: P) {
  const s = useStack(items);
  const [first, ...rest] = s.live;
  if (!first) return null;
  return (
    <div className="bl-wrap bl2-col">
      <Primary n={first} later={() => s.later(first.id)} />
      {rest.length > 0 && (
        <Card tone="neutral" opaque pad="sm" className="bl2-queue">
          {rest.slice(0, 2).map((n) => <Row key={n.id} n={n} onClick={s.openAll} />)}
          {rest.length > 2 && <button type="button" className="bl2-more" onClick={s.openAll}>All advice · {s.live.length}</button>}
        </Card>
      )}
      {s.sheet}
    </div>
  );
}

/* B · Levels: a segmented switch Now / Today / Later with counts; opens on the first level that has something. */
export function Levels({ items }: P) {
  const s = useStack(items);
  const present = (['now', 'today', 'later'] as Level[]).filter((l) => s.live.some((n) => level(n) === l));
  const [pick, setPick] = useState<Level | null>(null);
  const cur = pick && present.includes(pick) ? pick : present[0];
  if (!cur) return null;
  const list = s.live.filter((n) => level(n) === cur);
  return (
    <div className="bl-wrap bl2-col">
      {present.length > 1 && (
        <Segmented
          label="Advice level"
          size="sm"
          options={present.map((l) => ({ value: l, label: LV[l], badge: s.live.filter((n) => level(n) === l).length }))}
          value={cur}
          onChange={setPick}
        />
      )}
      <Primary n={list[0]} later={() => s.later(list[0].id)} />
      {list.length > 1 && (
        <Button variant="ghost" size="sm" fullWidth onClick={s.openAll}>
          {list.length - 1} more · {LV[cur]}
          <Icon name="caret-right" />
        </Button>
      )}
      {s.sheet}
    </div>
  );
}

/* C · Adaptive density: the banner is as big as it is urgent. Nothing urgent → one slim line; urgent → full card. */
export function Adaptive({ items }: P) {
  const s = useStack(items);
  const [open, setOpen] = useState(false);
  const [first, ...rest] = s.live;
  if (!first) return null;
  if (level(first) === 'now') {
    return (
      <div className="bl-wrap bl2-col">
        <Primary n={first} later={() => s.later(first.id)} />
        {rest.length > 0 && (
          <button type="button" className="bl2-slim" onClick={s.openAll}>
            <span className="bl2-dots">{rest.map((n) => <i key={n.id} className={`uit--${TONE[n.tone]}`} />)}</span>
            <span className="nudge-title">{rest.length} more today</span>
            <Icon name="caret-right" className="nudge-chev" />
          </button>
        )}
        {s.sheet}
      </div>
    );
  }
  return (
    <div className="bl-wrap bl2-col">
      <button type="button" className="bl2-slim" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Glyph n={first} size={30} />
        <span className="bl-text">
          <span className="nudge-title">{first.title}</span>
          <span className="nudge-kicker">{first.kicker}</span>
        </span>
        {s.live.length > 1 && <Tag tone="neutral">+{s.live.length - 1}</Tag>}
        <Icon name={open ? 'caret-up' : 'caret-down'} className="nudge-chev" />
      </button>
      {open && (
        <div className="bl2-col">
          <Primary n={first} later={() => s.later(first.id)} />
          {rest.slice(0, 2).map((n) => <Row key={n.id} n={n} onClick={s.openAll} />)}
          {rest.length > 2 && <button type="button" className="bl2-more" onClick={s.openAll}>All advice · {s.live.length}</button>}
        </div>
      )}
      {s.sheet}
    </div>
  );
}

/* D · Paged cards: swipe or buttons, "2 of 5", the next card peeks in. No autoplay, no dots. */
export function Paged({ items }: P) {
  const s = useStack(items);
  const ref = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const go = (k: number) => {
    const el = ref.current;
    if (!el) return;
    const card = el.children[k] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  };
  if (!s.live.length) return null;
  return (
    <div className="bl-wrap bl2-col">
      <div
        ref={ref}
        className="bl2-pager"
        onScroll={(e) => {
          const el = e.currentTarget;
          setI(Math.round(el.scrollLeft / ((el.children[0] as HTMLElement).offsetWidth + 8)));
        }}
      >
        {s.live.map((n) => <Primary key={n.id} n={n} later={() => s.later(n.id)} />)}
      </div>
      {s.live.length > 1 && (
        <div className="bl2-pagebar">
          <span className="bl-muted">{Math.min(i + 1, s.live.length)} of {s.live.length}</span>
          <Button variant="ghost" size="sm" onClick={s.openAll}>All</Button>
          <span className="bl2-pagebtn">
            <IconButton icon="caret-left" label="Previous" variant="fill" shape="round" size="sm" disabled={i === 0} onClick={() => go(i - 1)} />
            <IconButton icon="caret-right" label="Next" variant="fill" shape="round" size="sm" disabled={i >= s.live.length - 1} onClick={() => go(i + 1)} />
          </span>
        </div>
      )}
      {s.sheet}
    </div>
  );
}

export const V2: { name: string; idea: string; render: (p: P) => ReactNode }[] = [
  { name: 'Фокус і черга', idea: 'Один головний баннер із дією, далі тихий список із двох і «Усі»', render: FocusQueue },
  { name: 'Рівні', idea: 'Перемикач Зараз / Сьогодні / Пізніше з лічильниками, відкривається на найтерміновішому', render: Levels },
  { name: 'Адаптивна щільність', idea: 'Розмір баннера = терміновість: нічого термінового — один тонкий рядок, термінове — повна картка', render: Adaptive },
  { name: 'Сторінки', idea: 'Свайп і кнопки, «2 з 5», наступна картка визирає, без автозміни й крапок', render: Paged },
];
