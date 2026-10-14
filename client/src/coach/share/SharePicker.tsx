import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { Button } from '../../components/ui/Button';
import { Chip, ChipGroup } from '../../components/ui/Chip';
import { EmptyState } from '../../components/ui/EmptyState';
import { FailedState } from '../../components/ui/FailedState';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { IconTile } from '../../components/ui/IconTile';
import { Notice } from '../../components/ui/Notice';
import { ResponsivePanel } from '../../components/ui/ResponsivePanel';
import { SearchField } from '../../components/ui/SearchField';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { Segmented } from '../../components/ui/Segmented';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { coachTimeZone } from '../format';
import { useWords } from './ShareCardView';
import { chipsOf, searchLabels, subOf, titleOf, type Words } from './labels';
import { KIND_ICON } from './resolve';
import {
  defaultSort,
  FILTERS,
  recentShares,
  SORTS,
  searchAll,
  suggestionsFor,
  type Filter,
  type Group,
  type Hit,
} from './search';
import type { ShareKind, ShareRef, ShareView, Viewer } from './types';
import { resolveShare } from './resolve';
import { useShareSource } from './useShare';
import type { ShareSourcePort } from './port';
import './SharePicker.css';

export const PICKER_DEBOUNCE_MS = 120;
const GROUP_CAP = 3;

export interface SharePickerProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  viewer: Viewer;
  /** Owner's first name ("Oleh"). */
  who: string;
  /** Refs already shared in this conversation (newest first). */
  inChat?: readonly ShareRef[];
  /** What the chat was opened from (a decision about a lift). */
  topic?: { exerciseId?: string };
  onPick: (ref: ShareRef) => void;
  /** Ask the client to turn a category on (a real `request` chat message, see `askShare.ts`). */
  onAsk?: (kind: ShareKind) => void;
  port?: ShareSourcePort;
  /** Initial query, for stories. */
  initialQuery?: string;
  initialFilter?: Filter;
}

function useDebounced<T>(v: T, ms: number): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const id = window.setTimeout(() => setD(v), ms);
    return () => window.clearTimeout(id);
  }, [v, ms]);
  return d;
}

function PickRow({
  w,
  v,
  has,
  disabled,
  optId,
  active,
  onPick,
}: {
  w: Words;
  v: ShareView;
  has?: string;
  disabled?: boolean;
  optId: string;
  active: boolean;
  onPick: () => void;
}) {
  const sub = [subOf(w, v.sub), has ? w.sh.pickHas(has) : undefined].filter(Boolean).join(' · ');
  const chips = chipsOf(w, v);
  return (
    <ListRow
      icon={<IconTile icon={KIND_ICON[v.kind]} size={40} />}
      label={titleOf(w, v)}
      sub={disabled ? w.sh.pickDeviceOnly : sub || chips?.slice(0, 2).join(', ')}
      strong
      disabled={disabled}
      id={optId}
      role="option"
      selected={active}
      aria-selected={active}
      aria-label={`${w.sh.kind[v.kind]}: ${titleOf(w, v)}`}
      onClick={onPick}
      data-pick=""
    />
  );
}

/**
 * The share picker (S-16b): ONE search over nine kinds. Opens as a glass popover on desktop and a bottom sheet on a
 * phone (ResponsivePanel). Empty query: Suggested / In this conversation / Recent. Typing: groups of three with
 * "Show all N", a date line when the query holds a date, locked kinds as a group with the way to unlock them.
 * Arrow keys move between the search field and the rows; Escape closes; there are no hotkeys.
 */
export function SharePicker(p: SharePickerProps) {
  if (!p.open) return null;
  return <PickerBody {...p} />;
}

