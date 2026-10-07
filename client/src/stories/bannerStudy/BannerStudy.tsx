import { useEffect, useState } from 'react';
import { Icon } from '../../ui';
import { NudgeStack, type Nudge } from '../../components/NudgeStack';
import { Banner } from '../../components/ui/Banner';
import { Button, IconButton } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Chip, ChipGroup } from '../../components/ui/Chip';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { IconTile } from '../../components/ui/IconTile';
import { OptionCard } from '../../components/ui/OptionCard';
import { Sheet } from '../../components/ui/Overlays';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { Segmented } from '../../components/ui/Segmented';
import { Switch } from '../../components/ui/Switch';
import { concepts, copy as c, items, type Concept, type Item, type ModalKind } from './data';

const glyph = (n: Item) => (
  <IconTile size={30} tone={n.tone}>
    <Icon name={n.icon} />
  </IconTile>
);
const modalNames: Record<ModalKind, string> = {
  feed: 'Картки',
  groups: 'За пріоритетом',
  focus: 'По одній',
  accordion: 'Акордеон',
  checklist: 'Чекліст',
  agenda: 'За часом',
  tabs: 'За категорією',
};
function Empty() {
  return (
    <Card tone="ok" header={c.empty}>
      <p className="ut-muted ut-sm">{c.emptySub}</p>
    </Card>
  );
}
function Row({ n, open, dense = false }: { n: Item; open: () => void; dense?: boolean }) {
  return (
    <ListRow
      label={n.title}
      sub={dense ? undefined : n.category}
      icon={glyph(n)}
      chevron
      onClick={open}
      dense={dense}
    />
  );
}
function Full({ n, act, detail = true }: { n: Item; act: () => void; detail?: boolean }) {
  return (
    <Card tone={n.tone}>
      <div className="bs-col">
        <SectionLabel>{n.category}</SectionLabel>
        <div className="bs-row">
          {glyph(n)}
          <strong>{n.title}</strong>
        </div>
        {detail && <p className="ut-muted ut-sm">{n.body}</p>}
        <Button size="sm" variant="secondary" onClick={act}>
          {n.action}
        </Button>
      </div>
    </Card>
  );
}

