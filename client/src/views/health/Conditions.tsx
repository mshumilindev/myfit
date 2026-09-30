/**
 * Long-term conditions inside Health: the list, the add / edit sheet (search or browse
 * the catalogue, severity, coach sharing, dates for temporary ones) and
 * delete with confirmation. Kit primitives only. Shown while the `conditions` flag is on.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { effectText } from '../../conditionText';
import type { CoachView } from '../../conditions';
import { BackButton } from '../../components/ui/BackButton';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { IconTile } from '../../components/ui/IconTile';
import { SearchField } from '../../components/ui/SearchField';
import { Segmented } from '../../components/ui/Segmented';
import { Field } from '../../components/ui/Field';
import { BodyMapPicker } from './BodyMapPicker';
import { Button } from '../../components/ui/Button';
import { Notice } from '../../components/ui/Notice';
import { StickyActionBar } from '../../components/ui/StickyActionBar';
import { Tag } from '../../components/ui/Tag';
import { useFlag } from '../../data/flags';
import { ConfirmDialog } from '../../components/ui/Overlays';
import {
  CONDITION_CATEGORIES,
  catalogCondition,
  searchConditions,
  type CatalogCondition,
  type ConditionCategory,
} from '../../data/conditionCatalog';
import {
  isActive,
  isEnded,
  isTemporary,
  suggestedEnd,
  temporaryAuto,
  temporaryProgress,
} from '../../conditions';
import { toneClass } from '../../components/ui/tones';
import { useT } from '../../i18n';
import { useConditionName, useConditionSearch } from '../../useConditionName';
import {
  addCondition,
  deleteCondition,
  setConditionsShare,
  updateCondition,
  useStore,
} from '../../store';
import type { ChronicCondition, ConditionShare } from '../../types';

const ymd = (ms: number): string => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const fromYmd = (s: string): number | undefined => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : undefined;
};

function Form({
  cat,
  existing,
  onDone,
  frame,
  web,
}: {
  web: boolean;
  cat: CatalogCondition;
  existing?: ChronicCondition;
  onDone: () => void;
  /** Places the fields and the pinned action bar (the bar never scrolls with the fields). */
  frame: (content: ReactNode, bar: ReactNode) => ReactNode;
}) {
  const { t } = useT();
  const { conditionsShare } = useStore();
  const temp = isTemporary(cat.key);
  const auto = temporaryAuto(cat.key);
  const [severity, setSeverity] = useState<1 | 2 | 3>(existing?.severity ?? 2);
  const [share, setShare] = useState<ConditionShare>(existing?.share ?? 'inherit');
  const [start, setStart] = useState(() => ymd(existing?.startedAt ?? Date.now()));
  const [end, setEnd] = useState(() => {
    const e = existing?.endsAt ?? suggestedEnd(cat.key, existing?.startedAt ?? Date.now());
    return e ? ymd(e) : '';
  });
  const [confirm, setConfirm] = useState(false);

  const save = () => {
    const startedAt = temp ? fromYmd(start) : undefined;
    const endsAt = temp ? fromYmd(end) : undefined;
    const base = {
      severity,
      share,
      startedAt,
      endsAt,
    };
    if (existing) updateCondition(existing.id, base);
    else addCondition({ key: cat.key, ...base });
    onDone();
  };
  const hint = {
    inherit: t.cndShareHintInheritNow(
      { off: t.cndShareOff, effects: t.cndShareEffects, full: t.cndShareFull }[conditionsShare],
    ),
    off: t.cndShareHintOff,
    effects: t.cndShareHintEffects,
    full: t.cndShareHintFull,
  }[share];

  const content = (
    <div className="ul-flex ul-col ug-12">
      <Segmented
        label={t.cndSeverity}
        variant="track"
        tone="chronic"
        value={severity}
        onChange={setSeverity}
        options={[
          { value: 1, label: t.cndMild },
          { value: 2, label: t.cndModerate },
          { value: 3, label: t.cndSevere },
        ]}
      />
      {temp && (
        <div className="ul-flex ug-8">
          <Field
            label={t.cndStarted}
            type="date"
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              const s = fromYmd(e.target.value);
              if (s && !existing) {
                const n = suggestedEnd(cat.key, s);
                if (n) setEnd(ymd(n));
              }
            }}
          />
          {!auto && (
            <Field
              label={t.cndEnds}
              type="date"
              value={end}
              min={start}
              onChange={(e) => setEnd(e.target.value)}
            />
          )}
        </div>
      )}
      <div className="ul-flex ul-col ug-6">
        <span className="ut-sm ut-w6">{t.cndShare}</span>
        <Segmented
          label={t.cndShare}
          variant="track"
          tone="chronic"
          value={share}
          onChange={setShare}
          options={[
            { value: 'inherit', label: t.cndShareInherit },
            { value: 'off', label: t.cndShareOff },
            { value: 'effects', label: t.cndShareEffects },
            { value: 'full', label: t.cndShareFull },
          ]}
        />
        <span className="ut-sm ut-muted">{hint}</span>
      </div>
      {existing && (
        <Button variant="danger" fullWidth onClick={() => setConfirm(true)}>
          {t.cndDelete}
        </Button>
      )}
      {confirm && existing && (
        <ConfirmDialog
          title={t.cndDeleteAsk}
          body={t.cndDeleteBody}
          confirmLabel={t.cndDelete}
          cancelLabel={t.cndCancel}
          danger
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            deleteCondition(existing.id);
            onDone();
          }}
        />
      )}
    </div>
  );
  const bar = (
    <StickyActionBar
      variant={web ? 'panel' : 'page'}
      surface={web ? 'surface' : 'bg'}
      className={toneClass('chronic')}
    >
      <Button variant="fill" fullWidth onClick={save}>
        {existing ? t.cndSave : t.cndAddBtn}
      </Button>
    </StickyActionBar>
  );
  return <>{frame(content, bar)}</>;
}