function PickerBody({
  onClose,
  anchorRef,
  viewer,
  who,
  inChat,
  topic,
  onPick,
  onAsk,
  port,
  initialQuery,
  initialFilter,
}: SharePickerProps) {
  const w = useWords();
  const { sh } = w;
  const { source, status, retry } = useShareSource(viewer.clientId, port);
  const [q, setQ] = useState(initialQuery ?? '');
  const [filter, setFilter] = useState<Filter>(initialFilter ?? 'all');
  const [sorts, setSorts] = useState<Partial<Record<ShareKind, string>>>({});
  const [more, setMore] = useState<Set<ShareKind>>(new Set());
  const [asked, setAsked] = useState<Set<ShareKind>>(new Set());
  const dq = useDebounced(q, q === initialQuery ? 0 : PICKER_DEBOUNCE_MS);
  const body = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const uid = useId();
  const listId = `${uid}-list`;
  const optId = (v: ShareView) => `${uid}-${v.kind}-${v.ref.id}`.replace(/\s+/g, '_');
  /** The option the arrow keys are on (aria-activedescendant); focus stays in the search field. */
  const viewKey = `${dq}|${filter}|${more.size}|${JSON.stringify(sorts)}`;
  const [act, setAct] = useState<{ key: string; id: string | null }>({ key: viewKey, id: null });
  const activeId = act.key === viewKey ? act.id : null;
  const setActiveId = (id: string | null) => setAct({ key: viewKey, id });

  useEffect(() => {
    // On a phone, focusing the field opens the keyboard and the drawer jumps to full height before the user asked
    // for it; there the drawer opens at its own height and the field is focused by a tap. Desktop focuses at once.
    if (window.matchMedia?.('(max-width: 719px)').matches) return;
    field.current?.focus({ preventScroll: true });
  }, []);

  const out = useMemo(
    () =>
      source
        ? searchAll(dq, viewer, source, {
            filter,
            sort: filter === 'all' ? undefined : sorts[filter as ShareKind],
            locale: w.locale,
            words: sh.dateWords,
            tz: coachTimeZone(),
            labels: (v) => searchLabels(w, v),
          })
        : null,
    [source, dq, viewer, filter, sorts, w, sh.dateWords],
  );

  const browsing = dq.trim() === '' && filter === 'all';
  const sections = useMemo(() => {
    if (!source || !browsing) return null;
    const view = (r: ShareRef) => resolveShare(r, viewer, source);
    const usable = (v: ShareView) => v.state === 'ok' || v.state === 'limited';
    const sug = suggestionsFor(viewer, source, topic)
      .map((s) => ({ v: view(s.ref), why: s.why }))
      .filter((x) => usable(x.v));
    const taken = new Set(sug.map((s) => `${s.v.kind}:${s.v.ref.id}`));
    const chat = (inChat ?? [])
      .map(view)
      .filter((v) => usable(v) && !taken.has(`${v.kind}:${v.ref.id}`))
      .slice(0, 4);
    chat.forEach((v) => taken.add(`${v.kind}:${v.ref.id}`));
    const recent = recentShares()
      .map(view)
      .filter((v) => usable(v) && !taken.has(`${v.kind}:${v.ref.id}`))
      .slice(0, 4);
    return { sug, chat, recent };
  }, [source, browsing, viewer, topic, inChat]);

  const whyText = (why: string, name: string): string => {
    const m = sh.why as unknown as Record<string, string | ((x: string) => string)>;
    const t = m[why];
    return typeof t === 'function' ? t(name) : (t ?? '');
  };

  const nav = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' && activeId && e.target === field.current) {
      const el = document.getElementById(activeId);
      if (el) {
        e.preventDefault();
        el.click();
      }
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = Array.from(
      body.current?.querySelectorAll<HTMLElement>('[role="option"]:not(:disabled)') ?? [],
    );
    if (items.length === 0) return;
    e.preventDefault();
    const at = items.findIndex((el) => el.id === activeId);
    const down = e.key === 'ArrowDown';
    const next =
      items[
        Math.max(
          0,
          Math.min(items.length - 1, at < 0 ? (down ? 0 : items.length - 1) : at + (down ? 1 : -1)),
        )
      ];
    setActiveId(next.id);
    next.scrollIntoView?.({ block: 'nearest' });
    if (document.activeElement !== field.current) field.current?.focus({ preventScroll: true });
  };

  /** Each group of options is its own listbox (GroupedList rows container); the search field controls them all. */
  const lbIds: string[] = [];
  const listboxId = () => {
    const id = `${uid}-lb-${lbIds.length}`;
    lbIds.push(id);
    return id;
  };
  const pick = (v: ShareView) => onPick(v.ref);
  const chipLabel = (f: Filter) => sh.filter[f];

  /* Type chips: a kind with its count; there is no "All" chip (searching always covers every type, and the empty
     view already lists suggestions and everything else by type). A pressed chip narrows to its type, pressing it
     again goes back. */
  const filters = (
    <ChipGroup scroll role="group" aria-label={sh.pickTypes}>
      {FILTERS.filter((f): f is ShareKind => f !== 'all').map((f) => {
        const locked = out?.groups.find((g) => g.kind === f)?.locked;
        const n = out?.counts[f] ?? 0;
        const empty = !!out && !locked && n === 0 && f !== filter;
        return (
          <Chip
            key={f}
            aria-pressed={filter === f}
            aria-label={locked ? sh.pickChipLocked(chipLabel(f)) : sh.pickChipAria(chipLabel(f), n)}
            icon={locked ? 'lock-simple' : undefined}
            selected={filter === f}
            count={out && !locked ? n : undefined}
            disabled={empty}
            onClick={() => setFilter(filter === f ? 'all' : f)}
          >
            {chipLabel(f)}
          </Chip>
        );
      })}
    </ChipGroup>
  );

  const renderGroup = (g: Group) => {
    const kind = g.kind;
    const single = filter !== 'all';
    if (g.locked) {
      if (!single && browsing) return null;
      const isAsked = asked.has(kind);
      return (
        <section key={kind} className="shp-g">
          <Notice
            tone="note"
            icon="lock-simple"
            trail={
              onAsk && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={isAsked}
                  onClick={() => {
                    onAsk(kind);
                    setAsked(new Set(asked).add(kind));
                  }}
                >
                  {isAsked ? sh.pickAskedShort : sh.pickAsk(who)}
                </Button>
              )
            }
          >
            <b>{sh.pickLockedGroup(sh.kindPlural[kind])}</b>{' '}
            {isAsked
              ? sh.pickAskedNote(
                  who,
                  sh.catWords[g.locked.code === 'notShared' ? g.locked.cat : 'sets'],
                )
              : sh.pickLockedBody(who)}
          </Notice>
        </section>
      );
    }
    if (g.hits.length === 0) return null;
    const expanded = single || more.has(kind);
    const shown = expanded ? g.hits : g.hits.slice(0, GROUP_CAP);
    const kinds = SORTS[kind];
    return (
      <section key={kind} className="shp-g" aria-label={sh.kindPlural[kind]}>
        <div className="shp-gh">
          <SectionLabel>
            {sh.kindPlural[kind]} · {g.total}
          </SectionLabel>
        </div>
        {single && kinds.length > 1 && (
          <Segmented
            size="sm"
            hug
            label={sh.pickSortAria(sh.kindLower[kind])}
            options={kinds.map((s) => ({
              value: s,
              label: (sh.sort as Record<string, string>)[s] ?? s,
            }))}
            value={sorts[kind] ?? defaultSort(kind)}
            onChange={(s) => setSorts({ ...sorts, [kind]: s })}
          />
        )}
        <GroupedList rowsRole="listbox" rowsId={listboxId()} label={sh.kindPlural[kind]}>
          {shown.map((h: Hit) => (
            <PickRow
              key={h.view.ref.id}
              w={w}
              v={h.view}
              has={h.has}
              disabled={!!h.disabled}
              optId={optId(h.view)}
              active={activeId === optId(h.view)}
              onPick={() => pick(h.view)}
            />
          ))}
        </GroupedList>
        {!expanded && g.total > GROUP_CAP && (
          <Button variant="ghost" size="sm" onClick={() => setMore(new Set(more).add(kind))}>
            {sh.pickShowAll(g.total)}
          </Button>
        )}
      </section>
    );
  };

  let content;
  if (status === 'loading' && !source) content = <SkeletonRows rows={5} label={sh.pickLoading} />;
  else if (!source || !out)
    content = (
      <FailedState
        title={sh.pickFailed}
        icon="cloud-slash"
        retryLabel={sh.pickRetry}
        onRetry={retry}
      />
    );
  else if (sections) {
    const rows = (title: string, items: { v: ShareView; sub?: string }[]) =>
      items.length > 0 && (
        <section className="shp-g">
          <SectionLabel>{title}</SectionLabel>
          <GroupedList rowsRole="listbox" rowsId={listboxId()} label={title}>
            {items.map(({ v, sub }) => (
              <ListRow
                key={`${v.kind}:${v.ref.id}`}
                icon={<IconTile icon={KIND_ICON[v.kind]} size={40} />}
                label={titleOf(w, v)}
                sub={sub ?? subOf(w, v.sub)}
                strong
                id={optId(v)}
                role="option"
                selected={activeId === optId(v)}
                aria-selected={activeId === optId(v)}
                aria-label={`${sh.kind[v.kind]}: ${titleOf(w, v)}`}
                onClick={() => pick(v)}
                data-pick=""
              />
            ))}
          </GroupedList>
        </section>
      );
    const lockedGroups = out.groups.filter((g) => g.locked);
    const listed = new Set(
      [...sections.sug.map((x) => x.v), ...sections.chat, ...sections.recent].map(
        (v) => `${v.kind}:${v.ref.id}`,
      ),
    );
    /* the rest of what can be sent, by type, three rows each; "Show all N" opens that type */
    const rest = out.groups
      .filter((g) => !g.locked)
      .map((g) => ({
        g,
        hits: g.hits.filter((h) => !listed.has(`${h.view.kind}:${h.view.ref.id}`)),
      }))
      .filter((x) => x.hits.length > 0);
    content = (
      <>
        {rows(
          sh.pickSuggested,
          sections.sug.map((s) => ({
            v: s.v,
            sub: [whyText(s.why, who), subOf(w, s.v.sub)].filter(Boolean).join(' · '),
          })),
        )}
        {rows(
          sh.pickInConversation,
          sections.chat.map((v) => ({ v })),
        )}
        {rows(
          sh.pickRecent,
          sections.recent.map((v) => ({ v })),
        )}
        {sections.sug.length + sections.chat.length + sections.recent.length === 0 && (
          <Notice tone="note" icon="magnifying-glass">
            {sh.pickHint}
          </Notice>
        )}
        {rest.length > 0 && (
          <>
            <SectionLabel>{sh.pickMoreHead}</SectionLabel>
            {rest.map(({ g, hits }) => (
              <section key={g.kind} className="shp-g" aria-label={sh.kindPlural[g.kind]}>
                <div className="shp-gh">
                  <SectionLabel>
                    {sh.kindPlural[g.kind]} · {g.total}
                  </SectionLabel>
                </div>
                <GroupedList rowsRole="listbox" rowsId={listboxId()} label={sh.kindPlural[g.kind]}>
                  {hits.slice(0, GROUP_CAP).map((h: Hit) => (
                    <PickRow
                      key={h.view.ref.id}
                      w={w}
                      v={h.view}
                      has={h.has}
                      disabled={!!h.disabled}
                      optId={optId(h.view)}
                      active={activeId === optId(h.view)}
                      onPick={() => pick(h.view)}
                    />
                  ))}
                </GroupedList>
                {g.total > GROUP_CAP && (
                  <Button variant="ghost" size="sm" onClick={() => setFilter(g.kind)}>
                    {sh.pickShowAll(g.total)}
                  </Button>
                )}
              </section>
            ))}
          </>
        )}
        {lockedGroups.map(renderGroup)}
      </>
    );
  } else if (
    out.counts[filter] === 0 &&
    !out.groups.some((g) => g.locked && (filter === 'all' || g.kind === filter))
  ) {
    content = (
      <EmptyState
        titleAs="h2"
        icon="magnifying-glass"
        title={
          filter === 'all'
            ? sh.pickEmptyQuery(dq)
            : sh.pickEmptyKind(sh.kindLower[filter as ShareKind], dq)
        }
        body={filter === 'all' ? sh.pickEmptyBody : sh.pickEmptyKindBody(dq, who)}
      >
        {filter !== 'all' && (
          <Button variant="secondary" size="sm" onClick={() => setFilter('all')}>
            {sh.pickAllTypes}
          </Button>
        )}
      </EmptyState>
    );
  } else {
    content = (
      <>
        {out.date && (
          <div className="shp-date">
            <Chip icon="calendar-blank" selected>
              {sh.pickDateOn(out.date.key)}
            </Chip>
            <Button variant="ghost" size="sm" onClick={() => setQ(out.date?.rest ?? '')}>
              {sh.pickDateClear}
            </Button>
          </div>
        )}
        {(filter === 'all' ? out.groups : out.groups.filter((g) => g.kind === filter)).map(
          renderGroup,
        )}
      </>
    );
  }

  return (
    <ResponsivePanel
      open
      onClose={onClose}
      anchorRef={anchorRef}
      mode="sheet"
      label={sh.pickAria}
      title={sh.pickTitle(who)}
      width={440}
      footer={<small className="shp-foot">{sh.pickFoot(who)}</small>}
    >
      <div className="shp" onKeyDown={nav}>
        <SearchField
          ref={field}
          value={q}
          onChange={(v) => setQ(v)}
          placeholder={sh.pickSearch}
          aria-label={sh.pickSearchAria}
          clearLabel={sh.pickClear}
          role="combobox"
          aria-expanded
          aria-haspopup="listbox"
          aria-controls={lbIds.length ? lbIds.join(' ') : listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId ?? undefined}
        />
        {filters}
        <div
          className="shp-b"
          ref={body}
          id={listId}
          role="region"
          aria-label={sh.pickAria}
          aria-busy={status === 'loading' && !source}
        >
          {content}
        </div>
      </div>
    </ResponsivePanel>
  );
}
