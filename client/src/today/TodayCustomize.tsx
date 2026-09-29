/**
 * Customize Today (design v3: T2 mobile / D2 desktop). The same stack of
 * sections in edit chrome: core blocks move (↑ ↓), are configured (⚙︎, with a
 * summary on their tag) and can't be removed; custom
 * sections move, change layout, fill their slots and go away with a confirm.
 * No drag & drop on phones — arrows everywhere. Desktop (D2) adds drag & drop
 * on top: ⋮⋮ handles reorder sections, tiles reorder inside their section, and
 * the "Add to Today" panel (in place of Start) drops new sections, widgets and
 * shortcuts onto the page. The arrows stay the keyboard path.
 */
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../components/ui/Button';
import { Chip } from '../components/ui/Chip';
import { DragHandle } from '../components/ui/DragHandle';
import { Segmented } from '../components/ui/Segmented';
import { WidgetGrid, SECTION_LAYOUTS, type SectionLayout } from '../components/ui/WidgetGrid';
import { ConfirmDialog, Icon, Sheet } from '../ui';
import { useT } from '../i18n';
import { CoreConfigSheet } from './CoreConfigSheet';
import {
  DEFAULT_LAYOUT,
  NUDGE_KINDS,
  addSection,
  freeSlot,
  insertWidget,
  layoutChange,
  coreOpts,
  isConfigurable,
  getTodayLayout,
  moveSection,
  moveWidget,
  newId,
  placeSection,
  placeWidget,
  removeSection,
  removeWidget,
  setSectionMeta,
  setTodayLayout,
  setWidget,
  slotCount,
  slotSize,
  type ConfigurableCore,
  type CoreId,
  type CustomSection,
  type TodayLayout,
} from './layout';
import { WIDGETS, WIDGET_GROUPS, widgetById, type WidgetGroup } from './registry';
import { SHORTCUTS, renderShortcut, shortcutById, type ShortcutCtx } from './shortcuts';
import { useTw } from './strings';
import './today.css';

type Picking = { sectionId: string; slot: number; size: 'XS' | 'S' | 'M' | 'L' | 'XL' };

/** What's being dragged (desktop). */
type Drag =
  | { kind: 'section'; id: string }
  | { kind: 'layout'; layout: SectionLayout }
  | { kind: 'item'; sectionId: string; widgetId: string }
  | { kind: 'widget'; widget: string }
  | { kind: 'shortcut'; widget: string };
type PanelTab = 'sections' | 'widgets' | 'shortcuts';

/** A focusable div acting as a button — native drag & drop is unreliable on
 *  <button> in some browsers, so draggable tiles use this. */
const pressKeys = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fn();
  }
};

