import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { ListRow } from '../components/ui/GroupedList';
import { OptionCard, OptionCardGrid } from '../components/ui/OptionCard';
import { Segmented } from '../components/ui/Segmented';
import { signOut } from './auth';
import {
  ageFromDob,
  latestWeight,
  localDay,
  round,
  sumMacros,
  targetMacros,
  tdee,
  ZERO,
} from './calc';
import {
  Avatar,
  Empty,
  Failed,
  Header,
  Icon,
  KbjuRing,
  LanguageChip,
  MacroBars,
  Plaque,
  Sheet,
  Sk,
} from './components';
import { useT } from './i18n';
import { SupplementProteinHint, useSupplementProtein } from './supplementProtein';
import { entriesForDay, store, useStore } from './store';
import type { Activity, Entry, GoalType, Lang, Macros, Sex } from './types';
import { Select } from '../components/ui/Select';

const GOAL_TYPES: { id: GoalType; arrow: string }[] = [
  { id: 'bulk', arrow: '↗' },
  { id: 'recomp', arrow: '⇄' },
  { id: 'maintain', arrow: '=' },
  { id: 'cut', arrow: '↘' },
];

const ACTIVITIES: Activity[] = ['sedentary', 'light', 'moderate', 'active', 'veryActive'];

function dateLabel(day: string, lang: Lang, opts: Intl.DateTimeFormatOptions): string {
  return new Date(day + 'T00:00:00').toLocaleDateString(lang, opts);
}

function typeLabel(type: Entry['type'], t: ReturnType<typeof useT>['t']): string {
  return type === 'drink' ? t('typeDrink') : type === 'snack' ? t('typeSnack') : t('typeMeal');
}
function portionLabel(entry: Entry, t: ReturnType<typeof useT>['t']): string {
  const q = entry.items.reduce((a, it) => a + (it.basis === 'portion' ? 0 : it.amount), 0);
  const unit = entry.type === 'drink' ? t('ml') : t('grams');
  return q > 0 ? `${round(q)} ${unit}` : `${entry.items.length}×`;
}

function EntryCard({ entry, onOpen }: { entry: Entry; onOpen: (e: Entry) => void }) {
  const { t } = useT();
  return (
    <Card as="button" pad="sm" emphasis="quiet" className="entry" onClick={() => onOpen(entry)}>
      <span className="ic">{entry.emoji ?? '🍽️'}</span>
      <span className="body">
        <span className="name">
          {entry.name} {entry.approx && <span className="tag approx">{t('approx')}</span>}
        </span>
        <span className="meta">
          {typeLabel(entry.type, t)} · {portionLabel(entry, t)}
        </span>
      </span>
      <span className="kcal tnum">
        <b>{round(entry.macros.kcal)}</b>
        <span>{t('kcal')}</span>
      </span>
    </Card>
  );
}

