import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useT } from './i18n';
import { store, useStore } from './store';
import type { Basis, CookingMethod, Food, LoggedItem, Macros } from './types';

function defaultAmount(basis: Basis): number {
  return basis === 'portion' ? 1 : 100;
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
      <div className="row" style={{ borderBottom: 'none' }}>
        <span className="ic">{food.emoji ?? '🍽️'}</span>
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

      <div className="field mt3">
        <label>
          {t('amount')} ({unit})
        </label>
        <input
          className="input tnum"
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(parseFloat(e.target.value))}
        />
      </div>

      {withMethod && (
        <div className="field">
          <label>{t('cookingMethod')}</label>
          <div className="seg">
            {COOKING_METHODS.map((m) => (
              <button
                key={m}
                className={`chip ${method === m ? 'on' : ''}`}
                onClick={() => setMethod(m)}
              >
                {t(m)}
              </button>
            ))}
          </div>
        </div>
      )}

      <MacroPreview items={[item]} />

      <button className="btn acc block mt4" disabled={!amount} onClick={() => onDone(item)}>
        {t(ctaKey)}
      </button>
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
  const mine = customFoods.filter(
    (f) => f.kind === 'product' && f.name.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const results: Food[] =
    scope === 'dish' ? local : [...mine, ...remote, ...(err ? local.filter((f) => !f.custom) : [])];

  return (
    <div>
      <div className="seg" style={{ marginBottom: 12 }}>
        <button
          className={`chip ${scope === 'product' ? 'on' : ''}`}
          onClick={() => setScope('product')}
        >
          {t('searchProducts')}
        </button>
        <button className={`chip ${scope === 'dish' ? 'on' : ''}`} onClick={() => setScope('dish')}>
          {t('searchDishes')}
        </button>
      </div>
      <input
        className="input"
        placeholder={t('searchProductsOrDishes')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />
      {scope === 'dish' && (
        <p className="muted mt3" style={{ fontSize: 12 }}>
          {t('dishApproxNote')}
        </p>
      )}
      {loading && (
        <div className="mt3">
          <Sk h={44} r={12} style={{ marginBottom: 8 }} />
          <Sk h={44} r={12} style={{ marginBottom: 8 }} />
          <Sk h={44} r={12} />
        </div>
      )}
      {err && (
        <p className="muted center mt3" style={{ fontSize: 12 }}>
          {t('offline')} · {t('addManually')}
        </p>
      )}

      <div className="mt3">
        {!loading && results.length === 0 && q.trim() ? (
          <p className="muted center mt4">{t('noResults')}</p>
        ) : (
          results.map((f) => (
            <div key={f.id} className="row" style={{ gap: 8 }}>
              <button
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  color: 'inherit',
                  padding: 0,
                }}
                onClick={() => onPick(f)}
              >
                <span className="ic">{f.emoji ?? '🍽️'}</span>
                <span className="body">
                  <span className="name">
                    {f.name} {f.approx && <span className="tag approx">{t('approx')}</span>}{' '}
                    {f.custom && <span className="tag">★</span>}
                  </span>
                  <span className="meta tnum">
                    {f.per.kcal} {t('kcal')} {basisLabel(f, t)}
                  </span>
                </span>
              </button>
              {f.custom && (
                <button
                  className="btn ghost sm"
                  aria-label={t('delete')}
                  onClick={() => store.deleteCustomFood(f.id)}
                >
                  🗑
                </button>
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
    <div className="field grow">
      <label>{label}</label>
      <input
        className="input tnum"
        type="number"
        inputMode="decimal"
        value={v}
        onChange={(e) => set(parseFloat(e.target.value) || 0)}
      />
    </div>
  );
  return (
    <div>
      <div className="field">
        <label>{t('name')}</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div className="field">
        <label>
          {t('per100g')} / {t('per100ml')} / {t('perPortion')}
        </label>
        <div className="seg">
          {(['100g', '100ml', 'portion'] as Basis[]).map((b) => (
            <button
              key={b}
              className={`chip ${basis === b ? 'on' : ''}`}
              onClick={() => setBasis(b)}
            >
              {b === 'portion' ? t('perPortion') : b === '100ml' ? t('per100ml') : t('per100g')}
            </button>
          ))}
        </div>
      </div>
      <div className="rowflex">
        {num(kcal, setKcal, t('kcal'))}
        {num(protein, setProtein, t('protein'))}
      </div>
      <div className="rowflex">
        {num(fat, setFat, t('fat'))}
        {num(carbs, setCarbs, t('carbs'))}
      </div>
      <label className="rowflex" style={{ alignItems: 'center', gap: 8, margin: '8px 0 16px' }}>
        <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} />
        <span>{t('saveAsProduct')}</span>
      </label>
      <button className="btn acc block" disabled={!name} onClick={submit}>
        {t('save')}
      </button>
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
      playsInline
      muted
      style={{
        width: '100%',
        maxHeight: 320,
        objectFit: 'cover',
        borderRadius: 12,
        background: '#000',
      }}
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
          <button className="btn block mt3" onClick={() => setCam(false)}>
            {t('stopCamera')}
          </button>
        </>
      ) : (
        <div className="card center" style={{ padding: 28 }}>
          <div style={{ fontSize: 40 }}>📷</div>
          <p className="muted mt3" style={{ fontSize: 13 }}>
            {t('cameraHint')}
          </p>
          {hasCam && (
            <button
              className="btn acc mt3"
              onClick={() => {
                setCam(true);
                setState('idle');
              }}
            >
              {t('useCamera')}
            </button>
          )}
        </div>
      )}
      <div className="field mt4">
        <label>{t('scanTitle')}</label>
        <input
          className="input tnum"
          inputMode="numeric"
          placeholder="4820000000000"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setState('idle');
          }}
        />
      </div>
      {state === 'notfound' && <p className="field-error">{t('scanNotFound')}</p>}
      <button
        className="btn acc block"
        disabled={!code.trim() || state === 'loading'}
        onClick={() => lookup(code)}
      >
        {state === 'loading' ? t('loadingLabel') : t('scanFound')}
      </button>
      <button className="btn block mt3" onClick={onManual}>
        {t('useManual')}
      </button>
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
    <div className="field grow">
      <label>{label}</label>
      <input
        className="input tnum"
        type="number"
        inputMode="decimal"
        value={val}
        onChange={(e) => set(parseFloat(e.target.value) || 0)}
      />
    </div>
  );

  return (
    <div>
      <div className="field">
        <label>{t('dishName')}</label>
        <input
          className="input"
          placeholder={t('dishNamePlaceholder')}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setMacros(null);
          }}
          autoFocus
        />
      </div>

      {!macros ? (
        <button className="btn acc block" disabled={!name.trim() || busy} onClick={estimate}>
          {busy ? t('estimating') : t('estimate')}
        </button>
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
          <div className="field">
            <label>
              {t('amount')} ({t('portions')})
            </label>
            <input
              className="input tnum"
              type="number"
              inputMode="decimal"
              value={portions}
              onChange={(e) => setPortions(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="card tnum">
            <span className="tag approx">{t('approx')}</span> · {round(macros.kcal * portions)}{' '}
            {t('kcal')}
          </div>
          <button className="btn acc block mt3" disabled={!portions} onClick={log}>
            {t('log')}
          </button>
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
      <div className="seg">
        {DRINKS.map((d) => (
          <button
            key={d.id}
            className={`chip ${drink?.id === d.id ? 'on' : ''}`}
            onClick={() => setDrink(d)}
          >
            {d.emoji} {d.name}
          </button>
        ))}
      </div>
      {drink && (
        <>
          <div className="field mt4">
            <label>{t('volume')}</label>
            <div className="seg">
              {VOLUME_UNITS.map((u) => (
                <button
                  key={u.id}
                  className={`chip ${unitId === u.id ? 'on' : ''}`}
                  onClick={() => setUnitId(u.id)}
                >
                  {t(u.labelKey)}
                  {u.ml > 1 ? ` · ${u.ml}${t('ml')}` : ''}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>
              × {ml}
              {t('ml')}
            </label>
            <input
              className="input tnum"
              type="number"
              inputMode="decimal"
              value={count}
              onChange={(e) => setCount(parseFloat(e.target.value))}
            />
          </div>
          {item && <MacroPreview items={[item]} />}
          {alcG > 0 && (
            <p className="muted mt3" style={{ fontSize: 12 }}>
              {t('alcohol')}: {alcG} {t('grams')}
            </p>
          )}
          <button
            className="btn acc block mt4"
            disabled={!ml}
            onClick={() => item && onLog(item, alcG)}
          >
            {t('log')}
          </button>
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
      <div className="field">
        <label>{t('dishName')}</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('mealConstructor')}
        />
      </div>
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
      <button className="btn block mt3" onClick={() => setSearching(true)}>
        + {t('addIngredient')}
      </button>

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
          <button
            className="btn acc block mt4"
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
          </button>
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
      <div className="field" style={{ marginBottom: 16 }}>
        <label>{t('whenLabel')}</label>
        <input
          className="input"
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
        />
      </div>

      {step === 'type' && (
        <div className="type-grid">
          <button className="big" onClick={() => setStep('drink')}>
            <span className="emo">🥤</span>
            <span>
              <span className="t">{t('typeDrink')}</span>
              <br />
              <span className="d">{t('typeDrinkDesc')}</span>
            </span>
          </button>
          <button className="big" onClick={() => setStep('snackSearch')}>
            <span className="emo">🍎</span>
            <span>
              <span className="t">{t('typeSnack')}</span>
              <br />
              <span className="d">{t('typeSnackDesc')}</span>
            </span>
          </button>
          <button className="big" onClick={() => setStep('meal')}>
            <span className="emo">🍽️</span>
            <span>
              <span className="t">{t('typeMeal')}</span>
              <br />
              <span className="d">{t('typeMealDesc')}</span>
            </span>
          </button>
          <button className="big" onClick={() => setStep('dish')}>
            <span className="emo">🍲</span>
            <span>
              <span className="t">{t('typeDish')}</span>
              <br />
              <span className="d">{t('typeDishDesc')}</span>
            </span>
          </button>

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
          <div className="rowflex" style={{ marginBottom: 12 }}>
            <button className="btn sm grow" onClick={() => setStep('manual')}>
              ✏️ {t('manual')}
            </button>
            <button className="btn sm grow" onClick={() => setStep('scan')}>
              📷 {t('scan')}
            </button>
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