export function TodayCustomize({
  coreFor,
  hasClients,
  ctx,
  side,
  onClose,
}: {
  /** The core blocks, rendered with a layout's block options (the draft's here). */
  coreFor: (layout: TodayLayout) => Record<CoreId, ReactNode>;
  /** Clients exist — the Atlas block offers its client options. */
  hasClients: boolean;
  ctx: ShortcutCtx;
  /** Desktop: the right panel to fill with "Add to Today" (D2). When set, the
   *  page gets drag & drop and the slot pickers move from sheets to the panel. */
  side?: HTMLElement | null;
  onClose: () => void;
}) {
  const { t } = useT();
  const tw = useTw();
  const desk = !!side;
  const [saved] = useState<TodayLayout>(() => getTodayLayout());
  const [draft, setDraft] = useState<TodayLayout>(saved);
  const dirty = JSON.stringify(draft.sections) !== JSON.stringify(saved.sections);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [editing, setEditing] = useState<CustomSection | null>(null);
  const [insertAfter, setInsertAfter] = useState<string | null>(null);
  const [configuring, setConfiguring] = useState<ConfigurableCore | null>(null);
  const coreBlocks = coreFor(draft);
  /** What a core block's tag says about its settings (design T2). */
  const summary = (id: ConfigurableCore): string => {
    switch (id) {
      case 'atlas': {
        const o = coreOpts(draft, 'atlas');
        return hasClients ? t.todayAtlasLayout[o.layout] : t.todayAtlasView[o.atlasView];
      }
      case 'program':
        return t.todayProgStyle[coreOpts(draft, 'program').style];
      case 'nudges': {
        const n = NUDGE_KINDS.length;
        return t.todaySumOn(n - coreOpts(draft, 'nudges').off.length, n);
      }
      case 'history':
        return t.todaySumDays(coreOpts(draft, 'history').days);
    }
  };

  // Edit mode owns the whole screen: the app header, Today's date row and the
  // tab bar step aside (design T2), and come back when editing ends.
  useEffect(() => {
    document.body.classList.add('td-editing');
    return () => document.body.classList.remove('td-editing');
  }, []);
  const [selected, setSelected] = useState<{ sectionId: string; widgetId: string } | null>(null);
  const [picking, setPicking] = useState<Picking | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<CustomSection | null>(null);

  const [tab, setTab] = useState<PanelTab>('sections');
  const dragRef = useRef<Drag | null>(null);
  const [drag, setDragState] = useState<Drag | null>(null);
  /** Section drop position: the index the dragged section/layout lands at. */
  const [secDrop, setSecDrop] = useState<number | null>(null);
  const [slotDrop, setSlotDrop] = useState<{ sectionId: string; slot: number } | null>(null);
  /** A section highlighted as a whole (drop appends to its first free slot). */
  const [secTarget, setSecTarget] = useState<string | null>(null);

  const startDrag = (e: DragEvent, d: Drag, label: string, image?: Element | null) => {
    dragRef.current = d;
    e.dataTransfer.effectAllowed = d.kind === 'section' || d.kind === 'item' ? 'move' : 'copy';
    e.dataTransfer.setData('text/plain', label);
    if (image) e.dataTransfer.setDragImage(image, 24, 20);
    // Changing the dragged element's DOM inside dragstart cancels the drag in Chrome.
    window.setTimeout(() => {
      if (dragRef.current === d) setDragState(d);
    }, 0);
  };
  const endDrag = () => {
    dragRef.current = null;
    setDragState(null);
    setSecDrop(null);
    setSlotDrop(null);
    setSecTarget(null);
  };
  /** Where a new section goes when added without a position: before History. */
  const lastAfter = () =>
    [...draft.sections].reverse().find((x) => x.id !== 'history')?.id ?? undefined;
  const addLayout = (layout: SectionLayout, afterId = lastAfter()) =>
    setDraft(
      addSection(draft, { id: newId('sec'), title: t.todayLayouts[layout], layout }, afterId),
    );

  /** Sections: the pointer's position among the blocks picks the drop index. */
  // React events bubble out of the panel's portal into this list too: only the
  // page itself (the DOM inside the list) is a drop zone.
  const onPage = (e: DragEvent<HTMLDivElement>) => e.currentTarget.contains(e.target as Node);
  const onListDragOver = (e: DragEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || (d.kind !== 'section' && d.kind !== 'layout')) return;
    if (!onPage(e)) {
      setSecDrop(null);
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = d.kind === 'section' ? 'move' : 'copy';
    let at = 0;
    e.currentTarget.querySelectorAll<HTMLElement>('[data-sec-idx]').forEach((b) => {
      const r = b.getBoundingClientRect();
      if (e.clientY > r.top + r.height / 2) at = Number(b.dataset.secIdx) + 1;
    });
    at = Math.max(1, at);
    if (d.kind === 'section') {
      const from = draft.sections.findIndex((x) => x.id === d.id);
      if (at === from || at === from + 1) {
        setSecDrop(null);
        return;
      }
    }
    setSecDrop(at);
  };
  const onListDrop = (e: DragEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || (d.kind !== 'section' && d.kind !== 'layout') || !onPage(e)) return;
    e.preventDefault();
    if (secDrop != null) {
      if (d.kind === 'section') {
        const from = draft.sections.findIndex((x) => x.id === d.id);
        setDraft(placeSection(draft, d.id, secDrop > from ? secDrop - 1 : secDrop));
      } else addLayout(d.layout, draft.sections[secDrop - 1]?.id);
    }
    endDrag();
  };
  const onListDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setSecDrop(null);
      setSlotDrop(null);
      setSecTarget(null);
    }
  };

  /** Can the current drag land on slot `slot` of `s`? */
  const slotAccepts = (s: CustomSection, slot: number, d: Drag | null) => {
    if (!d) return false;
    if (d.kind === 'item') return d.sectionId === s.id;
    if (d.kind === 'widget') return s.layout !== 'shortcuts';
    if (d.kind === 'shortcut') return s.layout === 'shortcuts' && freeSlot(s, d.widget) >= 0;
    return false;
  };
  const dropOnSlot = (s: CustomSection, slot: number, d: Drag) => {
    if (d.kind === 'item') {
      const to =
        s.layout === 'shortcuts' || s.layout === 'rows' ? Math.min(slot, s.items.length - 1) : slot;
      setDraft(placeWidget(draft, s.id, d.widgetId, to));
    } else if (d.kind === 'widget') {
      setDraft(setWidget(draft, s.id, slot, d.widget, newId('w')));
    } else if (d.kind === 'shortcut') {
      setDraft(insertWidget(draft, s.id, d.widget, newId('w'), slot));
    }
    setSelected(null);
    setPicking(null);
  };
  const slotDnd = (s: CustomSection, slot: number) =>
    desk
      ? {
          onDragOver: (e: DragEvent) => {
            if (!slotAccepts(s, slot, dragRef.current)) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = dragRef.current?.kind === 'item' ? 'move' : 'copy';
            setSecTarget(null);
            setSlotDrop((cur) =>
              cur?.sectionId === s.id && cur.slot === slot ? cur : { sectionId: s.id, slot },
            );
          },
          onDrop: (e: DragEvent) => {
            const d = dragRef.current;
            if (!d || !slotAccepts(s, slot, d)) return;
            e.preventDefault();
            e.stopPropagation();
            dropOnSlot(s, slot, d);
            endDrag();
          },
        }
      : {};
  /** A widget or shortcut dropped on a section (not a slot) takes its first free slot. */
  const blockDnd = (s: CustomSection) =>
    desk
      ? {
          onDragOver: (e: DragEvent) => {
            const d = dragRef.current;
            if (!d || (d.kind !== 'widget' && d.kind !== 'shortcut')) return;
            if (freeSlot(s, d.widget) < 0) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';
            setSlotDrop(null);
            setSecTarget(s.id);
          },
          onDrop: (e: DragEvent) => {
            const d = dragRef.current;
            if (!d || (d.kind !== 'widget' && d.kind !== 'shortcut')) return;
            const at = freeSlot(s, d.widget);
            if (at < 0) return;
            e.preventDefault();
            e.stopPropagation();
            dropOnSlot(s, at, d);
            endDrag();
          },
        }
      : {};

  /** Panel click: put a widget or shortcut where a click would (D2) — the slot
   *  being picked, else the selected widget's section, else the first section
   *  with room; a new section when there's none. */
  const customs = draft.sections.filter((x): x is CustomSection => x.kind === 'custom');
  const pickSec = picking ? customs.find((x) => x.id === picking.sectionId) : undefined;
  const selSec = selected ? customs.find((x) => x.id === selected.sectionId) : undefined;
  const scTarget: CustomSection | undefined =
    (pickSec?.layout === 'shortcuts' ? pickSec : undefined) ??
    (selSec?.layout === 'shortcuts' ? selSec : undefined) ??
    customs.find((x) => x.layout === 'shortcuts');
  const addWidgetByClick = (widget: string) => {
    if (pickSec && picking && pickSec.layout !== 'shortcuts') {
      setDraft(setWidget(draft, pickSec.id, picking.slot, widget, newId('w')));
    } else {
      const order = [
        ...(selSec && selSec.layout !== 'shortcuts' ? [selSec] : []),
        ...customs.filter((x) => x.layout !== 'shortcuts'),
      ];
      const sec = order.find((x) => freeSlot(x, widget) >= 0);
      if (sec) setDraft(setWidget(draft, sec.id, freeSlot(sec, widget), widget, newId('w')));
      else {
        const id = newId('sec');
        const next = addSection(
          draft,
          { id, title: t.todayLayouts.pair, layout: 'pair' },
          lastAfter(),
        );
        setDraft(setWidget(next, id, 0, widget, newId('w')));
      }
    }
    setPicking(null);
    setSelected(null);
  };
  const addShortcutByClick = (widget: string) => {
    if (!scTarget) {
      const id = newId('sec');
      const next = addSection(
        draft,
        { id, title: t.todayLayouts.shortcuts, layout: 'shortcuts' },
        lastAfter(),
      );
      setDraft(insertWidget(next, id, widget, newId('w')));
    } else if (freeSlot(scTarget, widget) >= 0) {
      // Swapping a picked shortcut replaces it in place; otherwise it goes at the picked slot / end.
      const slot = pickSec?.id === scTarget.id && picking ? picking.slot : undefined;
      setDraft(
        slot != null && slot < scTarget.items.length
          ? setWidget(draft, scTarget.id, slot, widget, newId('w'))
          : insertWidget(draft, scTarget.id, widget, newId('w'), slot),
      );
    }
    setPicking(null);
    setSelected(null);
  };
  /** Desktop: an empty slot (or ⇄) targets the panel instead of opening a sheet. */
  const pick = (p: Picking) => {
    if (desk) {
      const same = picking?.sectionId === p.sectionId && picking.slot === p.slot;
      setPicking(same ? null : p);
      if (!same) setTab(p.size === 'XS' ? 'shortcuts' : 'widgets');
    } else setPicking(p);
  };

  const save = () => {
    if (dirty) setTodayLayout(draft);
    onClose();
  };
  const cancel = () => (dirty ? setConfirmDiscard(true) : onClose());
  const n = draft.sections.length;

  const renderItem = (s: CustomSection, i: number) => {
    const it = s.items[i];
    const size = slotSize(s.layout, i);
    const cls = `tdc-slot size-${size.toLowerCase()}`;
    const isPicking = picking?.sectionId === s.id && picking.slot === i;
    const known = !!it && (it.size === 'XS' ? !!shortcutById(it.widget) : !!widgetById(it.widget));
    const isDrop = slotDrop?.sectionId === s.id && slotDrop.slot === i;
    const dnd = slotDnd(s, i);
    if (!it || !known || isPicking)
      return (
        <button
          key={`empty-${i}`}
          type="button"
          className={`${cls} is-empty${isPicking ? ' is-picking' : ''}${isDrop ? ' is-drop' : ''}`}
          onClick={() => pick({ sectionId: s.id, slot: i, size })}
          {...dnd}
        >
          {isPicking ? (
            t.todayPicking
          ) : (
            <>
              <Icon name="plus" />
              <span>{size === 'XS' ? t.todayAdd : t.todayAddWidget}</span>
            </>
          )}
        </button>
      );
    const isSel = selected?.widgetId === it.id;
    const sc = it.size === 'XS' ? shortcutById(it.widget) : undefined;
    const node: ReactNode =
      it.size === 'XS'
        ? sc
          ? renderShortcut(sc, ctx, isSel, () => undefined)
          : null
        : (widgetById(it.widget)?.render(it.size, ctx) ?? null);
    const toggle = () => setSelected(isSel ? null : { sectionId: s.id, widgetId: it.id });
    if (desk) {
      const dragging = drag?.kind === 'item' && drag.widgetId === it.id;
      return (
        <div
          key={it.id}
          role="button"
          tabIndex={0}
          draggable
          className={`${cls}${isSel ? ' is-selected' : ''}${isDrop && !dragging ? ' is-drop' : ''}${dragging ? ' is-dragging' : ''}`}
          aria-pressed={isSel}
          onClick={toggle}
          onKeyDown={pressKeys(toggle)}
          onDragStart={(e) =>
            startDrag(
              e,
              { kind: 'item', sectionId: s.id, widgetId: it.id },
              it.widget,
              e.currentTarget,
            )
          }
          onDragEnd={endDrag}
          {...dnd}
        >
          <span className="tdc-inert" inert aria-hidden="true">
            {node}
          </span>
        </div>
      );
    }
    return (
      <button
        key={it.id}
        type="button"
        className={`${cls}${isSel ? ' is-selected' : ''}`}
        aria-pressed={isSel}
        onClick={toggle}
      >
        {node}
      </button>
    );
  };

  const renderSection = (s: TodayLayout['sections'][number], idx: number) => {
    const up = (
      <button
        type="button"
        className="tdc-ib"
        aria-label={t.todayMoveUp}
        disabled={idx <= 1}
        onClick={() => setDraft(moveSection(draft, s.id, -1))}
      >
        <Icon name="caret-up" />
      </button>
    );
    const down = (
      <button
        type="button"
        className="tdc-ib"
        aria-label={t.todayMoveDown}
        disabled={idx === 0 || idx >= n - 1}
        onClick={() => setDraft(moveSection(draft, s.id, 1))}
      >
        <Icon name="caret-down" />
      </button>
    );
    const name = s.kind === 'core' ? t.todayCore[s.id] : s.title;
    const handle = desk && (
      <DragHandle
        label={t.todayDragSection(name)}
        pinned={s.id === 'status'}
        dragging={drag?.kind === 'section' && drag.id === s.id}
        onMove={(dir) => setDraft(moveSection(draft, s.id, dir))}
        onDragStart={(e) =>
          startDrag(e, { kind: 'section', id: s.id }, name, e.currentTarget.closest('.tdc-block'))
        }
        onDragEnd={endDrag}
      />
    );
    const blockCls = (extra: string) =>
      `tdc-block${extra}${drag?.kind === 'section' && drag.id === s.id ? ' is-dragging' : ''}${secTarget === s.id ? ' is-target' : ''}`;
    if (s.kind === 'core') {
      return (
        <div key={s.id} className={blockCls('')} data-sec-idx={idx}>
          <div className="tdc-tool">
            {handle}
            <div className="tdc-name">
              <span>{t.todayCore[s.id]}</span>
              <span className="tdc-tag">
                {s.id === 'status'
                  ? t.todayPinnedTag
                  : isConfigurable(s.id)
                    ? `${t.todayCoreTag} · ${summary(s.id)}`
                    : t.todayCoreTag}
              </span>
            </div>
            {s.id !== 'status' && up}
            {s.id !== 'status' && down}
            {isConfigurable(s.id) && desk && (
              <Button
                variant="secondary"
                size="sm"
                aria-label={`${t.todayConfigure} · ${t.todayCore[s.id]}`}
                onClick={() => setConfiguring(s.id as ConfigurableCore)}
              >
                {t.todayConfigure}
              </Button>
            )}
            {isConfigurable(s.id) && !desk && (
              <button
                type="button"
                className="tdc-ib"
                aria-label={`${t.todayConfigure} · ${t.todayCore[s.id]}`}
                onClick={() => setConfiguring(s.id as ConfigurableCore)}
              >
                <Icon name="sliders-horizontal" />
              </button>
            )}
          </div>
          {s.id === 'status' ? (
            <div className="tdc-hint">{t.todayStatusHint}</div>
          ) : (
            <div className="tdc-preview" aria-hidden="true">
              {coreBlocks[s.id]}
            </div>
          )}
        </div>
      );
    }
    const max = slotCount(s.layout);
    const shown =
      s.layout === 'shortcuts' || s.layout === 'rows' ? Math.min(max, s.items.length + 1) : max;
    const sel =
      selected?.sectionId === s.id ? s.items.find((w) => w.id === selected.widgetId) : undefined;
    const selIdx = sel ? s.items.indexOf(sel) : -1;
    return (
      <div key={s.id} className={blockCls(' is-custom')} data-sec-idx={idx} {...blockDnd(s)}>
        <div className="tdc-tool">
          {handle}
          <div className="tdc-name">
            <span>{s.title}</span>
            <span className="tdc-tag is-custom">
              {SECTION_LAYOUTS.find((l) => l.id === s.layout)?.sizes}
            </span>
          </div>
          {up}
          {down}
          <button
            type="button"
            className="tdc-ib"
            aria-label={t.todayEditSectionTitle}
            onClick={() => setEditing(s)}
          >
            <Icon name="sliders-horizontal" />
          </button>
          <button
            type="button"
            className="tdc-ib is-danger"
            aria-label={t.todayRemoveSection}
            onClick={() => setConfirmRemove(s)}
          >
            <Icon name="trash" />
          </button>
        </div>
        <WidgetGrid layout={s.layout}>
          {Array.from({ length: shown }, (_, i) => (
            <Fragment key={i}>{renderItem(s, i)}</Fragment>
          ))}
        </WidgetGrid>
        {sel && (
          <div className="tdc-selbar">
            <span className="tdc-selbar-label">
              {sel.size === 'XS'
                ? shortcutById(sel.widget)?.label(ctx)
                : widgetById(sel.widget)?.name(tw)}
            </span>
            <button
              type="button"
              className="tdc-ib"
              aria-label={t.todayMoveUp}
              disabled={selIdx <= 0}
              onClick={() => setDraft(moveWidget(draft, s.id, sel.id, -1))}
            >
              <Icon name="caret-left" />
            </button>
            <button
              type="button"
              className="tdc-ib"
              aria-label={t.todayMoveDown}
              disabled={selIdx >= s.items.length - 1}
              onClick={() => setDraft(moveWidget(draft, s.id, sel.id, 1))}
            >
              <Icon name="caret-right" />
            </button>
            <button
              type="button"
              className="tdc-ib"
              aria-label={t.todayAddWidget}
              onClick={() => pick({ sectionId: s.id, slot: selIdx, size: sel.size })}
            >
              <Icon name="swap" />
            </button>
            <button
              type="button"
              className="tdc-ib is-danger"
              aria-label={t.todayRemove}
              onClick={() => {
                setDraft(removeWidget(draft, s.id, sel.id));
                setSelected(null);
              }}
            >
              <Icon name="trash" />
            </button>
          </div>
        )}
      </div>
    );
  };

  const dropLine = <div className="tdc-drop" role="presentation" />;
  return (
    <div
      className={`tdc${desk ? ' is-desk' : ''}${drag ? ' is-dragging' : ''}`}
      {...(desk
        ? { onDragOver: onListDragOver, onDrop: onListDrop, onDragLeave: onListDragLeave }
        : {})}
    >
      {desk ? (
        <div className="tdc-top is-desk">
          <div className="tdc-top-text">
            <span className="tdc-top-title">{t.todayCustomize}</span>
            <span className="tdc-top-sub">{t.todayDeskSub}</span>
          </div>
          <div className="tdc-top-actions">
            <Button variant="secondary" size="sm" onClick={cancel}>
              {t.todayEditCancel}
            </Button>
            <Button variant="primary" size="sm" disabled={!dirty} onClick={save}>
              {t.todaySave}
            </Button>
          </div>
        </div>
      ) : (
        <div className="tdc-top">
          <Button variant="ghost" size="sm" onClick={cancel}>
            {t.todayEditCancel}
          </Button>
          <span className="tdc-top-title">{t.todayCustomize}</span>
          <Button variant="primary" size="sm" disabled={!dirty} onClick={save}>
            {t.todaySave}
          </Button>
        </div>
      )}

      {draft.sections.map((s, idx) => (
        <Fragment key={s.id}>
          {desk && secDrop === idx && dropLine}
          {renderSection(s, idx)}
          {!desk && idx < n - 1 && (
            <button type="button" className="tdc-insert" onClick={() => setInsertAfter(s.id)}>
              <span>
                <Icon name="plus" /> {t.todayAddSectionHere}
              </span>
            </button>
          )}
        </Fragment>
      ))}
      {desk && secDrop === n && dropLine}

      {!desk && (
        <Button variant="primary" icon="plus" fullWidth onClick={() => setAdding(true)}>
          {t.todayAddSection}
        </Button>
      )}
      <div className="tdc-foot">
        <span />
        <button
          type="button"
          className="tdc-link"
          onClick={() => setDraft({ ...DEFAULT_LAYOUT, updatedAt: Date.now() })}
        >
          {t.todayResetLayout}
        </button>
      </div>

      {configuring && (
        <CoreConfigSheet
          id={configuring}
          draft={draft}
          onChange={setDraft}
          preview={coreBlocks[configuring]}
          hasClients={hasClients}
          onClose={() => setConfiguring(null)}
        />
      )}
      {(adding || insertAfter) && (
        <SectionSheet
          heading={t.todayNewSection}
          submitLabel={t.todayAddSection}
          afterName={(() => {
            const id =
              insertAfter ?? [...draft.sections].reverse().find((x) => x.id !== 'history')?.id;
            const sec = draft.sections.find((x) => x.id === id);
            return !sec ? undefined : sec.kind === 'core' ? t.todayCore[sec.id] : sec.title;
          })()}
          onClose={() => {
            setAdding(false);
            setInsertAfter(null);
          }}
          onSubmit={(title, layout) => {
            const after =
              insertAfter ?? [...draft.sections].reverse().find((x) => x.id !== 'history')?.id;
            setDraft(addSection(draft, { id: newId('sec'), title, layout }, after));
            setAdding(false);
            setInsertAfter(null);
          }}
        />
      )}
      {editing && (
        <SectionSheet
          heading={t.todayEditSectionTitle}
          submitLabel={t.todaySave}
          initialTitle={editing.title}
          initialLayout={editing.layout}
          section={editing}
          onClose={() => setEditing(null)}
          onSubmit={(title, layout) => {
            setDraft(setSectionMeta(draft, editing.id, { title, layout }));
            setEditing(null);
          }}
        />
      )}
      {confirmDiscard && (
        <ConfirmDialog
          title={t.todayDiscardTitle}
          body={t.todayDiscardBody}
          confirmLabel={t.todayDiscard}
          cancelLabel={t.todayKeepEditing}
          danger
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={onClose}
        />
      )}
      {picking && !desk && picking.size === 'XS' && (
        <ShortcutsSheet
          ctx={ctx}
          max={slotCount('shortcuts')}
          initial={
            (
              draft.sections.find((x) => x.id === picking.sectionId) as CustomSection | undefined
            )?.items.map((w) => w.widget) ?? []
          }
          onClose={() => setPicking(null)}
          onDone={(ids) => {
            setDraft({
              ...draft,
              updatedAt: Date.now(),
              sections: draft.sections.map((x) => {
                if (x.id !== picking.sectionId || x.kind !== 'custom') return x;
                const keep = new Map(x.items.map((w) => [w.widget, w]));
                return {
                  ...x,
                  items: ids.map(
                    (id) => keep.get(id) ?? { id: newId('w'), widget: id, size: 'XS' as const },
                  ),
                };
              }),
            });
            setPicking(null);
            setSelected(null);
          }}
        />
      )}
      {picking && !desk && picking.size !== 'XS' && (
        <PickerSheet
          size={picking.size}
          ctx={ctx}
          onClose={() => setPicking(null)}
          onPick={(id) => {
            setDraft(setWidget(draft, picking.sectionId, picking.slot, id, newId('w')));
            setPicking(null);
            setSelected(null);
          }}
        />
      )}
      {confirmRemove && (
        <ConfirmDialog
          title={t.todayRemoveTitle(confirmRemove.title)}
          body={
            confirmRemove.items.length > 0
              ? t.todayRemoveBodyN(confirmRemove.items.length)
              : t.todayRemoveBody
          }
          confirmLabel={t.todayRemove}
          cancelLabel={t.todayEditCancel}
          danger
          onCancel={() => setConfirmRemove(null)}
          onConfirm={() => {
            setDraft(removeSection(draft, confirmRemove.id));
            setConfirmRemove(null);
          }}
        />
      )}
      {side &&
        createPortal(
          <AddPanel
            tab={tab}
            onTab={setTab}
            ctx={ctx}
            picking={picking}
            scTarget={scTarget}
            drag={drag}
            onDragStart={startDrag}
            onDragEnd={endDrag}
            onAddLayout={(l) => addLayout(l)}
            onAddWidget={addWidgetByClick}
            onAddShortcut={addShortcutByClick}
          />,
          side,
        )}
    </div>
  );
}