function Picker({ onPick }: { onPick: (c: CatalogCondition) => void }) {
  const { t } = useT();
  const condName = useConditionName();
  const search = useConditionSearch();
  const [mode, setMode] = useState<'list' | 'body'>('list');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<ConditionCategory | null>(null);
  const counts = useMemo(() => {
    const n: Partial<Record<ConditionCategory, number>> = {};
    for (const c of searchConditions('')) n[c.category] = (n[c.category] ?? 0) + 1;
    return n;
  }, []);
  const results = useMemo(
    () => (q || cat ? search(q).filter((c) => !cat || c.category === cat) : []),
    [q, cat, search],
  );
  return (
    <div className="ul-flex ul-col ug-12">
      <Segmented
        label={t.cndModeList}
        variant="track"
        tone="chronic"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'list', label: t.cndModeList },
          { value: 'body', label: t.cndModeBody },
        ]}
      />
      {mode === 'body' && <BodyMapPicker onPick={onPick} />}
      {mode === 'list' && (
        <>
          <SearchField
            value={q}
            onChange={setQ}
            placeholder={t.cndSearch}
            clearLabel={t.cndClear}
          />
          {!q && !cat && (
            <GroupedList>
              {CONDITION_CATEGORIES.map((c) => (
                <ListRow
                  key={c.id}
                  icon={<IconTile tone="chronic" size={30} icon={c.icon} />}
                  label={t.cndCat[c.id]}
                  value={String(counts[c.id] ?? 0)}
                  chevron
                  onClick={() => setCat(c.id)}
                />
              ))}
            </GroupedList>
          )}
          {(q || cat) && (
            <>
              {cat && (
                <Button variant="secondary" onClick={() => setCat(null)}>
                  {t.cndCat[cat]} ×
                </Button>
              )}
              {results.length === 0 ? (
                <span className="ut-muted">{t.cndNoResults}</span>
              ) : (
                <GroupedList>
                  {results.slice(0, 40).map((c) => (
                    <ListRow
                      key={c.key}
                      icon={<IconTile tone="chronic" size={30} icon={c.icon} />}
                      label={condName(c)}
                      chevron
                      onClick={() => onPick(c)}
                    />
                  ))}
                </GroupedList>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function dayText(
  c: ChronicCondition,
  now: number,
  fmt: (d: number, n: number) => string,
): string | null {
  const p = temporaryProgress(c, now);
  return p ? fmt(p.day, p.total) : null;
}

/** The list inside Health: each row / "Add" opens a full page (see ConditionPage). */
export function ConditionsSection({ onOpen }: { onOpen: (cond: string) => void }) {
  const { t } = useT();
  const condName = useConditionName();
  const { conditions, conditionsShare } = useStore();
  const [now] = useState(() => Date.now());
  return (
    <div className="ul-flex ul-col ug-8">
      <GroupedList header={t.cndTitle} footer={conditions.length ? t.cndFooter : undefined}>
        {conditions.map((c) => {
          const cat = catalogCondition(c.key);
          if (!cat) return null;
          return (
            <ListRow
              key={c.id}
              icon={<IconTile tone="chronic" size={30} icon={cat.icon} />}
              label={condName(cat)}
              sub={[
                t.cndSev[c.severity],
                isEnded(c, now) ? t.cndEnded : dayText(c, now, t.cndDayOf),
              ]
                .filter(Boolean)
                .join(' · ')}
              trailing={c.share === 'off' ? <Tag tone="neutral">{t.cndShareOff}</Tag> : undefined}
              chevron
              onClick={() => onOpen(c.id)}
            />
          );
        })}
        <ListRow
          icon={<IconTile tone="chronic" size={30} icon="plus" />}
          label={t.cndAdd}
          chevron
          onClick={() => onOpen('new')}
        />
      </GroupedList>
      {conditions.length > 0 && (
        <div className="ul-flex ul-col ug-6">
          <span className="ut-sm ut-w6">{t.cndShareDefault}</span>
          <Segmented
            label={t.cndShareDefault}
            variant="track"
            tone="chronic"
            value={conditionsShare}
            onChange={setConditionsShare}
            options={[
              { value: 'off', label: t.cndShareOff },
              { value: 'effects', label: t.cndShareEffects },
              { value: 'full', label: t.cndShareFull },
            ]}
          />
        </div>
      )}
      {conditions.length === 0 && (
        <Notice tone="chronic" icon="shield-check" aligned>
          {t.cndEmpty}
        </Notice>
      )}
    </div>
  );
}

/**
 * A condition as its own page (not a drawer): `cond` is 'new' (pick, then `condKey`
 * opens the form) or the id of an existing condition.
 */
export function ConditionPage(props: {
  cond: string;
  condKey?: string;
  web: boolean;
  onBack: () => void;
  onPickKey: (key: string) => void;
}) {
  const { t } = useT();
  const condName = useConditionName();
  const { conditions } = useStore();
  const existing = props.cond === 'new' ? undefined : conditions.find((c) => c.id === props.cond);
  const cat = existing
    ? catalogCondition(existing.key)
    : props.condKey
      ? catalogCondition(props.condKey)
      : null;
  const title = cat ? condName(cat) : t.cndAdd;
  const webFrame = (content: ReactNode, bar?: ReactNode) => (
    <section className="hl-pane">
      <div className="hl-wc tight">
        <div className="hl-phd">
          <h2>{title}</h2>
        </div>
        {content}
      </div>
      {bar}
    </section>
  );
  const pageFrame = (content: ReactNode, bar?: ReactNode) => (
    <div className="screen hl">
      <div className="hl-pbar">
        <BackButton label={t.backAction} onClick={props.onBack} />
        <h1 className="hl-pt">{title}</h1>
      </div>
      <div className="hl-scroll">
        <div className="hl-cnt">{content}</div>
      </div>
      {bar}
    </div>
  );
  const frame = props.web ? webFrame : pageFrame;
  if (cat)
    return (
      <Form
        key={existing?.id ?? cat.key}
        cat={cat}
        existing={existing}
        web={props.web}
        onDone={props.onBack}
        frame={frame}
      />
    );
  if (props.cond === 'new') return frame(<Picker onPick={(c) => props.onPickKey(c.key)} />);
  return frame(null);
}

/** Today: one quiet row saying plans are adapted; opens Health. Hidden with no active conditions. */
export function ConditionsToday({ onOpen }: { onOpen: () => void }) {
  const { t } = useT();
  const { conditions } = useStore();
  const [now] = useState(() => Date.now());
  const n = conditions.filter((c) => isActive(c, now)).length;
  if (n === 0) return null;
  return (
    <GroupedList>
      <ListRow
        icon={<IconTile tone="chronic" size={30} icon="shield-check" />}
        label={t.cndTodayTitle(n)}
        sub={t.cndTodaySub}
        chevron
        onClick={onOpen}
      />
    </GroupedList>
  );
}

/** Profile: one row with the active count; opens Health on the conditions. Needs the `conditions` flag. */
export function ConditionsProfileRow({ onOpen }: { onOpen: () => void }) {
  const { t } = useT();
  const on = useFlag('conditions');
  const { conditions } = useStore();
  const [now] = useState(() => Date.now());
  if (!on) return null;
  const n = conditions.filter((c) => isActive(c, now)).length;
  return (
    <ListRow
      icon={<IconTile tone="chronic" size={30} icon="shield-check" />}
      label={t.cndProfileRow}
      value={String(n)}
      chevron
      onClick={onOpen}
    />
  );
}

/** Onboarding: an optional, skippable prompt that opens the add flow. Needs the `conditions` flag. */
export function ConditionsOnboardingRow({ onOpen }: { onOpen: () => void }) {
  const { t } = useT();
  const on = useFlag('conditions');
  if (!on) return null;
  return (
    <GroupedList footer={t.cndOnbHint}>
      <ListRow
        icon={<IconTile tone="chronic" size={30} icon="shield-check" />}
        label={t.cndOnbPrompt}
        chevron
        onClick={onOpen}
      />
    </GroupedList>
  );
}

/** Coach's read-only card: only what the athlete shared (Full: names; Effects: nameless lines). */
export function CoachConditions({ view }: { view: CoachView }) {
  const { t } = useT();
  const condName = useConditionName();
  if (view.full.length === 0 && view.effects.length === 0) return null;
  return (
    <div className="ul-flex ul-col ug-8">
      {view.full.map((c) => {
        const cat = c.key ? catalogCondition(c.key) : undefined;
        if (!cat) return null;
        return (
          <GroupedList key={c.key} header={condName(cat)} footer={t.cndCoachFoot}>
            <ListRow
              icon={<IconTile tone="chronic" size={30} icon={cat.icon} />}
              label={c.severity ? t.cndSev[c.severity] : condName(cat)}
              sub={c.effects.map((l) => effectText(l, t)).join(' · ')}
            />
          </GroupedList>
        );
      })}
      {view.effects.length > 0 && (
        <GroupedList header={t.cndCoachEffects} footer={t.cndCoachFoot}>
          {view.effects.map((l, i) => (
            <ListRow
              key={`${l.id}${i}`}
              icon={<IconTile tone="chronic" size={30} icon="shield-check" />}
              label={effectText(l, t)}
            />
          ))}
        </GroupedList>
      )}
    </div>
  );
}
