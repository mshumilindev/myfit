/**
 * Long-term conditions inside Health: the list, the add / edit sheet (search or browse
 * the catalogue, severity, coach sharing, dates for temporary ones, a private note) and
 * delete with confirmation. Kit primitives only. Shown while the `conditions` flag is on.
 */
import { useMemo, useState } from 'react';
import { BackButton } from '../../components/ui/BackButton';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { IconTile } from '../../components/ui/IconTile';
import { SearchField } from '../../components/ui/SearchField';
import { Segmented } from '../../components/ui/Segmented';
import { Field } from '../../components/ui/Field';
import { BodyMapPicker } from './BodyMapPicker';
import { Textarea } from '../../components/ui/Textarea';
import { Button } from '../../components/ui/Button';
import { Notice } from '../../components/ui/Notice';
import { Tag } from '../../components/ui/Tag';
import { ConfirmDialog } from '../../components/ui/Overlays';
import {
  CONDITION_CATEGORIES,
  catalogCondition,
  searchConditions,
  type CatalogCondition,
  type ConditionCategory,
} from '../../data/conditionCatalog';
import { isEnded, isTemporary, suggestedEnd, temporaryAuto } from '../../conditions';
import { toneClass } from '../../components/ui/tones';
import { useT } from '../../i18n';
import { addCondition, deleteCondition, updateCondition, useStore } from '../../store';
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
}: {
  cat: CatalogCondition;
  existing?: ChronicCondition;
  onDone: () => void;
}) {
  const { t } = useT();
  const temp = isTemporary(cat.key);
  const auto = temporaryAuto(cat.key);
  const [severity, setSeverity] = useState<1 | 2 | 3>(existing?.severity ?? 2);
  const [share, setShare] = useState<ConditionShare>(existing?.share ?? 'inherit');
  const [note, setNote] = useState(existing?.note ?? '');
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
      note: note.trim() || undefined,
      startedAt,
      endsAt,
    };
    if (existing) updateCondition(existing.id, base);
    else addCondition({ key: cat.key, ...base });
    onDone();
  };
  const hint = {
    inherit: t.cndShareHintInherit,
    off: t.cndShareHintOff,
    effects: t.cndShareHintEffects,
    full: t.cndShareHintFull,
  }[share];

  return (
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
      <Textarea
        label={t.cndNote}
        placeholder={t.cndNotePh}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
      />
      <div className={toneClass('chronic')}>
        <Button variant="fill" fullWidth onClick={save}>
          {existing ? t.cndSave : t.cndAddBtn}
        </Button>
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
}

function Picker({ onPick }: { onPick: (c: CatalogCondition) => void }) {
  const { t } = useT();
  const [mode, setMode] = useState<'list' | 'body'>('list');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<ConditionCategory | null>(null);
  const counts = useMemo(() => {
    const n: Partial<Record<ConditionCategory, number>> = {};
    for (const c of searchConditions('')) n[c.category] = (n[c.category] ?? 0) + 1;
    return n;
  }, []);
  const results = useMemo(
    () => (q || cat ? searchConditions(q).filter((c) => !cat || c.category === cat) : []),
    [q, cat],
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
                      label={c.name}
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

/** The list inside Health: each row / "Add" opens a full page (see ConditionPage). */
export function ConditionsSection({ onOpen }: { onOpen: (cond: string) => void }) {
  const { t } = useT();
  const { conditions } = useStore();
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
              label={cat.name}
              sub={[t.cndSev[c.severity], isEnded(c, now) ? t.cndEnded : null]
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
      {conditions.length === 0 && (
        <Notice tone="chronic" icon="shield-check">
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
  const { conditions } = useStore();
  const existing = props.cond === 'new' ? undefined : conditions.find((c) => c.id === props.cond);
  const cat = existing
    ? catalogCondition(existing.key)
    : props.condKey
      ? catalogCondition(props.condKey)
      : null;
  const body = cat ? (
    <Form key={existing?.id ?? cat.key} cat={cat} existing={existing} onDone={props.onBack} />
  ) : props.cond === 'new' ? (
    <Picker onPick={(c) => props.onPickKey(c.key)} />
  ) : null;
  const title = cat ? cat.name : t.cndAdd;
  if (props.web)
    return (
      <section className="hl-pane">
        <div className="hl-wc tight">
          <div className="hl-phd">
            <h2>{title}</h2>
          </div>
          {body}
        </div>
      </section>
    );
  return (
    <div className="screen hl">
      <div className="hl-pbar">
        <BackButton label={t.backAction} onClick={props.onBack} />
        <h1 className="hl-pt">{title}</h1>
      </div>
      <div className="hl-scroll">
        <div className="hl-cnt">{body}</div>
      </div>
    </div>
  );
}