/** Desktop right panel while editing (D2): "Add to Today" in place of Start.
 *  Everything here is draggable onto the page, or clicked to add. */
function AddPanel({
  tab,
  onTab,
  ctx,
  picking,
  scTarget,
  drag,
  onDragStart,
  onDragEnd,
  onAddLayout,
  onAddWidget,
  onAddShortcut,
}: {
  tab: PanelTab;
  onTab: (t: PanelTab) => void;
  ctx: ShortcutCtx;
  picking: Picking | null;
  /** The Shortcuts section a click adds to — its shortcuts show as added. */
  scTarget?: CustomSection;
  drag: Drag | null;
  onDragStart: (e: DragEvent, d: Drag, label: string, image?: Element | null) => void;
  onDragEnd: () => void;
  onAddLayout: (l: SectionLayout) => void;
  onAddWidget: (id: string) => void;
  onAddShortcut: (id: string) => void;
}) {
  const { t } = useT();
  const tw = useTw();
  const [group, setGroup] = useState<string>('all');
  const [allActs, setAllActs] = useState(false);
  const isDragged = (d: Drag) => JSON.stringify(d) === JSON.stringify(drag);

  /** A draggable, clickable tile. */
  const tile = (
    key: string,
    d: Drag,
    label: string,
    className: string,
    onPick: () => void,
    children: ReactNode,
    disabled = false,
  ) => (
    <div
      key={key}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-disabled={disabled || undefined}
      draggable={!disabled}
      className={`${className}${disabled ? ' is-added' : ''}${isDragged(d) ? ' is-dragging' : ''}`}
      onClick={disabled ? undefined : onPick}
      onKeyDown={disabled ? undefined : pressKeys(onPick)}
      onDragStart={(e) => onDragStart(e, d, label, e.currentTarget)}
      onDragEnd={onDragEnd}
    >
      <span className="tdc-inert" inert aria-hidden="true">
        {children}
      </span>
    </div>
  );

  const widgetGroups = WIDGET_GROUPS.filter((g: WidgetGroup) => WIDGETS.some((w) => w.group === g));
  const freq = new Map<string, number>();
  for (const a of ctx.store.activities) freq.set(a.type, (freq.get(a.type) ?? 0) + 1);
  const added = new Set(scTarget?.items.map((w) => w.widget) ?? []);
  const full = !!scTarget && scTarget.items.length >= slotCount('shortcuts');
  const acts = SHORTCUTS.filter((x) => x.group === 'activity').sort(
    (a, b) => (freq.get(b.id.slice(7)) ?? 0) - (freq.get(a.id.slice(7)) ?? 0),
  );
  const actsShown = allActs ? acts : acts.slice(0, 9);
  const scTile = (sc: (typeof SHORTCUTS)[number]) =>
    tile(
      sc.id,
      { kind: 'shortcut', widget: sc.id },
      sc.label(ctx),
      'tdc-ap-sc',
      () => onAddShortcut(sc.id),
      renderShortcut(sc, ctx, false, () => undefined),
      added.has(sc.id) || full,
    );

  return (
    <div className="tdc-ap">
      <div className="tdc-ap-head">
        <div className="tdc-ap-title">{t.todayAddToToday}</div>
        <div className="tdc-ap-sub">{t.todayAddToTodaySub}</div>
      </div>
      <Segmented<PanelTab>
        options={[
          { value: 'sections', label: t.todayTabSections },
          { value: 'widgets', label: t.todayTabWidgets },
          { value: 'shortcuts', label: t.todayScTitle },
        ]}
        value={tab}
        onChange={onTab}
        label={t.todayAddToToday}
        size="sm"
      />
      {picking && (
        <div className="tdc-ap-picking" role="status">
          <Icon name="plus" />
          <span>
            {t.todayPicking} {t.todaySlotTitle[picking.size]}
          </span>
        </div>
      )}
      {tab === 'sections' && (
        <div className="tdc-ap-layouts">
          {SECTION_LAYOUTS.map((l) =>
            tile(
              l.id,
              { kind: 'layout', layout: l.id },
              t.todayLayouts[l.id],
              'tdc-lay',
              () => onAddLayout(l.id),
              <>
                <LayoutPreview layout={l.id} />
                <span className="tdc-lay-name">
                  {t.todayLayouts[l.id]}
                  <small>{l.sizes}</small>
                </span>
              </>,
            ),
          )}
        </div>
      )}
      {tab === 'widgets' && (
        <>
          <div className="tdc-chips tdc-ap-chips">
            {['all', ...widgetGroups].map((g) => (
              <Chip key={g} size="sm" selected={group === g} onClick={() => setGroup(g)}>
                {g === 'all' ? t.todayAll : tw.groups[g]}
              </Chip>
            ))}
          </div>
          {widgetGroups
            .filter((g) => group === 'all' || g === group)
            .map((g) => (
              <Fragment key={g}>
                <div className="tdc-pick-group">{tw.groups[g]}</div>
                <div className="tdc-pick-grid">
                  {WIDGETS.filter((w) => w.group === g).map((w) =>
                    tile(
                      w.id,
                      { kind: 'widget', widget: w.id },
                      w.name(tw),
                      'tdc-pick size-s',
                      () => onAddWidget(w.id),
                      <>
                        <span className="tdc-pick-tile">{w.render('S', ctx)}</span>
                        <span className="tdc-pick-name">{w.name(tw)}</span>
                      </>,
                    ),
                  )}
                </div>
              </Fragment>
            ))}
        </>
      )}
      {tab === 'shortcuts' && (
        <>
          <div className="tdc-pick-group">{tw.groups.train}</div>
          <div className="tdc-ap-scgrid">
            {SHORTCUTS.filter((x) => x.group === 'train').map(scTile)}
          </div>
          <div className="tdc-pick-group">{tw.groups.activity}</div>
          <div className="tdc-ap-scgrid">
            {actsShown.map(scTile)}
            {!allActs && acts.length > actsShown.length && (
              <button type="button" className="tdc-sc-more" onClick={() => setAllActs(true)}>
                <Icon name="magnifying-glass" />
                <span>{t.todayScAll(acts.length)}</span>
              </button>
            )}
          </div>
          <div className="tdc-pick-group">{tw.groups.health}</div>
          <div className="tdc-ap-scgrid">
            {SHORTCUTS.filter((x) => x.group === 'health').map(scTile)}
          </div>
        </>
      )}
    </div>
  );
}

