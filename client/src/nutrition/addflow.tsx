import { useEffect, useMemo, useRef, useState } from 'react';
import { tokenMatch } from '../search';
import { estimateDish } from './ai';
import { localDay, makeItem, roundMacros, round, sumMacros } from './calc';
import {
  COOKING_METHODS,
  DRINKS,
  VOLUME_UNITS,
  alcoholGrams,
  searchFoods,
  type DrinkDef,
} from './data';
import { lookupBarcodeOFF, searchProductsOFF } from './off';
import { Sheet, Sk } from './components';
import { Button, IconButton } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { SearchField } from '../components/ui/SearchField';
import { Checkbox } from '../components/ui/Checkbox';
import { ChipGroup, Chip } from '../components/ui/Chip';
import { ListRow } from '../components/ui/GroupedList';
import { Segmented } from '../components/ui/Segmented';
import { useT } from './i18n';
import { store, useStore } from './store';
import type { Basis, CookingMethod, Food, LoggedItem, Macros } from './types';

function defaultAmount(basis: Basis): number {
  return basis === 'portion' ? 1 : 100;
}

/** Product thumbnail (Open Food Facts photo) with an emoji fallback. */
function FoodIc({ food }: { food: Food }) {
  if (food.photo) {
    return <img className="food-ic" src={food.photo} alt="" loading="lazy" />;
  }
  return <span className="ic">{food.emoji ?? '🍽️'}</span>;
}

function MacroPreview({ items }: { items: { macros: import('./types').Macros }[] }) {
  const { t } = useT();
  const m = roundMacros(sumMacros(items));
  return (
    <div className="card mt3 tnum">
      <div className="list-head">
        <b>
          {round(m.kcal)} {t('kcal')}
        </b>
        <span className="muted">
          {m.protein}
          {t('grams')} · {m.fat}
          {t('grams')} · {m.carbs}
          {t('grams')}
        </span>
      </div>
    </div>
  );
}

/** Quantity + (optional) cooking method. Used for snack log and meal ingredient. */
function QuantityStep({
  food,
  withMethod,
  ctaKey,
  onDone,
}: {
  food: Food;
  withMethod?: boolean;
  ctaKey: 'log' | 'add';
  onDone: (item: LoggedItem) => void;
}) {
  const { t } = useT();
  const [amount, setAmount] = useState(defaultAmount(food.basis));
  const [method, setMethod] = useState<CookingMethod>('raw');
  const unit =
    food.basis === 'portion' ? t('portions') : food.basis === '100ml' ? t('ml') : t('grams');
  const item = makeItem(food, amount || 0, withMethod ? method : undefined);
  return (
    <div>
      <div className="row row--flush">
        <FoodIc food={food} />
        <span className="body">
          <span className="name">{food.name}</span>
          <span className="meta">
            {food.basis === 'portion'
              ? t('perPortion')
              : food.basis === '100ml'
                ? t('per100ml')
                : t('per100g')}
            {food.approx && (
              <>
                {' '}
                · <span className="tag approx">{t('approx')}</span>
              </>
            )}
          </span>
        </span>
      </div>

      <Field
        className="mt3 tnum"
        label={`${t('amount')} (${unit})`}
        type="number"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(parseFloat(e.target.value))}
      />

      {withMethod && (
        <div className="field">
          <label>{t('cookingMethod')}</label>
          <Segmented
            value={method}
            onChange={setMethod}
            options={COOKING_METHODS.map((m) => ({ value: m, label: t(m) }))}
          />
        </div>
      )}

      <MacroPreview items={[item]} />

      <Button
        variant="primary"
        fullWidth
        className="mt4"
        disabled={!amount}
        onClick={() => onDone(item)}
      >
        {t(ctaKey)}
      </Button>
    </div>
  );
}

function basisLabel(f: Food, t: ReturnType<typeof useT>['t']): string {
  return f.basis === 'portion'
    ? t('perPortion')
    : f.basis === '100ml'
      ? t('per100ml')
      : t('per100g');
}