// ---------------------------------------------------------------- Today
export function TodayView({
  onOpenEntry,
  onGoal,
  onAdd,
}: {
  onOpenEntry: (e: Entry) => void;
  onGoal: () => void;
  onAdd: () => void;
}) {
  const s = useStore();
  const { t, lang } = useT();
  const [plaque, setPlaque] = useState(true);
  const day = localDay();
  const entries = entriesForDay(s, day);
  const eaten: Macros = entries.length ? sumMacros(entries) : { ...ZERO };
  // Protein from supplements counts toward the protein TARGET progress only (not calories).
  const supProtein = useSupplementProtein(day);
  const eatenBars: Macros =
    supProtein > 0 ? { ...eaten, protein: eaten.protein + supProtein } : eaten;
  const target = s.goal?.target ?? null;
  const dayStr = dateLabel(day, lang, { weekday: 'short', day: 'numeric', month: 'short' });

  if (s.failed) {
    return (
      <div className="screen">
        <Header title={t('today')} day={dayStr} />
        <Failed onRetry={() => store.retry()} />
      </div>
    );
  }

  if (s.loading) {
    return (
      <div className="screen">
        <Header title={t('today')} day={dayStr} />
        <div className="kbju">
          <div className="ring-wrap">
            <Sk w={116} h={116} r={58} />
            <div className="bars">
              <Sk h={20} />
              <Sk h={20} />
              <Sk h={20} />
            </div>
          </div>
        </div>
        <div className="section-title">{t('todaysLog')}</div>
        <div className="log">
          <Sk h={62} r={12} />
          <Sk h={62} r={12} />
          <Sk h={62} r={12} />
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <Header title={t('today')} day={dayStr} />

      {!s.online && (
        <div className="offline-banner">
          <Icon name="cloudOff" size={16} /> {t('offlineWillSync')}
        </div>
      )}

      {target ? (
        <div className="kbju">
          <div className="ring-wrap">
            <KbjuRing eaten={eaten.kcal} target={target.kcal} />
            <MacroBars eaten={eatenBars} target={target} />
          </div>
          <div className="foot">
            {round(eaten.kcal)} of {target.kcal} {t('kcal')}
          </div>
          <SupplementProteinHint grams={supProtein} />
        </div>
      ) : (
        <Plaque
          overline="GOAL"
          cta={
            <Button variant="secondary" size="sm" onClick={onGoal}>
              {t('set')} →
            </Button>
          }
        >
          <b>{t('setYourGoal')}</b>
          <div className="muted ut-base">{t('setYourGoalBody')}</div>
        </Plaque>
      )}

      {target && plaque && (
        <div className="mt3">
          <Plaque
            overline="FUEL YOUR WORKOUT"
            onDismiss={() => setPlaque(false)}
            cta={
              <Button variant="secondary" size="sm" onClick={onAdd}>
                + {t('logPreWorkout')}
              </Button>
            }
          >
            {t('preWorkout', { time: '18:30', eat: '16:45' })}
          </Plaque>
        </div>
      )}

      <div className="section-title">{t('todaysLog')}</div>
      {entries.length === 0 ? (
        <Empty emoji="🍽️" title={t('emptyDayTitle')} body={t('emptyDayBody')} />
      ) : (
        <div className="log">
          {entries.map((e) => (
            <EntryCard key={e.id} entry={e} onOpen={onOpenEntry} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- History
export function HistoryView({ onOpenEntry }: { onOpenEntry: (e: Entry) => void }) {
  const s = useStore();
  const { t, lang } = useT();
  const [openDay, setOpenDay] = useState<string | null>(null);
  const goalKcal = s.goal?.target.kcal ?? 0;

  if (s.failed) {
    return (
      <div className="screen">
        <Header overline="HISTORY" title={t('last7')} />
        <Failed onRetry={() => store.retry()} />
      </div>
    );
  }

  if (s.loading) {
    return (
      <div className="screen">
        <Header overline="HISTORY" title={t('last7')} />
        <div className="kbju">
          <Sk w={140} h={14} />
          <Sk w={130} h={34} className="umt-8" />
        </div>
        <div className="section-title">{t('caloriesVsGoal')}</div>
        <div className="card">
          <Sk h={120} />
        </div>
        <div className="section-title">{t('byDay')}</div>
        <div className="log">
          <Sk h={56} r={12} />
          <Sk h={56} r={12} />
          <Sk h={56} r={12} />
        </div>
      </div>
    );
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i)); // oldest → newest
    const day = localDay(d);
    const es = entriesForDay(s, day);
    return { day, macros: es.length ? sumMacros(es) : { ...ZERO }, has: es.length > 0 };
  });
  const logged = days.filter((d) => d.has);
  const avg = logged.length
    ? round(logged.reduce((a, d) => a + d.macros.kcal, 0) / logged.length)
    : 0;
  const avgP = logged.length
    ? round(logged.reduce((a, d) => a + d.macros.protein, 0) / logged.length)
    : 0;
  const avgF = logged.length
    ? round(logged.reduce((a, d) => a + d.macros.fat, 0) / logged.length)
    : 0;
  const avgC = logged.length
    ? round(logged.reduce((a, d) => a + d.macros.carbs, 0) / logged.length)
    : 0;
  const delta = goalKcal ? avg - goalKcal : 0;
  const max = Math.max(goalKcal, ...days.map((d) => d.macros.kcal), 1);

  return (
    <div className="screen">
      <Header overline="HISTORY" title={t('last7')} />

      {logged.length === 0 ? (
        <Empty emoji="📈" title={t('emptyHistoryTitle')} body={t('emptyHistoryBody')} />
      ) : (
        <>
          <div className="kbju">
            <div className="overline ut-accent-lo">{t('sevenDayAvg')}</div>
            <div className="ul-flex ua-base ug-8">
              <span className="hero-num tnum">{avg}</span>
              <span className="muted">{t('kcalPerDay')}</span>
            </div>
            <div className="muted mt3 tnum ut-sm">
              {goalKcal ? (
                <span style={{ color: delta <= 0 ? 'var(--ok)' : 'var(--muted)' }}>
                  {delta > 0 ? '+' : ''}
                  {delta} {t('kcal')}
                </span>
              ) : null}
              {goalKcal ? ' · ' : ''}P {avgP} · F {avgF} · C {avgC}
            </div>
          </div>

          <div className="section-title">{t('caloriesVsGoal')}</div>
          <div className="card">
            <div className="chart">
              {days.map((d) => {
                const over = goalKcal > 0 && d.macros.kcal > goalKcal;
                const h = Math.round((d.macros.kcal / max) * 100);
                return (
                  <div key={d.day} className="col">
                    <div className="colbar">
                      <div
                        className={`colfill ${over ? 'over' : ''} ${d.has ? '' : 'nodata'}`}
                        style={{ height: `${d.has ? Math.max(h, 4) : 100}%` }}
                      />
                    </div>
                    <span className="collbl">{dateLabel(d.day, lang, { weekday: 'narrow' })}</span>
                  </div>
                );
              })}
            </div>
            <div className="legend">
              <span>
                <i className="sw acc" /> {t('underAtGoal')}
              </span>
              <span>
                <i className="sw dg" /> {t('over')}
              </span>
            </div>
          </div>

          <div className="section-title">{t('byDay')}</div>
          <div className="log">
            {[...days]
              .reverse()
              .filter((d) => d.has)
              .map((d) => {
                const dd = goalKcal ? round(d.macros.kcal - goalKcal) : null;
                return (
                  <Card
                    as="button"
                    pad="sm"
                    emphasis="quiet"
                    key={d.day}
                    className="entry"
                    onClick={() => setOpenDay(d.day)}
                  >
                    <span className="body">
                      <span className="name">
                        {dateLabel(d.day, lang, {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                      <span className="meta tnum">
                        P {round(d.macros.protein)} · F {round(d.macros.fat)} · C{' '}
                        {round(d.macros.carbs)}
                      </span>
                    </span>
                    <span className="kcal tnum">
                      <b>{round(d.macros.kcal)}</b>
                      <span
                        style={{
                          color:
                            dd === null
                              ? undefined
                              : dd === 0
                                ? 'var(--ok)'
                                : dd < 0
                                  ? 'var(--ok)'
                                  : 'var(--muted)',
                        }}
                      >
                        {dd === null
                          ? t('kcal')
                          : dd === 0
                            ? t('onGoal')
                            : `${dd > 0 ? '+' : ''}${dd}`}
                      </span>
                    </span>
                    <span className="ut-faint">
                      <Icon name="chevron" size={16} />
                    </span>
                  </Card>
                );
              })}
          </div>
        </>
      )}

      {openDay && (
        <Sheet
          title={dateLabel(openDay, lang, { weekday: 'long', day: 'numeric', month: 'long' })}
          onClose={() => setOpenDay(null)}
        >
          {entriesForDay(s, openDay).length === 0 ? (
            <Empty emoji="🍽️" title={t('emptyDayTitle')} body={t('emptyDayBody')} />
          ) : (
            <div className="log">
              {entriesForDay(s, openDay).map((e) => (
                <EntryCard key={e.id} entry={e} onOpen={onOpenEntry} />
              ))}
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Goal
function range(v: number, p: number): string {
  return `${round(v * (1 - p))}–${round(v * (1 + p))}`;
}

export function GoalView() {
  const s = useStore();
  const { t } = useT();
  const [goalType, setGoalType] = useState<GoalType>(s.goal?.goalType ?? 'maintain');
  // Activity level is the only TDEE input the suite does not track, so nutrition
  // owns it. Everything else (sex, age, height, weight) comes from the shared
  // Spotter Profile. Default to a moderate estimate so a target appears at once.
  const [activity, setActivity] = useState<Activity>(s.profile?.activity ?? 'moderate');

  const sex = s.spotterBody?.sex ?? s.profile?.sex ?? null;
  const age = ageFromDob(s.spotterBody?.dob) ?? s.profile?.age ?? null;
  const heightCm = s.spotterBody?.heightCm ?? s.profile?.heightCm ?? null;
  const weightKg = latestWeight(s.spotterBody) ?? s.profile?.weightKg ?? null;

  const missing: string[] = [];
  if (!sex) missing.push(t('sex').toLowerCase());
  if (!age) missing.push(t('age').toLowerCase());
  if (!heightCm) missing.push(t('height').toLowerCase());
  if (!weightKg) missing.push(t('weight').toLowerCase());

  const body =
    sex && age && heightCm && weightKg ? { heightCm, weightKg, sex, age, activity } : null;
  const preview = body ? targetMacros(body, goalType) : null;
  const maint = body ? tdee(body) : 0;

  function save() {
    if (!preview) return;
    // Persist the chosen activity level (nutrition-owned) then the goal.
    if (s.profile?.activity !== activity) store.setProfile({ activity });
    store.setGoal({ goalType, tdee: maint, target: preview });
  }

  if (s.loading) {
    return (
      <div className="screen">
        <Header overline="GOAL" title={t('yourTarget')} />
        <div className="section-title">{t('objective')}</div>
        <div className="obj-grid">
          <Sk h={84} r={16} />
          <Sk h={84} r={16} />
          <Sk h={84} r={16} />
          <Sk h={84} r={16} />
        </div>
        <div className="card mt4">
          <Sk h={18} />
          <Sk h={30} className="umt-14" />
          <Sk h={56} className="umt-14" />
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <Header overline="GOAL" title={t('yourTarget')} />

      <div className="section-title">{t('objective')}</div>
      <OptionCardGrid>
        {GOAL_TYPES.map((g) => (
          <OptionCard
            key={g.id}
            title={t(g.id)}
            preview={g.arrow}
            selected={goalType === g.id}
            onSelect={() => setGoalType(g.id)}
          />
        ))}
      </OptionCardGrid>

      <div className="section-title">{t('activity')}</div>
      <Select value={activity} onChange={(e) => setActivity(e.target.value as Activity)}>
        {ACTIVITIES.map((a) => (
          <option key={a} value={a}>
            {t(a)}
          </option>
        ))}
      </Select>

      {!body ? (
        <div className="mt4">
          <Empty
            emoji="📏"
            title={t('needMetrics')}
            body={t('needMetricsProfile', { fields: missing.join(', ') })}
          />
        </div>
      ) : (
        <>
          <div className="section-title">{t('estimatedNeed')}</div>
          <div className="card">
            <div className="list-head">
              <span className="muted">{t('tdee')}</span>
              <b className="tnum">
                {maint} {t('kcal')}
              </b>
            </div>
            <div className="section-title" style={{ margin: '16px 0 6px' }}>
              {t('targetRange')} · {t(goalType)}
            </div>
            <div className="tnum ut-3xl ut-w6">
              {range(preview!.kcal, 0.03)} <span className="muted ut-lg">{t('kcal')}</span>
            </div>
            <div className="macro-boxes">
              <div>
                <b className="tnum">{range(preview!.protein, 0.06)}</b>
                <span>{t('protein')} g</span>
              </div>
              <div>
                <b className="tnum">{range(preview!.fat, 0.1)}</b>
                <span>{t('fat')} g</span>
              </div>
              <div>
                <b className="tnum">{range(preview!.carbs, 0.06)}</b>
                <span>{t('carbs')} g</span>
              </div>
            </div>
          </div>
          <p className="muted mt3 ut-sm">ⓘ {t('estimateNote')}</p>
          <Button variant="primary" fullWidth className="mt4" onClick={save}>
            {t('useThisTarget')}
          </Button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Profile
function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="tile">
      <b className="tnum">{value}</b>
      <span>{label}</span>
    </div>
  );
}

export function ProfileView() {
  const s = useStore();
  const { t } = useT();
  const p = s.profile;
  const spotterH = s.spotterBody?.heightCm ?? null;
  const spotterW = latestWeight(s.spotterBody);
  const name = s.username ?? t('member');
  const complete = !!(p?.sex && p?.age && p?.activity);

  if (s.loading) {
    return (
      <div className="screen">
        <Header overline="PROFILE" title={name} />
        <div className="n-acct">
          <Sk w={40} h={40} r={20} />
          <div className="uf-1">
            <Sk w={140} h={16} />
            <Sk w={100} h={12} className="umt-6" />
          </div>
        </div>
        <div className="section-title">{t('bodyMetrics')}</div>
        <div className="tiles">
          <Sk h={54} r={12} />
          <Sk h={54} r={12} />
          <Sk h={54} r={12} />
          <Sk h={54} r={12} />
          <Sk h={54} r={12} />
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <Header overline="PROFILE" title={name} />

      <div className="n-acct">
        <Avatar uid={s.uid ?? undefined} name={name} size={40} />
        <span>
          <span className="nm">{name}</span>
          <span className="sub">
            {t(s.role)} · {t('spotterAccount')}
          </span>
        </span>
      </div>

      <div className="list-head" style={{ margin: '24px 4px 8px' }}>
        <span className="section-title" style={{ margin: 0 }}>
          {t('bodyMetrics')}
        </span>
        <span className="muted ut-xs">⟳ {t('fromSpotter')}</span>
      </div>
      <div className="tiles">
        <StatTile
          value={spotterH ? `${spotterH} cm` : p?.heightCm ? `${p.heightCm} cm` : '—'}
          label={t('height')}
        />
        <StatTile
          value={spotterW != null ? `${spotterW} kg` : p?.weightKg ? `${p.weightKg} kg` : '—'}
          label={t('weight')}
        />
        <StatTile value={p?.age ? `${p.age}` : '—'} label={t('age')} />
        <StatTile value={p?.sex ? t(p.sex) : '—'} label={t('sex')} />
        <StatTile value={p?.activity ? t(p.activity) : '—'} label={t('activity')} />
      </div>

      {!complete && (
        <div className="card mt3">
          <div className="field">
            <label>{t('sex')}</label>
            <Segmented<Sex>
              value={p?.sex ?? null}
              onChange={(x) => store.setProfile({ sex: x })}
              options={(['male', 'female'] as Sex[]).map((x) => ({ value: x, label: t(x) }))}
            />
          </div>
          <NumberField
            label={t('age')}
            value={p?.age}
            onCommit={(v) => store.setProfile({ age: v })}
          />
          <Select
            label={t('activity')}
            value={p?.activity ?? ''}
            onChange={(e) => store.setProfile({ activity: e.target.value as Activity })}
          >
            <option value="" disabled>
              —
            </option>
            {ACTIVITIES.map((a) => (
              <option key={a} value={a}>
                {t(a)}
              </option>
            ))}
          </Select>
          {spotterH == null && (
            <NumberField
              label={`${t('height')} (cm)`}
              value={p?.heightCm}
              onCommit={(v) => store.setProfile({ heightCm: v })}
            />
          )}
          {spotterW == null && (
            <NumberField
              label={`${t('weight')} (kg)`}
              value={p?.weightKg}
              onCommit={(v) => store.setProfile({ weightKg: v })}
            />
          )}
        </div>
      )}
      <p className="muted mt3 ut-sm">{t('editInProfile')}</p>

      <div className="section-title">{t('account')}</div>
      <div className="card" style={{ padding: '4px 16px' }}>
        <div className="row uj-between">
          <span>{t('language')}</span>
          <LanguageChip />
        </div>
        <ListRow label={t('signOut')} chevron onClick={() => void signOut()} />
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value?: number;
  onCommit: (v: number) => void;
}) {
  return (
    <Field
      key={value ?? 'empty'}
      className="tnum"
      label={label}
      type="number"
      inputMode="numeric"
      defaultValue={value ?? ''}
      onBlur={(e) => {
        const n = parseFloat(e.target.value);
        if (!Number.isNaN(n)) onCommit(n);
      }}
    />
  );
}
