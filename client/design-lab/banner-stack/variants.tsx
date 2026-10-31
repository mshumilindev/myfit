import { useState, type ReactNode } from 'react';
import { Icon } from '../../src/ui';
import { Button, IconButton } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Chip } from '../../src/components/ui/Chip';
import { IconTile } from '../../src/components/ui/IconTile';
import { ProgressBar } from '../../src/components/ui/ProgressBar';
import { Ring } from '../../src/components/ui/Ring';
import { Sheet } from '../../src/components/ui/Overlays';
import { Segmented } from '../../src/components/ui/Segmented';
import { Tag } from '../../src/components/ui/Tag';
import { NudgeStack as Baseline, type Nudge } from '../../src/components/NudgeStack';
import type { Tone } from '../../src/components/ui/tones';

/** Advisory type → kit colour family (same map the production stack uses). */
const TONE: Record<Nudge['tone'], Tone> = {
  readiness: 'kcal',
  recovery: 'accent',
  analysis: 'injury',
  suggest: 'active',
  plan: 'accent',
  body: 'neutral',
  rest: 'rest',
  learn: 'learn',
  energy: 'kcal',
};

type Items = Nudge[];
type Expand = 'cards' | 'grouped' | 'accordion' | 'tabs' | 'pager' | 'checklist';

type RowP = { label: ReactNode; sub?: ReactNode; icon?: ReactNode; trailing?: ReactNode; check?: boolean; chevron?: boolean; dense?: boolean; onClick?: () => void };
const ListRow = ({ label, sub, icon, trailing, check, chevron, onClick }: RowP) => (
  <button type="button" className="bl-row2" onClick={onClick} aria-pressed={check}>
    {icon}
    <span className="bl-text"><span className="nudge-title">{label}</span>{sub && <span className="nudge-kicker">{sub}</span>}</span>
    {check !== undefined && <Icon name={check ? 'check-circle' : 'circle'} />}
    {trailing}
    {chevron && <Icon name="caret-right" className="nudge-chev" />}
  </button>
);
const GroupedList = ({ children, header }: { children: ReactNode; header?: ReactNode }) => (
  <Card tone="neutral" opaque pad="sm" className="bl-glist">{header && <div className="bl-sec">{header}</div>}{children}</Card>
);

const Glyph = ({ n, size = 34 }: { n: Nudge; size?: number }) => (
  <IconTile tone={TONE[n.tone]} size={size as 30} icon={n.icon} />
);

const Mini = ({ n, onClick, chev = true }: { n: Nudge; onClick?: () => void; chev?: boolean }) => (
  <Card as="button" tone={TONE[n.tone]} opaque className="bl-mini" onClick={onClick}>
    <Glyph n={n} />
    <span className="bl-text">
      <span className="nudge-kicker">{n.kicker}</span>
      <span className="nudge-title">{n.title}</span>
    </span>
    {chev && <Icon name="caret-right" className="nudge-chev" />}
  </Card>
);

const Full = ({ n, close }: { n: Nudge; close: () => void }) => (
  <Card tone={TONE[n.tone]} className="nudge-full bl-full">
    <div className="nudge-card-head">
      <Glyph n={n} size={30} />
      <span className="nudge-kicker">{n.kicker}</span>
    </div>
    <div className="nudge-card-title">{n.title}</div>
    {n.body && <div className="nudge-card-body">{n.body}</div>}
    {n.actions && <div className="nudge-card-acts">{n.actions(close)}</div>}
  </Card>
);

const group = (n: Nudge) =>
  n.tone === 'readiness' || n.tone === 'recovery' || n.tone === 'rest' || n.tone === 'analysis'
    ? 'Body'
    : n.tone === 'plan' || n.tone === 'suggest' || n.tone === 'energy'
      ? 'Training'
      : 'Other';