function LayoutPreview({ layout }: { layout: SectionLayout }) {
  const slots = SECTION_LAYOUTS.find((l) => l.id === layout)?.slots ?? [];
  return (
    <span className="tdc-lay-pv">
      {slots.map((s, i) => (
        <i key={i} className={s.toLowerCase()} />
      ))}
    </span>
  );
}

function SectionSheet({
  heading,
  submitLabel,
  initialTitle,
  initialLayout = 'pair',
  afterName,
  section,
  onClose,
  onSubmit,
}: {
  heading: string;
  afterName?: string;
  /** The section being edited: warns what a layout switch would remove. */
  section?: CustomSection;
  submitLabel: string;
  initialTitle?: string;
  initialLayout?: SectionLayout;
  onClose: () => void;
  onSubmit: (title: string, layout: SectionLayout) => void;
}) {
  const { t } = useT();
  const [title, setTitle] = useState(initialTitle ?? t.todayUntitled);
  const [layout, setLayout] = useState<SectionLayout>(initialLayout);
  return (
    <Sheet onClose={onClose} className="tdc-picker">
      <div className="tdc-sheet-title">{heading}</div>
      {afterName && (
        <div className="tdc-sheet-sub">
          {t.todayGoesAfter}
          <b>{afterName}</b>
        </div>
      )}
      <div className="tdc-sheet-lab">{t.todaySectionTitle}</div>
      <input
        className="tdc-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label={t.todaySectionTitle}
      />
      <div className="tdc-sheet-lab">{t.todaySectionLayout}</div>
      <div className="tdc-layouts">
        {SECTION_LAYOUTS.map((l) => (
          <button
            key={l.id}
            type="button"
            className={`tdc-lay${layout === l.id ? ' is-on' : ''}`}
            aria-pressed={layout === l.id}
            onClick={() => setLayout(l.id)}
          >
            <LayoutPreview layout={l.id} />
            <span className="tdc-lay-name">
              {t.todayLayouts[l.id]}
              <small>{l.sizes}</small>
            </span>
          </button>
        ))}
      </div>
      {(() => {
        if (!section || layout === section.layout) return null;
        const ch = layoutChange(section, layout);
        if (!ch.wrongKind && !ch.overflow) return null;
        return (
          <div className="tdc-warn" role="status">
            <Icon name="warning" />
            <span>
              {ch.wrongKind > 0
                ? t.todayLayoutKind(ch.wrongKind)
                : t.todayLayoutOverflow(ch.overflow)}
            </span>
          </div>
        );
      })()}
      <div className="tdc-sizes-note">{t.todaySizesNote}</div>
      <div className="tdc-actions">
        <Button variant="secondary" onClick={onClose}>
          {t.todayEditCancel}
        </Button>
        <Button
          variant="primary"
          fullWidth
          onClick={() => onSubmit(title.trim() || t.todayUntitled, layout)}
        >
          {submitLabel}
        </Button>
      </div>
    </Sheet>
  );
}