function SearchStep({ onPick }: { onPick: (food: Food) => void }) {
  const { t } = useT();
  const { customFoods } = useStore();
  const [scope, setScope] = useState<'product' | 'dish'>('product');
  const [q, setQ] = useState('');
  const [remote, setRemote] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(false);

  // Live Open Food Facts search for products (debounced); dishes stay local.
  // All state updates run inside the timer callback so nothing sets state
  // synchronously in the effect body (avoids cascading renders).
  useEffect(() => {
    if (scope !== 'product') return;
    const term = q.trim();
    let alive = true;
    const id = setTimeout(
      () => {
        if (!alive) return;
        if (!term) {
          setRemote([]);
          setErr(false);
          setLoading(false);
          return;
        }
        setLoading(true);
        setErr(false);
        searchProductsOFF(term)
          .then((r) => alive && (setRemote(r), setLoading(false)))
          .catch(() => alive && (setErr(true), setLoading(false)));
      },
      term ? 350 : 0,
    );
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [q, scope]);

  const local = useMemo(() => searchFoods(q, customFoods, scope), [q, customFoods, scope]);
  const mine = customFoods.filter((f) => f.kind === 'product' && tokenMatch(f.name, q));
  const results: Food[] =
    scope === 'dish' ? local : [...mine, ...remote, ...(err ? local.filter((f) => !f.custom) : [])];

  return (
    <div>
      <div className="umb-12">
        <Segmented
          value={scope}
          onChange={setScope}
          options={[
            { value: 'product' as const, label: t('searchProducts') },
            { value: 'dish' as const, label: t('searchDishes') },
          ]}
        />
      </div>
      <SearchField
        placeholder={t('searchProductsOrDishes')}
        clearLabel={t('clearSearch')}
        value={q}
        onChange={setQ}
        autoFocus
      />
      {scope === 'dish' && <p className="muted mt3 ut-sm">{t('dishApproxNote')}</p>}
      {loading && (
        <div className="mt3">
          <Sk h={44} r={12} className="umb-8" />
          <Sk h={44} r={12} className="umb-8" />
          <Sk h={44} r={12} />
        </div>
      )}
      {err && (
        <p className="muted center mt3 ut-sm">
          {t('offline')} · {t('addManually')}
        </p>
      )}

      <div className="mt3">
        {!loading && results.length === 0 && q.trim() ? (
          <p className="muted center mt4">{t('noResults')}</p>
        ) : (
          results.map((f) => (
            <div key={f.id} className="row ug-8">
              <div className="uf-1 umw-0">
                <ListRow
                  dense
                  strong
                  icon={<FoodIc food={f} />}
                  label={
                    <>
                      {f.name} {f.approx && <span className="tag approx">{t('approx')}</span>}{' '}
                      {f.custom && <span className="tag">★</span>}
                    </>
                  }
                  sub={`${f.per.kcal} ${t('kcal')} ${basisLabel(f, t)}`}
                  onClick={() => onPick(f)}
                />
              </div>
              {f.custom && (
                <IconButton
                  size="sm"
                  icon="trash"
                  label={t('delete')}
                  onClick={() => store.deleteCustomFood(f.id)}
                />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ManualStep({ onCreated }: { onCreated: (food: Food) => void }) {
  const { t } = useT();
  const [name, setName] = useState('');
  const [basis, setBasis] = useState<Basis>('100g');
  const [kcal, setKcal] = useState(0);
  const [protein, setProtein] = useState(0);
  const [fat, setFat] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [save, setSave] = useState(true);

  function submit() {
    const per = { kcal, protein, fat, carbs };
    const base = { name: name || '—', basis, kind: 'product' as const, per, emoji: '🍽️' };
    const food: Food = save ? store.addCustomFood(base) : { ...base, id: 'tmp-' + Date.now() };
    onCreated(food);
  }
  const num = (v: number, set: (n: number) => void, label: string) => (
    <Field
      className="grow tnum"
      label={label}
      type="number"
      inputMode="decimal"
      value={v}
      onChange={(e) => set(parseFloat(e.target.value) || 0)}
    />
  );
  return (
    <div>
      <Field label={t('name')} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <div className="field">
        <label>
          {t('per100g')} / {t('per100ml')} / {t('perPortion')}
        </label>
        <Segmented
          value={basis}
          onChange={setBasis}
          options={(['100g', '100ml', 'portion'] as Basis[]).map((b) => ({
            value: b,
            label: b === 'portion' ? t('perPortion') : b === '100ml' ? t('per100ml') : t('per100g'),
          }))}
        />
      </div>
      <div className="rowflex">
        {num(kcal, setKcal, t('kcal'))}
        {num(protein, setProtein, t('protein'))}
      </div>
      <div className="rowflex">
        {num(fat, setFat, t('fat'))}
        {num(carbs, setCarbs, t('carbs'))}
      </div>
      <label className="rowflex ua-center ug-8" style={{ margin: '8px 0 16px' }}>
        <Checkbox checked={save} onChange={setSave} />
        <span>{t('saveAsProduct')}</span>
      </label>
      <Button variant="primary" fullWidth disabled={!name} onClick={submit}>
        {t('save')}
      </Button>
    </div>
  );
}

/* Live camera barcode scanning via the built-in BarcodeDetector API (no deps). */
function CameraScan({ onCode, onError }: { onCode: (code: string) => void; onError: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const Detector = (
      window as unknown as {
        BarcodeDetector?: new (o?: unknown) => {
          detect: (v: unknown) => Promise<{ rawValue: string }[]>;
        };
      }
    ).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices) {
      onError();
      return;
    }
    const det = new Detector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          void videoRef.current.play();
        }
        const tick = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const codes = await det.detect(videoRef.current);
            if (codes[0]?.rawValue) {
              onCode(codes[0].rawValue);
              return;
            }
          } catch {
            /* transient frame error — keep scanning */
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      })
      .catch(() => onError());
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [onCode, onError]);
  return (
    <video
      ref={videoRef}
      className="scan-video uw-full"
      playsInline
      muted
      style={{ maxHeight: 320, objectFit: 'cover' }}
    />
  );
}

function ScanStep({ onFound, onManual }: { onFound: (food: Food) => void; onManual: () => void }) {
  const { t } = useT();
  const [code, setCode] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'notfound'>('idle');
  const [cam, setCam] = useState(false);
  const hasCam =
    typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices;

  async function lookup(c: string) {
    const v = c.trim();
    if (!v) return;
    setState('loading');
    try {
      const f = await lookupBarcodeOFF(v);
      if (f) onFound(f);
      else setState('notfound');
    } catch {
      setState('notfound');
    }
  }

  return (
    <div>
      {cam ? (
        <>
          <CameraScan
            onCode={(c) => {
              setCam(false);
              setCode(c);
              void lookup(c);
            }}
            onError={() => setCam(false)}
          />
          <Button variant="secondary" fullWidth className="mt3" onClick={() => setCam(false)}>
            {t('stopCamera')}
          </Button>
        </>
      ) : (
        <div className="card center" style={{ padding: 28 }}>
          <div className="ut-display">📷</div>
          <p className="muted mt3 ut-base">{t('cameraHint')}</p>
          {hasCam && (
            <Button
              variant="primary"
              className="mt3"
              onClick={() => {
                setCam(true);
                setState('idle');
              }}
            >
              {t('useCamera')}
            </Button>
          )}
        </div>
      )}
      <Field
        className="mt4 tnum"
        label={t('scanTitle')}
        inputMode="numeric"
        placeholder="4820000000000"
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          setState('idle');
        }}
      />
      {state === 'notfound' && <p className="field-error">{t('scanNotFound')}</p>}
      <Button
        variant="primary"
        fullWidth
        disabled={!code.trim() || state === 'loading'}
        onClick={() => lookup(code)}
      >
        {state === 'loading' ? t('loadingLabel') : t('scanFound')}
      </Button>
      <Button variant="secondary" fullWidth className="mt3" onClick={onManual}>
        {t('useManual')}
      </Button>
    </div>
  );
}

/* Restaurant dish: type a name → on-device AI estimate (free, no key) → log approx. */
function DishStep({ day, at, onClose }: { day: string; at: string; onClose: () => void }) {
  const { t } = useT();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [macros, setMacros] = useState<Macros | null>(null);
  const [noAi, setNoAi] = useState(false);
  const [portions, setPortions] = useState(1);

  async function estimate() {
    if (!name.trim()) return;
    setBusy(true);
    setNoAi(false);
    const est = await estimateDish(name);
    setBusy(false);
    if (est) setMacros(est);
    else {
      setNoAi(true);
      setMacros({ kcal: 0, protein: 0, fat: 0, carbs: 0 });
    }
  }

  function log() {
    if (!macros) return;
    const scaled: Macros = {
      kcal: round(macros.kcal * portions),
      protein: round(macros.protein * portions, 1),
      fat: round(macros.fat * portions, 1),
      carbs: round(macros.carbs * portions, 1),
    };
    const item: LoggedItem = {
      foodId: `dish-${name.trim().toLowerCase()}`,
      name: name.trim(),
      emoji: '🍽️',
      amount: portions,
      basis: 'portion',
      macros: scaled,
    };
    store.addEntry({
      type: 'meal',
      name: name.trim(),
      emoji: '🍽️',
      items: [item],
      approx: true,
      day,
      at,
    });
    onClose();
  }

  const numField = (label: string, val: number, set: (n: number) => void) => (
    <Field
      className="grow tnum"
      label={label}
      type="number"
      inputMode="decimal"
      value={val}
      onChange={(e) => set(parseFloat(e.target.value) || 0)}
    />
  );

  return (
    <div>
      <Field
        label={t('dishName')}
        placeholder={t('dishNamePlaceholder')}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setMacros(null);
        }}
        autoFocus
      />

      {!macros ? (
        <Button variant="primary" fullWidth disabled={!name.trim() || busy} onClick={estimate}>
          {busy ? t('estimating') : t('estimate')}
        </Button>
      ) : (
        <>
          {noAi && <p className="field-error">{t('aiUnavailable')}</p>}
          <div className="rowflex">
            {numField(t('kcal'), macros.kcal, (v) => setMacros({ ...macros, kcal: v }))}
            {numField(t('protein'), macros.protein, (v) => setMacros({ ...macros, protein: v }))}
          </div>
          <div className="rowflex">
            {numField(t('fat'), macros.fat, (v) => setMacros({ ...macros, fat: v }))}
            {numField(t('carbs'), macros.carbs, (v) => setMacros({ ...macros, carbs: v }))}
          </div>
          <Field
            className="tnum"
            label={`${t('amount')} (${t('portions')})`}
            type="number"
            inputMode="decimal"
            value={portions}
            onChange={(e) => setPortions(parseFloat(e.target.value) || 0)}
          />
          <div className="card tnum">
            <span className="tag approx">{t('approx')}</span> · {round(macros.kcal * portions)}{' '}
            {t('kcal')}
          </div>
          <Button variant="primary" fullWidth className="mt3" disabled={!portions} onClick={log}>
            {t('log')}
          </Button>
        </>
      )}
    </div>
  );
}

function DrinkStep({ onLog }: { onLog: (item: LoggedItem, alcoholG: number) => void }) {
  const { t } = useT();
  const [drink, setDrink] = useState<DrinkDef | null>(null);
  const [unitId, setUnitId] = useState('glass');
  const [count, setCount] = useState(1);
  const unit = VOLUME_UNITS.find((u) => u.id === unitId)!;
  const ml = (count || 0) * unit.ml;
  const item = drink ? makeItem(drink, ml) : null;
  const alcG = drink ? alcoholGrams(drink, ml) : 0;
  return (
    <div>
      <div className="section-title">{t('pickDrink')}</div>
      <ChipGroup>
        {DRINKS.map((d) => (
          <Chip key={d.id} selected={drink?.id === d.id} onClick={() => setDrink(d)}>
            {d.emoji} {d.name}
          </Chip>
        ))}
      </ChipGroup>
      {drink && (
        <>
          <div className="field mt4">
            <label>{t('volume')}</label>
            <ChipGroup>
              {VOLUME_UNITS.map((u) => (
                <Chip key={u.id} selected={unitId === u.id} onClick={() => setUnitId(u.id)}>
                  {t(u.labelKey)}
                  {u.ml > 1 ? ` · ${u.ml}${t('ml')}` : ''}
                </Chip>
              ))}
            </ChipGroup>
          </div>
          <Field
            className="tnum"
            label={`× ${ml}${t('ml')}`}
            type="number"
            inputMode="decimal"
            value={count}
            onChange={(e) => setCount(parseFloat(e.target.value))}
          />
          {item && <MacroPreview items={[item]} />}
          {alcG > 0 && (
            <p className="muted mt3 ut-sm">
              {t('alcohol')}: {alcG} {t('grams')}
            </p>
          )}
          <Button
            variant="primary"
            fullWidth
            className="mt4"
            disabled={!ml}
            onClick={() => item && onLog(item, alcG)}
          >
            {t('log')}
          </Button>
        </>
      )}
    </div>
  );
}

function MealStep({ day, at, onClose }: { day: string; at: string; onClose: () => void }) {
  const { t } = useT();
  const [items, setItems] = useState<LoggedItem[]>([]);
  const [name, setName] = useState('');
  const [picking, setPicking] = useState<Food | null>(null);
  const [searching, setSearching] = useState(false);
  const total = roundMacros(sumMacros(items));

  if (picking) {
    return (
      <QuantityStep
        food={picking}
        withMethod
        ctaKey="add"
        onDone={(it) => {
          setItems((xs) => [...xs, it]);
          setPicking(null);
        }}
      />
    );
  }
  if (searching) {
    return (
      <SearchStep
        onPick={(f) => {
          setSearching(false);
          setPicking(f);
        }}
      />
    );
  }
  return (
    <div>
      <Field
        label={t('dishName')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('mealConstructor')}
      />
      <div className="section-title">{t('ingredients')}</div>
      {items.length === 0 ? (
        <p className="muted">{t('addIngredient')}…</p>
      ) : (
        items.map((it, i) => (
          <div key={i} className="row">
            <span className="ic">{it.emoji ?? '🍽️'}</span>
            <span className="body">
              <span className="name">
                {it.name}
                {it.method && it.method !== 'raw' ? ` · ${t(it.method)}` : ''}
              </span>
              <span className="meta tnum">
                {it.amount}
                {it.basis === 'portion' ? '' : it.basis === '100ml' ? t('ml') : t('grams')}
              </span>
            </span>
            <span className="kcal tnum">{round(it.macros.kcal)}</span>
          </div>
        ))
      )}
      <Button variant="secondary" fullWidth className="mt3" onClick={() => setSearching(true)}>
        + {t('addIngredient')}
      </Button>

      {items.length > 0 && (
        <>
          <div className="card mt4 tnum">
            <div className="list-head">
              <b>
                {t('runningTotal')}: {round(total.kcal)} {t('kcal')}
              </b>
              <span className="muted">
                {total.protein}
                {t('grams')} · {total.fat}
                {t('grams')} · {total.carbs}
                {t('grams')}
              </span>
            </div>
          </div>
          <Button
            variant="primary"
            fullWidth
            className="mt4"
            onClick={() => {
              store.addEntry({
                type: 'meal',
                name: name || t('mealConstructor'),
                emoji: '🍽️',
                items,
                day,
                at,
              });
              onClose();
            }}
          >
            {t('log')}
          </Button>
        </>
      )}
    </div>
  );
}

function nowLocalInput(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function AddFlow({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const { entries } = useStore();
  type Step = 'type' | 'snackSearch' | 'manual' | 'scan' | 'drink' | 'meal' | 'dish' | 'qty';
  const [step, setStep] = useState<Step>('type');
  const [food, setFood] = useState<Food | null>(null);
  const [when, setWhen] = useState(nowLocalInput());
  const at = new Date(when).toISOString();
  const day = localDay(new Date(when));

  const recents = useMemo(() => {
    const seen = new Set<string>();
    const out: { food: Food }[] = [];
    for (const e of entries) {
      for (const it of e.items) {
        if (seen.has(it.foodId)) continue;
        seen.add(it.foodId);
        out.push({
          food: {
            id: it.foodId,
            name: it.name,
            emoji: it.emoji,
            basis: it.basis,
            kind: 'product',
            per: { kcal: 0, protein: 0, fat: 0, carbs: 0 },
          },
        });
      }
    }
    return out.slice(0, 4);
  }, [entries]);

  const titleMap: Record<Step, string> = {
    type: t('addEntry'),
    snackSearch: t('typeSnack'),
    manual: t('manual'),
    scan: t('scanTitle'),
    drink: t('typeDrink'),
    meal: t('mealConstructor'),
    dish: t('typeDish'),
    qty: food?.name ?? t('amount'),
  };

  function logSnack(item: LoggedItem, f: Food) {
    store.addEntry({
      type: 'snack',
      name: f.name,
      emoji: f.emoji,
      items: [item],
      approx: f.approx,
      day,
      at,
    });
    onClose();
  }

  return (
    <Sheet title={titleMap[step]} onClose={onClose}>
      <div className="umb-16">
        <Field
          label={t('whenLabel')}
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
        />
      </div>

      {step === 'type' && (
        <div className="type-grid">
          <Card as="button" className="big" onClick={() => setStep('drink')}>
            <span className="emo">🥤</span>
            <span>
              <span className="t">{t('typeDrink')}</span>
              <br />
              <span className="d">{t('typeDrinkDesc')}</span>
            </span>
          </Card>
          <Card as="button" className="big" onClick={() => setStep('snackSearch')}>
            <span className="emo">🍎</span>
            <span>
              <span className="t">{t('typeSnack')}</span>
              <br />
              <span className="d">{t('typeSnackDesc')}</span>
            </span>
          </Card>
          <Card as="button" className="big" onClick={() => setStep('meal')}>
            <span className="emo">🍽️</span>
            <span>
              <span className="t">{t('typeMeal')}</span>
              <br />
              <span className="d">{t('typeMealDesc')}</span>
            </span>
          </Card>
          <Card as="button" className="big" onClick={() => setStep('dish')}>
            <span className="emo">🍲</span>
            <span>
              <span className="t">{t('typeDish')}</span>
              <br />
              <span className="d">{t('typeDishDesc')}</span>
            </span>
          </Card>

          {recents.length > 0 && (
            <>
              <div className="section-title">{t('recents')}</div>
              <div className="seg">
                {recents.map((r) => (
                  <span key={r.food.id} className="chip">
                    {r.food.emoji} {r.food.name}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {step === 'snackSearch' && (
        <div>
          <div className="rowflex umb-12">
            <Button
              variant="secondary"
              size="sm"
              className="grow"
              onClick={() => setStep('manual')}
            >
              ✏️ {t('manual')}
            </Button>
            <Button variant="secondary" size="sm" className="grow" onClick={() => setStep('scan')}>
              📷 {t('scan')}
            </Button>
          </div>
          <SearchStep
            onPick={(f) => {
              setFood(f);
              setStep('qty');
            }}
          />
        </div>
      )}

      {step === 'manual' && (
        <ManualStep
          onCreated={(f) => {
            setFood(f);
            setStep('qty');
          }}
        />
      )}
      {step === 'scan' && (
        <ScanStep
          onFound={(f) => {
            setFood(f);
            setStep('qty');
          }}
          onManual={() => setStep('manual')}
        />
      )}
      {step === 'drink' && (
        <DrinkStep
          onLog={(item, alcG) => {
            const d = DRINKS.find((x) => x.id === item.foodId)!;
            store.addEntry({
              type: 'drink',
              name: d.name,
              emoji: d.emoji,
              items: [item],
              alcoholG: alcG || undefined,
              day,
              at,
            });
            onClose();
          }}
        />
      )}
      {step === 'meal' && <MealStep day={day} at={at} onClose={onClose} />}
      {step === 'dish' && <DishStep day={day} at={at} onClose={onClose} />}
      {step === 'qty' && food && (
        <QuantityStep food={food} ctaKey="log" onDone={(item) => logSnack(item, food)} />
      )}
    </Sheet>
  );
}