/** Every variant opens a drawer with all banners; the arrangement inside differs. */
function Expanded({
  kind,
  items,
  start,
  onClose,
}: {
  kind: Expand;
  items: Items;
  start: number;
  onClose: () => void;
}) {
  const [i, setI] = useState(start);
  const [open, setOpen] = useState<string | null>(items[start]?.id ?? null);
  const [tab, setTab] = useState('All');
  const [done, setDone] = useState<string[]>([]);
  let body: ReactNode;
  if (kind === 'cards') {
    body = items.map((n) => <Full key={n.id} n={n} close={onClose} />);
  } else if (kind === 'grouped') {
    const now = items.filter((n) => n.priority >= 50);
    const later = items.filter((n) => n.priority < 50);
    body = (
      <>
        <div className="bl-sec">Now</div>
        {now.map((n) => (
          <Full key={n.id} n={n} close={onClose} />
        ))}
        {later.length > 0 && <div className="bl-sec">Later</div>}
        {later.map((n) => (
          <Mini key={n.id} n={n} chev={false} />
        ))}
      </>
    );
  } else if (kind === 'accordion') {
    body = (
      <GroupedList>
        {items.map((n) => (
          <div key={n.id}>
            <ListRow
              label={n.title}
              sub={n.kicker}
              icon={<Glyph n={n} size={30} />}
              trailing={<Icon name={open === n.id ? 'caret-up' : 'caret-down'} />}
              onClick={() => setOpen(open === n.id ? null : n.id)}
            />
            {open === n.id && (
              <div className="bl-acc-body">
                {n.body}
                {n.actions && <div className="nudge-card-acts">{n.actions(onClose)}</div>}
              </div>
            )}
          </div>
        ))}
      </GroupedList>
    );
  } else if (kind === 'tabs') {
    const tabs = ['All', ...Array.from(new Set(items.map(group)))];
    body = (
      <>
        <Segmented
          label="Category"
          options={tabs.map((t) => ({ value: t, label: t }))}
          value={tab}
          onChange={setTab}
        />
        {items
          .filter((n) => tab === 'All' || group(n) === tab)
          .map((n) => (
            <Full key={n.id} n={n} close={onClose} />
          ))}
      </>
    );
  } else if (kind === 'pager') {
    const n = items[i];
    body = (
      <>
        <Full n={n} close={onClose} />
        <div className="bl-pager">
          <IconButton
            icon="caret-left"
            label="Back"
            variant="fill"
            shape="round"
            size="sm"
            disabled={i === 0}
            onClick={() => setI(i - 1)}
          />
          <span className="bl-dots" aria-hidden>
            {items.map((x, k) => (
              <i key={x.id} className={k === i ? 'on' : ''} />
            ))}
          </span>
          <IconButton
            icon="caret-right"
            label="Next"
            variant="fill"
            shape="round"
            size="sm"
            disabled={i === items.length - 1}
            onClick={() => setI(i + 1)}
          />
        </div>
      </>
    );
  } else {
    body = (
      <GroupedList>
        {items.map((n) => {
          const ok = done.includes(n.id);
          return (
            <ListRow
              key={n.id}
              label={n.title}
              sub={n.kicker}
              icon={<Glyph n={n} size={30} />}
              check={ok}
              onClick={() => setDone(ok ? done.filter((d) => d !== n.id) : [...done, n.id])}
            />
          );
        })}
      </GroupedList>
    );
  }
  return (
    <Sheet onClose={onClose} label="All advisories" className="bl-sheet" closeLabel="Close">
      <div className="bl-sheet-body">
        <div className="bl-sheet-title">Today&apos;s advice · {items.length}</div>
        {body}
      </div>
    </Sheet>
  );
}

/** Wraps a collapsed form: tap → drawer in the chosen arrangement. */
function Shell({
  items,
  expand,
  children,
}: {
  items: Items;
  expand: Expand;
  children: (open: (i?: number) => void) => ReactNode;
}) {
  const [at, setAt] = useState<number | null>(null);
  return (
    <div className="bl-wrap">
      {children((i = 0) => setAt(i))}
      {at !== null && (
        <Expanded kind={expand} items={items} start={at} onClose={() => setAt(null)} />
      )}
    </div>
  );
}

function useCycle(n: number) {
  const [i, setI] = useState(0);
  return { i, next: () => setI((i + 1) % n), prev: () => setI((i - 1 + n) % n), set: setI };
}

const Dots = ({ n, i }: { n: number; i: number }) => (
  <span className="bl-dots" aria-hidden>
    {Array.from({ length: n }, (_, k) => (
      <i key={k} className={k === i ? 'on' : ''} />
    ))}
  </span>
);

type VProps = { items: Items };

/* 02 — Deck with a counter badge */
function V02({ items }: VProps) {
  const c = useCycle(items.length);
  return (
    <Shell items={items} expand="cards">
      {(open) => (
        <div className="bl-deck2">
          <div className="bl-peek" />
          <div className="bl-peek bl-peek-2" />
          <Mini n={items[c.i]} chev={false} onClick={() => open(c.i)} />
          <Tag tone="neutral" className="bl-count">
            {c.i + 1} / {items.length}
          </Tag>
          <IconButton icon="caret-right" label="Next" variant="ghost" size="sm" className="bl-nextfab" onClick={c.next} />
        </div>
      )}
    </Shell>
  );
}