function Widget({
  id,
  list,
  open,
  detail,
  dense,
}: {
  id: number;
  list: Item[];
  open: () => void;
  detail: boolean;
  dense: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!list.length) return <Empty />;
  const n = list[index % list.length],
    first = list[0];
  const rows = (ns: Item[]) => (
    <GroupedList>
      {ns.map((x) => (
        <Row key={x.id} n={x} open={open} dense={dense} />
      ))}
    </GroupedList>
  );
  const tile = (x: Item) => (
    <Card key={x.id} as="button" tone={x.tone} pad="sm" onClick={open}>
      <div className="bs-col">
        {glyph(x)}
        <strong>{x.title}</strong>
        {detail && <span className="ut-xs ut-muted">{x.category}</span>}
      </div>
    </Card>
  );
  const full = (x: Item) => <Full n={x} act={open} detail={detail} />;
  const count = (
    <Chip size="sm">
      {list.length} {c.count}
    </Chip>
  );
  const nav = (
    <div className="bs-row bs-between">
      <IconButton
        icon="caret-left"
        label={c.back}
        onClick={() => setIndex((index + list.length - 1) % list.length)}
      />
      <span className="ut-xs ut-muted">
        {(index % list.length) + 1} / {list.length}
      </span>
      <IconButton icon="caret-right" label={c.next} onClick={() => setIndex(index + 1)} />
    </div>
  );
  switch (id) {
    case 1:
      return (
        <div className="bs-col">
          {full(first)}
          <Button variant="ghost" size="sm" onClick={open}>
            {c.all} · {list.length}
          </Button>
        </div>
      );
    case 2:
      return (
        <div className="bs-col">
          <div className="bs-deck">
            <Card opaque tone={list[1]?.tone ?? first.tone} className="bs-deck-back" aria-hidden />
            <Card as="button" opaque tone={n.tone} onClick={open}>
              <div className="bs-row">
                {glyph(n)}
                <div>
                  <SectionLabel>{n.category}</SectionLabel>
                  <strong>{n.title}</strong>
                </div>
              </div>
            </Card>
          </div>
          {nav}
        </div>
      );
    case 3:
      return rows(list.slice(0, 3));
    case 4:
      return (
        <Card header={c.today}>
          <div className="bs-col">
            <strong>
              {list.length} {c.count}
            </strong>
            <p className="ut-muted">{list.map((x) => x.category).join(' · ')}</p>
            <Button size="sm" onClick={open}>
              {c.all}
            </Button>
          </div>
        </Card>
      );
    case 5:
      return <div className="bs-two">{list.slice(0, 4).map(tile)}</div>;
    case 6:
      return (
        <div className="bs-scroll">
          {list.map((x) => (
            <Chip key={x.id} icon={x.icon} onClick={open}>
              {x.category}
            </Chip>
          ))}
        </div>
      );
    case 7:
      return (
        <GroupedList>
          {list.slice(0, 3).map((x) => (
            <ListRow
              key={x.id}
              time={x.time}
              label={x.title}
              dense={dense}
              chevron
              onClick={open}
            />
          ))}
        </GroupedList>
      );
    case 8:
      return (
        <div className="bs-scroll bs-carousel">
          {list.map((x) => (
            <div key={x.id}>{full(x)}</div>
          ))}
        </div>
      );
    case 9:
      return (
        <GroupedList>
          {list.slice(0, 3).map((x) => (
            <div key={x.id}>
              <ListRow
                label={x.title}
                icon={glyph(x)}
                onClick={() => setExpanded(expanded === x.id ? null : x.id)}
                aria-expanded={expanded === x.id}
              />
              {expanded === x.id && (
                <div className="bs-inset">
                  <p className="ut-sm">{x.body}</p>
                  <Button size="sm" onClick={open}>
                    {x.action}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </GroupedList>
      );
    case 10:
      return (
        <div className="bs-col">
          {full(first)}
          {rows(list.slice(1, 3))}
        </div>
      );
    case 11:
      return (
        <GroupedList>
          {list.slice(0, 3).map((x) => (
            <ListRow
              key={x.id}
              label={x.title}
              icon={<Icon name="circle" />}
              trailing={
                <Button size="sm" variant="ghost" onClick={open}>
                  {x.action}
                </Button>
              }
              dense={dense}
            />
          ))}
        </GroupedList>
      );
    case 12:
      return (
        <div className="bs-col">
          <SectionLabel>{c.now}</SectionLabel>
          {rows(list.slice(0, 2))}
          <SectionLabel>{c.laterGroup}</SectionLabel>
          {rows(list.slice(2, 4))}
        </div>
      );
    case 13:
      return (
        <Card as="button" onClick={open}>
          <div className="bs-row bs-between">
            <div>
              <SectionLabel>To do</SectionLabel>
              <h2>
                {list.length} {c.count}
              </h2>
            </div>
            <div className="bs-icons">
              {list.slice(0, 4).map((x) => (
                <span key={x.id}>{glyph(x)}</span>
              ))}
            </div>
          </div>
        </Card>
      );
    case 14:
      return (
        <Banner
          tone="accent"
          icon={first.icon}
          kicker={first.category}
          title={first.title}
          body={detail ? first.body : undefined}
          primaryAction={{ label: first.action, onClick: open }}
          skipAction={{ label: `${c.all} · ${list.length}`, onClick: open }}
          sheen={false}
        />
      );
    case 15:
      return (
        <div className="bs-col">
          <SectionLabel action={count}>{c.now}</SectionLabel>
          {full(n)}
          {nav}
        </div>
      );
    case 16:
      return (
        <GroupedList>
          <ListRow
            label="To do"
            sub={first.title}
            value={String(list.length)}
            chevron
            onClick={open}
          />
        </GroupedList>
      );
    case 17:
      return (
        <div className="bs-col">
          <Segmented
            value={index % Math.min(list.length, 3)}
            onChange={setIndex}
            options={list
              .slice(0, 3)
              .map((x, i) => ({ value: i, label: x.category, compact: true }))}
          />
          {full(list[index % Math.min(list.length, 3)])}
        </div>
      );
    case 18:
      return (
        <Card tone="atlas" header="Бриф на сьогодні">
          <div className="bs-col">
            <p>
              {first.title} {first.body}
            </p>
            <ChipGroup>
              {list.slice(1, 4).map((x) => (
                <Chip key={x.id} size="sm" onClick={open}>
                  {x.category}
                </Chip>
              ))}
            </ChipGroup>
            <Button variant="secondary" onClick={open}>
              {first.action}
            </Button>
          </div>
        </Card>
      );
    case 19:
      return (
        <div className="bs-two">
          {list.map((x) => (
            <Card key={x.id} as="button" pad="sm" onClick={open}>
              <div className="bs-row">
                {glyph(x)}
                <span className="ut-sm">{x.action}</span>
              </div>
            </Card>
          ))}
        </div>
      );
    default:
      return list.length === 1 ? (
        full(first)
      ) : list.length <= 3 ? (
        rows(list)
      ) : (
        <div className="bs-col">
          <SectionLabel action={count}>{c.now}</SectionLabel>
          {rows(list.slice(0, 2))}
          <ChipGroup>
            {list.slice(2).map((x) => (
              <Chip key={x.id} onClick={open} size="sm">
                {x.category}
              </Chip>
            ))}
          </ChipGroup>
        </div>
      );
  }
}

function AllBanners({
  kind,
  list,
  finish,
}: {
  kind: ModalKind;
  list: Item[];
  finish: (id: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(list[0]?.id ?? null);
  const [filter, setFilter] = useState('all');
  if (!list.length) return <Empty />;
  const card = (n: Item) => <Full key={n.id} n={n} act={() => finish(n.id)} />;
  if (kind === 'focus') {
    const n = list[index % list.length];
    return (
      <div className="bs-col">
        <SectionLabel>
          {(index % list.length) + 1} / {list.length}
        </SectionLabel>
        {card(n)}
        <Button variant="ghost" onClick={() => setIndex(index + 1)}>
          {c.next}
        </Button>
      </div>
    );
  }
  if (kind === 'groups')
    return (
      <div className="bs-col">
        <SectionLabel>{c.now}</SectionLabel>
        {list.slice(0, 2).map(card)}
        {list.length > 2 && (
          <>
            <SectionLabel>{c.laterGroup}</SectionLabel>
            {list.slice(2).map((n) => (
              <GroupedList key={n.id}>
                <Row n={n} open={() => setExpanded(expanded === n.id ? null : n.id)} />
                {expanded === n.id && <div className="bs-inset">{card(n)}</div>}
              </GroupedList>
            ))}
          </>
        )}
      </div>
    );
  if (kind === 'accordion')
    return (
      <GroupedList>
        {list.map((n) => (
          <div key={n.id}>
            <ListRow
              icon={glyph(n)}
              label={n.title}
              sub={n.category}
              onClick={() => setExpanded(expanded === n.id ? null : n.id)}
              aria-expanded={expanded === n.id}
            />
            {expanded === n.id && <div className="bs-inset">{card(n)}</div>}
          </div>
        ))}
      </GroupedList>
    );
  if (kind === 'checklist')
    return (
      <GroupedList>
        {list.map((n) => (
          <ListRow
            key={n.id}
            label={n.title}
            sub={n.body}
            trailing={
              <IconButton
                icon="check"
                label={`${c.done}: ${n.title}`}
                onClick={() => finish(n.id)}
              />
            }
          />
        ))}
      </GroupedList>
    );
  if (kind === 'agenda')
    return (
      <div className="bs-col">
        {list.map((n) => (
          <div key={n.id}>
            <SectionLabel>{n.time}</SectionLabel>
            {card(n)}
          </div>
        ))}
      </div>
    );
  if (kind === 'tabs')
    return (
      <div className="bs-col">
        <ChipGroup>
          <Chip selected={filter === 'all'} onClick={() => setFilter('all')}>
            {c.everything}
          </Chip>
          {list.map((n) => (
            <Chip key={n.id} selected={filter === n.id} onClick={() => setFilter(n.id)}>
              {n.category}
            </Chip>
          ))}
        </ChipGroup>
        {list.filter((n) => filter === 'all' || n.id === filter).map(card)}
      </div>
    );
  return <div className="bs-col">{list.map(card)}</div>;
}

export function BannerStudy() {
  const [view, setView] = useState('gallery');
  const [selected, setSelected] = useState(3);
  const [panel, setPanel] = useState<'settings' | 'all' | null>(null);
  const [detail, setDetail] = useState(true);
  const [dense, setDense] = useState(false);
  const [disabled, setDisabled] = useState<string[]>([]);
  const [done, setDone] = useState<string[]>([]);
  const [scenario, setScenario] = useState('many');
  const [modalOverride, setModalOverride] = useState<ModalKind | null>(null);
  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel]);
  const concept = concepts.find((x) => x.id === selected)!;
  const list = items
    .slice(0, scenario === 'one' ? 1 : scenario === 'none' ? 0 : items.length)
    .filter((n) => !disabled.includes(n.id) && !done.includes(n.id));
  const finish = (id: string) => setDone((a) => [...a, id]);
  const choose = (x: Concept) => {
    setSelected(x.id);
    setModalOverride(null);
  };
  const show = (x: Concept, p: 'settings' | 'all') => {
    choose(x);
    setPanel(p);
  };
  const currentWidget = (
    <Widget
      key={selected}
      id={selected}
      list={list}
      detail={detail}
      dense={dense}
      open={() => setPanel('all')}
    />
  );
  const settings = (
    <div className="bs-col">
      <SectionLabel>{c.types}</SectionLabel>
      <div className="bs-options">
        {concepts.map((x) => (
          <OptionCard
            key={x.id}
            title={`${String(x.id).padStart(2, '0')} · ${x.name}`}
            sub={x.family}
            selected={selected === x.id}
            onSelect={() => choose(x)}
          />
        ))}
      </div>
      <SectionLabel>{c.density}</SectionLabel>
      <Segmented
        value={dense ? 'dense' : 'roomy'}
        onChange={(v) => setDense(v === 'dense')}
        options={[
          { value: 'dense', label: c.compact },
          { value: 'roomy', label: c.comfortable },
        ]}
      />
      <GroupedList>
        <ListRow
          as="label"
          label={c.detail}
          trailing={<Switch checked={detail} onChange={setDetail} aria-label={c.detail} />}
        />
      </GroupedList>
      <SectionLabel>{c.format}</SectionLabel>
      <ChipGroup>
        {(Object.keys(modalNames) as ModalKind[]).map((k) => (
          <Chip
            key={k}
            selected={(modalOverride ?? concept.modal) === k}
            onClick={() => setModalOverride(k)}
          >
            {modalNames[k]}
          </Chip>
        ))}
      </ChipGroup>
      <GroupedList header={c.content}>
        {items.map((n) => (
          <ListRow
            key={n.id}
            as="label"
            label={n.category}
            icon={glyph(n)}
            trailing={
              <Switch
                checked={!disabled.includes(n.id)}
                aria-label={n.category}
                onChange={(on) =>
                  setDisabled((a) => (on ? a.filter((x) => x !== n.id) : [...a, n.id]))
                }
              />
            }
          />
        ))}
      </GroupedList>
      <p className="ut-xs ut-muted">{c.noSave}</p>
    </div>
  );
  const all = (
    <AllBanners
      key={`${selected}-${modalOverride}`}
      kind={modalOverride ?? concept.modal}
      list={list}
      finish={finish}
    />
  );
  const baseline: Nudge[] = list.map((n, i) => ({
    id: n.id,
    tone: i === 0 ? 'readiness' : i === 1 ? 'plan' : 'rest',
    priority: 100 - i,
    icon: n.icon,
    kicker: n.category,
    title: n.title,
    body: n.body,
    actions: (close) => <Button onClick={close}>{n.action}</Button>,
  }));
  return (
    <main className="bs-study">
      <header className="bs-col">
        <SectionLabel>SPOTTER / DESIGN STUDY 01</SectionLabel>
        <h1>{c.title}</h1>
        <p className="ut-muted">{c.intro}</p>
        <div className="bs-toolbar">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'gallery', label: c.gallery },
              { value: 'detail', label: c.selected },
              { value: 'baseline', label: c.baseline },
            ]}
          />
          <Segmented
            label={c.scenario}
            value={scenario}
            onChange={setScenario}
            options={[
              { value: 'many', label: c.many },
              { value: 'one', label: c.one },
              { value: 'none', label: c.none },
            ]}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDone([]);
              setDisabled([]);
              setScenario('many');
            }}
          >
            {c.reset}
          </Button>
        </div>
      </header>
      {view === 'baseline' ? (
        <div className="bs-baseline">
          <p className="ut-muted">{c.baselineNote}</p>
          <NudgeStack nudges={baseline} />
          <GroupedList header={c.settings}>
            {items.map((n) => (
              <ListRow
                key={n.id}
                as="label"
                label={n.category}
                trailing={
                  <Switch
                    checked={!disabled.includes(n.id)}
                    onChange={(on) =>
                      setDisabled((a) => (on ? a.filter((x) => x !== n.id) : [...a, n.id]))
                    }
                    aria-label={n.category}
                  />
                }
              />
            ))}
          </GroupedList>
        </div>
      ) : view === 'gallery' ? (
        <div className="bs-gallery">
          {concepts.map((x) => (
            <section key={x.id} className="bs-concept" data-concept={x.id}>
              <div className="bs-row bs-between">
                <SectionLabel>
                  {String(x.id).padStart(2, '0')} / {x.family}
                </SectionLabel>
                {x.recommended && (
                  <Chip size="sm" tone="accent">
                    {c.recommend}
                  </Chip>
                )}
              </div>
              <h2>{x.name}</h2>
              <p className="ut-muted ut-sm">{x.idea}</p>
              <div className="bs-widget">
                <SectionLabel
                  action={
                    <IconButton
                      icon="gear"
                      label={`${c.settings} ${x.id}`}
                      onClick={() => show(x, 'settings')}
                    />
                  }
                >
                  To do · {list.length}
                </SectionLabel>
                <Widget
                  id={x.id}
                  list={list}
                  detail={detail}
                  dense={dense}
                  open={() => show(x, 'all')}
                />
              </div>
              <p className="ut-xs ut-muted">
                {c.tradeoff}: {x.cost}
              </p>
              <div className="bs-row">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    choose(x);
                    setView('detail');
                  }}
                >
                  {c.open}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => show(x, 'all')}>
                  {c.all}
                </Button>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <>
          <div className="bs-scroll">
            {concepts.map((x) => (
              <Chip key={x.id} selected={selected === x.id} onClick={() => choose(x)}>
                {String(x.id).padStart(2, '0')} · {x.name}
              </Chip>
            ))}
          </div>
          <h2>{concept.name}</h2>
          <p className="ut-muted">
            {concept.idea} {c.tradeoff}: {concept.cost}
          </p>
          <div className="bs-triptych">
            <section className="bs-col">
              <SectionLabel>{c.widget}</SectionLabel>
              {currentWidget}
              <Button variant="secondary" onClick={() => setPanel('all')}>
                {c.all}
              </Button>
            </section>
            <section className="bs-col">
              <SectionLabel>{c.settings}</SectionLabel>
              {settings}
            </section>
            <section className="bs-col">
              <SectionLabel>
                {c.modal} · {modalNames[modalOverride ?? concept.modal]}
              </SectionLabel>
              {all}
            </section>
          </div>
        </>
      )}
      {panel && (
        <Sheet onClose={() => setPanel(null)}>
          <div className="bs-col">
            <SectionLabel>
              {String(selected).padStart(2, '0')} · {concept.name}
            </SectionLabel>
            <h2>{panel === 'settings' ? c.settings : c.all}</h2>
            {panel === 'settings' ? (
              <>
                <SectionLabel>{c.preview}</SectionLabel>
                {currentWidget}
                {settings}
              </>
            ) : (
              all
            )}
          </div>
        </Sheet>
      )}
    </main>
  );
}