/** Pick a widget (or a shortcut for XS slots), previewed at the slot's size
 *  (design B5): filter by group, tap to choose, confirm with "Put X here". */
function PickerSheet({
  size,
  ctx,
  onClose,
  onPick,
}: {
  size: Picking['size'];
  ctx: ShortcutCtx;
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  const { t } = useT();
  const tw = useTw();
  const [group, setGroup] = useState<string>('all');
  const [chosen, setChosen] = useState<string | null>(null);
  const cls = `tdc-pick size-${size.toLowerCase()}`;

  type Item = { id: string; group: string; name: string; node: ReactNode };
  const items: Item[] =
    size === 'XS'
      ? SHORTCUTS.map((sc) => ({
          id: sc.id,
          group: sc.group,
          name: sc.label(ctx),
          node: renderShortcut(sc, ctx, chosen === sc.id, () => undefined),
        }))
      : WIDGETS.map((w) => ({
          id: w.id,
          group: w.group,
          name: w.name(tw),
          node: w.render(size, ctx),
        }));
  const groupIds: string[] =
    size === 'XS'
      ? ['train', 'health', 'activity']
      : WIDGET_GROUPS.filter((g: WidgetGroup) => WIDGETS.some((w) => w.group === g));
  const shown = groupIds.filter((g) => group === 'all' || g === group);
  const chosenName = items.find((i) => i.id === chosen)?.name;

  return (
    <Sheet onClose={onClose} className="tdc-picker">
      <div className="tdc-sheet-title">{t.todaySlotTitle[size]}</div>
      <div className="tdc-sheet-sub">{t.todayPickHint}</div>
      <div className="tdc-chips">
        {['all', ...groupIds].map((g) => (
          <Chip key={g} size="sm" selected={group === g} onClick={() => setGroup(g)}>
            {g === 'all' ? t.todayAll : tw.groups[g as keyof typeof tw.groups]}
          </Chip>
        ))}
      </div>
      {shown.map((g) => (
        <Fragment key={g}>
          {group === 'all' && (
            <div className="tdc-pick-group">{tw.groups[g as keyof typeof tw.groups]}</div>
          )}
          <div className="tdc-pick-grid">
            {items
              .filter((i) => i.group === g)
              .map((i) => (
                <button
                  key={i.id}
                  type="button"
                  className={`${cls}${chosen === i.id ? ' is-chosen' : ''}`}
                  aria-pressed={chosen === i.id}
                  aria-label={i.name}
                  onClick={() => setChosen(i.id)}
                >
                  <span className="tdc-pick-tile">{i.node}</span>
                  {size !== 'XS' && <span className="tdc-pick-name">{i.name}</span>}
                </button>
              ))}
          </div>
        </Fragment>
      ))}
      <div className="tdc-pick-foot">
        <Button
          variant="primary"
          fullWidth
          disabled={!chosen}
          onClick={() => chosen && onPick(chosen)}
        >
          {chosenName ? t.todayPutHere(chosenName) : t.todayAddWidget}
        </Button>
      </div>
    </Sheet>
  );
}

/** Shortcuts section contents (design T3): multi-select with checkmarks,
 *  favourite activities first, the long tail behind "All N". */
function ShortcutsSheet({
  ctx,
  max,
  initial,
  onClose,
  onDone,
}: {
  ctx: ShortcutCtx;
  max: number;
  initial: string[];
  onClose: () => void;
  onDone: (ids: string[]) => void;
}) {
  const { t } = useT();
  const tw = useTw();
  const [ids, setIds] = useState<string[]>(initial);
  const [group, setGroup] = useState<'all' | 'train' | 'activity' | 'health'>('all');
  const [allActs, setAllActs] = useState(false);

  const toggle = (id: string) =>
    setIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= max ? cur : [...cur, id],
    );

  // Favourites: activity types by how often they were logged, chosen ones first.
  const freq = new Map<string, number>();
  for (const a of ctx.store.activities) freq.set(a.type, (freq.get(a.type) ?? 0) + 1);
  const acts = SHORTCUTS.filter((s) => s.group === 'activity').sort((a, b) => {
    const sa = ids.includes(a.id) ? 1 : 0;
    const sb = ids.includes(b.id) ? 1 : 0;
    if (sa !== sb) return sb - sa;
    return (freq.get(b.id.slice(7)) ?? 0) - (freq.get(a.id.slice(7)) ?? 0);
  });
  const collapsed = group === 'all' && !allActs;
  const actsShown = collapsed ? acts.slice(0, 7) : acts;

  const tile = (sc: (typeof SHORTCUTS)[number]) => (
    <div key={sc.id} className="tdc-sc">
      {renderShortcut(sc, ctx, ids.includes(sc.id), () => toggle(sc.id))}
    </div>
  );
  const groups: { key: 'train' | 'activity' | 'health'; title: string }[] = [
    { key: 'train', title: tw.groups.train },
    { key: 'activity', title: t.todayScActs },
    { key: 'health', title: tw.groups.health },
  ];

  return (
    <Sheet onClose={onClose} className="tdc-picker">
      <div className="tdc-sheet-head">
        <div className="tdc-sheet-title">{t.todayScTitle}</div>
        <span className="tdc-sheet-count">{t.todayScCount(ids.length, max)}</span>
      </div>
      <div className="tdc-sheet-sub">{t.todayScSub}</div>
      <div className="tdc-chips">
        {(['all', 'train', 'activity', 'health'] as const).map((g) => (
          <Chip key={g} size="sm" selected={group === g} onClick={() => setGroup(g)}>
            {g === 'all' ? t.todayAll : tw.groups[g]}
          </Chip>
        ))}
      </div>
      {groups
        .filter((g) => group === 'all' || group === g.key)
        .map((g) => (
          <Fragment key={g.key}>
            <div className="tdc-pick-group">{g.title}</div>
            <div className="tdc-pick-grid">
              {g.key === 'activity'
                ? actsShown.map(tile)
                : SHORTCUTS.filter((s) => s.group === g.key).map(tile)}
              {g.key === 'activity' && collapsed && acts.length > 7 && (
                <button type="button" className="tdc-sc-more" onClick={() => setAllActs(true)}>
                  <Icon name="magnifying-glass" />
                  <span>{t.todayScAll(acts.length)}</span>
                </button>
              )}
            </div>
          </Fragment>
        ))}
      <div className="tdc-pick-foot">
        <Button variant="primary" fullWidth onClick={() => onDone(ids)}>
          {t.todayEditDone}
        </Button>
      </div>
    </Sheet>
  );
}