/* 03 — One card + dots, arrows */
function V03({ items }: VProps) {
  const c = useCycle(items.length);
  return (
    <Shell items={items} expand="cards">
      {(open) => (
        <>
          <Mini n={items[c.i]} onClick={() => open(c.i)} />
          <div className="bl-bar">
            <IconButton icon="caret-left" label="Back" variant="ghost" size="sm" onClick={c.prev} />
            <Dots n={items.length} i={c.i} />
            <IconButton icon="caret-right" label="Next" variant="ghost" size="sm" onClick={c.next} />
          </div>
        </>
      )}
    </Shell>
  );
}

/* 04 — Snap carousel, next card peeks */
function V04({ items }: VProps) {
  return (
    <Shell items={items} expand="grouped">
      {(open) => (
        <div className="bl-snap">
          {items.map((n, i) => (
            <Mini key={n.id} n={n} chev={false} onClick={() => open(i)} />
          ))}
        </div>
      )}
    </Shell>
  );
}

/* 05 — One-line ticker with +N */
function V05({ items }: VProps) {
  const n = items[0];
  return (
    <Shell items={items} expand="cards">
      {(open) => (
        <Card as="button" tone={TONE[n.tone]} opaque pad="sm" className="bl-line" onClick={() => open(0)}>
          <Glyph n={n} size={26} />
          <span className="nudge-title">{n.title}</span>
          {items.length > 1 && <Tag tone="neutral">+{items.length - 1}</Tag>}
          <Icon name="caret-right" className="nudge-chev" />
        </Card>
      )}
    </Shell>
  );
}

/* 06 — Chip strip */
function V06({ items }: VProps) {
  return (
    <Shell items={items} expand="pager">
      {(open) => (
        <div className="bl-strip">
          {items.map((n, i) => (
            <Chip key={n.id} tone={TONE[n.tone]} icon={n.icon} onClick={() => open(i)}>
              {n.kicker}
            </Chip>
          ))}
        </div>
      )}
    </Shell>
  );
}

/* 07 — Top 2 + "N more" */
function V07({ items }: VProps) {
  return (
    <Shell items={items} expand="cards">
      {(open) => (
        <div className="bl-col">
          {items.slice(0, 2).map((n, i) => (
            <Mini key={n.id} n={n} onClick={() => open(i)} />
          ))}
          {items.length > 2 && (
            <Button variant="ghost" size="sm" fullWidth onClick={() => open(0)}>
              {items.length - 2} more
              <Icon name="caret-right" />
            </Button>
          )}
        </div>
      )}
    </Shell>
  );
}

/* 08 — Section header, inline accordion */
function V08({ items }: VProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bl-wrap">
      <Card as="button" tone="neutral" opaque pad="sm" className="bl-line" onClick={() => setOpen(!open)}>
        <Icon name="lightbulb" />
        <span className="nudge-title">Advice for today</span>
        <Tag tone="accent">{items.length}</Tag>
        <Icon name={open ? 'caret-up' : 'caret-down'} className="nudge-chev" />
      </Card>
      {open && (
        <div className="bl-col bl-inline">
          {items.map((n) => (
            <Full key={n.id} n={n} close={() => setOpen(false)} />
          ))}
        </div>
      )}
    </div>
  );
}

/* 09 — Card with category segments above */
function V09({ items }: VProps) {
  const cats = Array.from(new Set(items.map(group)));
  const [tab, setTab] = useState(cats[0]);
  const shown = items.filter((n) => group(n) === tab)[0] ?? items[0];
  return (
    <Shell items={items} expand="tabs">
      {(open) => (
        <div className="bl-col">
          {cats.length > 1 && (
            <Segmented
              label="Category"
              options={cats.map((t) => ({ value: t, label: t, badge: items.filter((n) => group(n) === t).length }))}
              value={tab}
              onChange={setTab}
            />
          )}
          <Mini n={shown} onClick={() => open(items.indexOf(shown))} />
        </div>
      )}
    </Shell>
  );
}

/* 10 — Row of icon tiles with badges */
function V10({ items }: VProps) {
  return (
    <Shell items={items} expand="pager">
      {(open) => (
        <Card tone="neutral" opaque pad="sm" className="bl-tiles">
          {items.map((n, i) => (
            <button key={n.id} type="button" className="bl-tilebtn" onClick={() => open(i)} aria-label={n.title as string}>
              <Glyph n={n} size={40} />
              <span className="bl-tilelab">{n.kicker}</span>
            </button>
          ))}
        </Card>
      )}
    </Shell>
  );
}

/* 11 — Deck that fans out upward */
function V11({ items }: VProps) {
  const c = useCycle(items.length);
  return (
    <Shell items={items} expand="cards">
      {(open) => (
        <div className="bl-fan" onClick={() => open(c.i)}>
          {[2, 1].map((d) =>
            items[(c.i + d) % items.length] && items.length > d ? (
              <div key={d} className={`bl-fan-card bl-fan-${d}`} />
            ) : null,
          )}
          <Mini n={items[c.i]} chev />
        </div>
      )}
    </Shell>
  );
}

/* 12 — Pill with tone dots */
function V12({ items }: VProps) {
  return (
    <Shell items={items} expand="tabs">
      {(open) => (
        <Card as="button" tone="neutral" opaque pad="sm" className="bl-line" onClick={() => open(0)}>
          <Icon name="lightbulb" />
          <span className="nudge-title">{items.length} things worth a look</span>
          <span className="bl-tonedots" aria-hidden>
            {items.map((n) => (
              <i key={n.id} className={`uit--${TONE[n.tone]}`} />
            ))}
          </span>
          <Icon name="caret-right" className="nudge-chev" />
        </Card>
      )}
    </Shell>
  );
}

/* 13 — Stories: segments on top of one card */
function V13({ items }: VProps) {
  const c = useCycle(items.length);
  return (
    <Shell items={items} expand="cards">
      {(open) => (
        <div className="bl-col">
          <div className="nudge-rail" aria-hidden>
            {items.map((n, k) => (
              <span key={n.id} className={`nudge-seg${k <= c.i ? ' on' : ''}`} />
            ))}
          </div>
          <Mini n={items[c.i]} onClick={() => open(c.i)} />
        </div>
      )}
    </Shell>
  );
}

/* 14 — Hero + mini tiles */
function V14({ items }: VProps) {
  const [hero, ...rest] = items;
  return (
    <Shell items={items} expand="cards">
      {(open) => (
        <div className="bl-col">
          <Card tone={TONE[hero.tone]} emphasis="hero" as="button" className="bl-hero" onClick={() => open(0)}>
            <Glyph n={hero} size={40} />
            <span className="bl-text">
              <span className="nudge-kicker">{hero.kicker}</span>
              <span className="bl-herotitle">{hero.title}</span>
            </span>
          </Card>
          {rest.length > 0 && (
            <div className="bl-strip">
              {rest.map((n, i) => (
                <Chip key={n.id} tone={TONE[n.tone]} icon={n.icon} onClick={() => open(i + 1)}>
                  {n.kicker}
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}

/* 15 — Two-column tiles, first full width */
function V15({ items }: VProps) {
  return (
    <Shell items={items} expand="pager">
      {(open) => (
        <div className="bl-grid2">
          {items.map((n, i) => (
            <Card key={n.id} as="button" tone={TONE[n.tone]} opaque className={`bl-tile${i === 0 ? ' wide' : ''}`} onClick={() => open(i)}>
              <Glyph n={n} size={30} />
              <span className="nudge-title bl-wrapt">{n.title}</span>
            </Card>
          ))}
        </div>
      )}
    </Shell>
  );
}

/* 16 — Deck with Done / Later quick actions */
function V16({ items }: VProps) {
  const [gone, setGone] = useState<string[]>([]);
  const left = items.filter((n) => !gone.includes(n.id));
  return (
    <Shell items={left.length ? left : items} expand="grouped">
      {(open) =>
        left.length === 0 ? (
          <Card tone="ok" opaque pad="sm" className="bl-line">
            <Icon name="check-circle" />
            <span className="nudge-title">All done for today</span>
          </Card>
        ) : (
          <div className="bl-col">
            <Mini n={left[0]} onClick={() => open(0)} />
            <div className="bl-acts">
              <Button size="sm" variant="secondary" onClick={() => setGone([...gone, left[0].id])}>
                Done
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setGone([...gone, left[0].id])}>
                Later
              </Button>
              <span className="bl-muted">{left.length} left</span>
            </div>
          </div>
        )
      }
    </Shell>
  );
}

/* 17 — Now / Later groups, three visible */
function V17({ items }: VProps) {
  const now = items.filter((n) => n.priority >= 50);
  const later = items.filter((n) => n.priority < 50);
  return (
    <Shell items={items} expand="grouped">
      {(open) => (
        <GroupedList header="Now">
          {now.slice(0, 2).map((n) => (
            <ListRow key={n.id} label={n.title} sub={n.kicker} icon={<Glyph n={n} size={30} />} chevron onClick={() => open(items.indexOf(n))} />
          ))}
          {later.length > 0 && (
            <ListRow label={`${later.length} for later`} icon={<Icon name="clock" />} chevron onClick={() => open(now.length)} />
          )}
        </GroupedList>
      )}
    </Shell>
  );
}

/* 18 — Timeline rail with dots */
function V18({ items }: VProps) {
  return (
    <Shell items={items} expand="accordion">
      {(open) => (
        <div className="bl-timeline">
          {items.map((n, i) => (
            <button key={n.id} type="button" className="bl-tl-row" onClick={() => open(i)}>
              <i className={`bl-tl-dot uit--${TONE[n.tone]}`} />
              <span className="bl-text">
                <span className="nudge-kicker">{n.kicker}</span>
                <span className="nudge-title">{n.title}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Shell>
  );
}

/* 19 — Bento: one large + two small */
function V19({ items }: VProps) {
  const [a, b, c] = items;
  return (
    <Shell items={items} expand="accordion">
      {(open) => (
        <div className="bl-bento">
          <Card as="button" tone={TONE[a.tone]} opaque className="bl-big" onClick={() => open(0)}>
            <Glyph n={a} size={36} />
            <span className="bl-herotitle">{a.title}</span>
            <span className="nudge-kicker">{a.kicker}</span>
          </Card>
          {[b, c].filter(Boolean).map((n, i) => (
            <Card key={n.id} as="button" tone={TONE[n.tone]} opaque className="bl-small" onClick={() => open(i + 1)}>
              <Glyph n={n} size={28} />
              <span className="nudge-title bl-wrapt">{n.title}</span>
            </Card>
          ))}
        </div>
      )}
    </Shell>
  );
}

/* 20 — Atlas-style bubble with arrows */
function V20({ items }: VProps) {
  const c = useCycle(items.length);
  const n = items[c.i];
  return (
    <Shell items={items} expand="cards">
      {(open) => (
        <Card tone="atlas" opaque className="bl-bubble">
          <button type="button" className="bl-bubble-main" onClick={() => open(c.i)}>
            <span className="nudge-kicker">Atlas · {n.kicker}</span>
            <span className="bl-bubble-title">{n.title}</span>
          </button>
          <div className="bl-bar">
            <IconButton icon="caret-left" label="Back" variant="ghost" size="sm" onClick={c.prev} />
            <span className="bl-muted">{c.i + 1} / {items.length}</span>
            <IconButton icon="caret-right" label="Next" variant="ghost" size="sm" onClick={c.next} />
          </div>
        </Card>
      )}
    </Shell>
  );
}

/* 21 — Count buttons per category + list inline */
function V21({ items }: VProps) {
  const cats = Array.from(new Set(items.map(group)));
  const [tab, setTab] = useState<string | null>(null);
  return (
    <div className="bl-wrap">
      <Segmented
        label="Category"
        variant="buttons"
        options={cats.map((t) => ({ value: t, label: t, badge: items.filter((n) => group(n) === t).length }))}
        value={tab}
        onChange={(v) => setTab(tab === v ? null : v)}
      />
      {tab && (
        <div className="bl-col bl-inline">
          {items.filter((n) => group(n) === tab).map((n) => (
            <Full key={n.id} n={n} close={() => setTab(null)} />
          ))}
        </div>
      )}
    </div>
  );
}

/* 22 — Ring: x of N reviewed */
function V22({ items }: VProps) {
  return (
    <Shell items={items} expand="checklist">
      {(open) => (
        <Card as="button" tone="neutral" opaque className="bl-ringcard" onClick={() => open(0)}>
          <Ring value={0} size={52} width={5} label="0 reviewed">
            <b>{items.length}</b>
          </Ring>
          <span className="bl-text">
            <span className="nudge-kicker">Today</span>
            <span className="nudge-title">{items[0].title}</span>
            <span className="bl-muted">{items.length - 1 > 0 ? `and ${items.length - 1} more` : 'nothing else'}</span>
          </span>
          <Icon name="caret-right" className="nudge-chev" />
        </Card>
      )}
    </Shell>
  );
}

/* 23 — Segmented progress bar + one-line title */
function V23({ items }: VProps) {
  const c = useCycle(items.length);
  return (
    <Shell items={items} expand="cards">
      {(open) => (
        <Card as="button" tone={TONE[items[c.i].tone]} opaque className="bl-col bl-segcard" onClick={() => open(c.i)}>
          <ProgressBar value={0} segments={items.map((n) => ({ value: 1, tone: TONE[n.tone] }))} height={6} />
          <span className="bl-row">
            <Glyph n={items[c.i]} size={28} />
            <span className="nudge-title">{items[c.i].title}</span>
          </span>
        </Card>
      )}
    </Shell>
  );
}

/* 24 — Last three as list rows + "All (N)" */
function V24({ items }: VProps) {
  return (
    <Shell items={items} expand="cards">
      {(open) => (
        <GroupedList>
          {items.slice(0, 3).map((n, i) => (
            <ListRow key={n.id} dense label={n.title} sub={n.kicker} icon={<Glyph n={n} size={28} />} chevron onClick={() => open(i)} />
          ))}
          {items.length > 3 && <ListRow dense label={`All advice (${items.length})`} chevron onClick={() => open(0)} />}
        </GroupedList>
      )}
    </Shell>
  );
}

const baseline = ({ items }: VProps) => <Baseline nudges={items} />;

export const VARIANTS: { name: string; idea: string; render: (p: VProps) => ReactNode }[] = [
  { name: 'Колода + лічильник', idea: 'Поточна колода зі «1 / N» і кнопкою далі; тап відкриває всі картки', render: V02 },
  { name: 'Одна картка + крапки', idea: 'Без «підглядання», стрілки й крапки; тап відкриває всі картки', render: V03 },
  { name: 'Слайдер із виглядом наступної', idea: 'Горизонтальний snap, наступна картка визирає; перегляд за пріоритетом', render: V04 },
  { name: 'Рядок-тікер', idea: 'Один рядок з головною порадою й «+N»; найменше місця', render: V05 },
  { name: 'Стрічка чипів', idea: 'Чип на кожен баннер (іконка + категорія); тап відкриває цей баннер по одному', render: V06 },
  { name: 'Топ-2 + «ще N»', idea: 'Дві найважливіші картки відразу, решта за кнопкою', render: V07 },
  { name: 'Заголовок-акордеон', idea: 'Один рядок «Поради на сьогодні · N», розгортається прямо на сторінці', render: V08 },
  { name: 'Картка + категорії', idea: 'Сегменти за категорією над однією карткою', render: V09 },
  { name: 'Ряд плиток-іконок', idea: 'Іконка на кожен баннер, тап відкриває його по одному', render: V10 },
  { name: 'Віяло вгору', idea: 'Колода з картками, що визирають зверху', render: V11 },
  { name: 'Пілюля з крапками тонів', idea: 'Один рядок із кольоровими крапками типів; перегляд за вкладками', render: V12 },
  { name: 'Сторіс-сегменти зверху', idea: 'Смужки прогресу над карткою (як зараз унизу), без колоди', render: V13 },
  { name: 'Герой + чипи', idea: 'Головний баннер великий, решта чипами', render: V14 },
  { name: 'Сітка 2 колонки', idea: 'Перша плитка на всю ширину, решта по дві', render: V15 },
  { name: 'Колода з «Виконано / Пізніше»', idea: 'Швидкі дії прямо під карткою, лічильник залишку', render: V16 },
  { name: 'Зараз / Пізніше', idea: 'Групи за терміновістю, список рядків', render: V17 },
  { name: 'Таймлайн із крапками', idea: 'Вертикальна лінія з крапками кольору типу', render: V18 },
  { name: 'Бенто 1 + 2', idea: 'Одна велика картка й дві малі', render: V19 },
  { name: 'Бульбашка Atlas', idea: 'Порада як репліка тренера Atlas зі стрілками', render: V20 },
  { name: 'Кнопки-категорії', idea: 'Кнопки з лічильниками, список відкривається на сторінці', render: V21 },
  { name: 'Кільце «N справ»', idea: 'Кільце з числом і головна порада; чекліст у шторці', render: V22 },
  { name: 'Сегментна смуга', idea: 'Кольорова смуга зі сегментів на кожну пораду і назва', render: V23 },
  { name: 'Три рядки + «Усі»', idea: 'Три останні як рядки списку, «Усі поради (N)»', render: V24 },
];
// Index 0 of the URL (?bv=0) is the baseline as it ships today; ?bv=1.. are the variants above (bv=1 is VARIANTS[0]).
export { baseline };
export { VARIANTS as _V };
