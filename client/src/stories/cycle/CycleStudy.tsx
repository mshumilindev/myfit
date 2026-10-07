/**
 * Cycle concept study (docs: «Цикл — концепція для Spotter»). Real kit components with demo data;
 * no store, no writes. Phase tints use existing tones (no cycle tone exists yet — a token decision).
 */
import type { ReactNode } from 'react';
import { BackButton } from '../../components/ui/BackButton';
import { Button } from '../../components/ui/Button';
import { Calendar } from '../../components/ui/Calendar';
import { dayOfTimestamp } from '../../components/ui/calendarDays';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { IconTile } from '../../components/ui/IconTile';
import { MonthGrid, MonthGridLegend, type MonthGridDay } from '../../components/ui/MonthGrid';
import { Notice } from '../../components/ui/Notice';
import { ConfirmDialog, Sheet } from '../../components/ui/Overlays';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { Segmented } from '../../components/ui/Segmented';
import { StickyActionBar } from '../../components/ui/StickyActionBar';
import { Tag } from '../../components/ui/Tag';
import type { Tone } from '../../components/ui/tones';
import '../../views/Health.css';

const noop = () => undefined;
const TODAY = dayOfTimestamp(Date.now());
type Mode = 'regular' | 'irregular' | 'log';
type Phase = 'menses' | 'early' | 'mid' | 'late';

const PHASE: Record<Phase, { name: string; tone: Tone; hint: string }> = {
  menses: { name: 'Місячні', tone: 'conditioning', hint: 'Самопочуття різне — слухай себе.' },
  early: {
    name: 'Початок циклу',
    tone: 'rest',
    hint: 'У багатьох людей тут більше енергії, але не в усіх.',
  },
  mid: { name: 'Середина циклу', tone: 'accent', hint: 'Без правил: орієнтуйся на RPE та сон.' },
  late: {
    name: 'Кінець циклу',
    tone: 'sleep',
    hint: 'Інколи важче відновлюватись — це не обов’язково про тебе.',
  },
};
const L = 28;
const P = 5;
const A = TODAY - 9; // cycle day 10
function phaseOf(day: number): Phase {
  const d = (((day - A) % L) + L) % L; // 0-based
  return d < P ? 'menses' : d < 12 ? 'early' : d < 16 ? 'mid' : 'late';
}
const dayTint =
  (mode: Mode) =>
  (day: number): MonthGridDay | undefined =>
    mode === 'log'
      ? day <= TODAY && phaseOf(day) === 'menses' && day >= A - L
        ? { tint: 'conditioning' }
        : undefined
      : { tint: PHASE[phaseOf(day)].tone };

/* ───── shell ───── */
function Page({
  title,
  children,
  foot,
  back = true,
}: {
  title: ReactNode;
  children: ReactNode;
  foot?: ReactNode;
  back?: boolean;
}) {
  return (
    <div className="screen hl" style={{ height: '100%' }}>
      <div className="hl-pbar">
        {back && <BackButton label="Назад" onClick={noop} />}
        <h1 className="hl-pt">{title}</h1>
      </div>
      <div className="hl-scroll">
        <div className="hl-cnt">{children}</div>
      </div>
      {foot}
    </div>
  );
}
const Sec = ({ label, children }: { label: ReactNode; children: ReactNode }) => (
  <div className="ul-flex ul-col ug-8">
    <SectionLabel>{label}</SectionLabel>
    {children}
  </div>
);
const Private = () => (
  <div className="ul-flex ua-center ug-8 ut-sm ut-muted">
    <IconTile tone="neutral" size={22} icon="lock" />
    Приватно. Зашифровано на пристрої й у хмарі.
  </div>
);
const modeLabel: Record<Mode, string> = {
  regular: 'Регулярний',
  irregular: 'Нерегулярний',
  log: 'Лише лог',
};

/* ───── 1. Lifestyle entry (Health) ───── */
export function LifestyleOff() {
  return (
    <Page title="Здоров’я">
      <GroupedList header="Спосіб життя">
        <ListRow
          icon={<IconTile tone="neutral" size={30} icon="pill" />}
          label="Добавки"
          sub="2 активні"
          chevron
          onClick={noop}
        />
        <ListRow
          icon={<IconTile tone="neutral" size={30} icon="beer-bottle" />}
          label="Алкоголь"
          chevron
          onClick={noop}
        />
        <ListRow
          icon={<IconTile tone="neutral" size={30} icon="wind" />}
          label="Нікотин"
          chevron
          onClick={noop}
        />
        <ListRow
          icon={<IconTile tone="conditioning" size={30} icon="drop-half" />}
          label="Цикл"
          sub="Вимкнено"
          chevron
          onClick={noop}
        />
      </GroupedList>
    </Page>
  );
}
export function LifestyleOn() {
  return (
    <Page title="Здоров’я">
      <GroupedList header="Спосіб життя">
        <ListRow
          icon={<IconTile tone="neutral" size={30} icon="pill" />}
          label="Добавки"
          sub="2 активні"
          chevron
          onClick={noop}
        />
        <ListRow
          icon={<IconTile tone="neutral" size={30} icon="beer-bottle" />}
          label="Алкоголь"
          chevron
          onClick={noop}
        />
        <ListRow
          icon={<IconTile tone="neutral" size={30} icon="wind" />}
          label="Нікотин"
          chevron
          onClick={noop}
        />
        <ListRow
          icon={<IconTile tone="conditioning" size={30} icon="drop-half" />}
          label="Цикл"
          sub="День 10 · початок циклу"
          chevron
          onClick={noop}
        />
      </GroupedList>
    </Page>
  );
}

/* ───── 2. Setup (first run) ───── */
export function Setup() {
  return (
    <Page
      title="Цикл"
      foot={
        <StickyActionBar>
          <Button variant="secondary" onClick={noop}>
            Скасувати
          </Button>
          <Button variant="primary" onClick={noop}>
            Зберегти
          </Button>
        </StickyActionBar>
      }
    >
      <Card pad="md" emphasis="quiet">
        <span className="ut-md">
          Введи один раз, коли цикл зазвичай починається й закінчується. Далі лог веде себе сам —
          нічого вручну щодня.
        </span>
      </Card>
      <Sec label="Режим">
        <Segmented<Mode>
          options={[
            { value: 'regular', label: 'Регулярний' },
            { value: 'irregular', label: 'Нерегулярний' },
            { value: 'log', label: 'Лише лог' },
          ]}
          value="regular"
          onChange={noop}
          tone="conditioning"
        />
      </Sec>
      <GroupedList
        header="Зазвичай"
        footer="Це лише твої типові значення. Додаток нічого не вигадує поза ними."
      >
        <ListRow label="Початок останнього циклу" value="25 вер" chevron onClick={noop} />
        <ListRow label="Довжина циклу" value="28 днів" chevron onClick={noop} />
        <ListRow label="Тривалість місячних" value="5 днів" chevron onClick={noop} />
      </GroupedList>
      <Private />
    </Page>
  );
}

/* ───── 3–6. Hub ───── */
function Today({ mode, stale }: { mode: Mode; stale?: boolean }) {
  if (mode === 'log')
    return (
      <Card pad="md" emphasis="hero">
        <div className="ul-flex ul-col ug-8">
          <span className="ut-sm ut-muted">Лише лог</span>
          <span className="ut-lg">Останній цикл почався 25 вер</span>
          <span className="ut-sm ut-muted">Без прогнозів і підказок — лише записані дні.</span>
        </div>
      </Card>
    );
  const ph = PHASE[phaseOf(TODAY)];
  return (
    <Card pad="md" emphasis="hero">
      <div className="ul-flex ul-col ug-8">
        <div className="ul-flex ua-center ug-8">
          <Tag tone={ph.tone}>{mode === 'irregular' ? 'Ймовірно' : 'Оцінка'}</Tag>
          <span className="ut-sm ut-muted">День 10 з ~28</span>
        </div>
        <span className="ut-lg">{ph.name}</span>
        <span className="ut-sm ut-muted">{ph.hint}</span>
        <ProgressBar value={(10 / 28) * 100} tone={ph.tone} />
        <span className="ut-sm ut-muted">
          {mode === 'irregular'
            ? 'Наступний старт: 18–26 жов (80% інтервал)'
            : 'Наступний старт: 22–24 жов (80% інтервал)'}
        </span>
        {stale && null}
      </div>
    </Card>
  );
}
function Legend({ mode }: { mode: Mode }) {
  if (mode === 'log') return <Tag tone="conditioning">Записані місячні</Tag>;
  return (
    <div className="ul-flex ug-8" style={{ flexWrap: 'wrap' }}>
      {(Object.keys(PHASE) as Phase[]).map((p) => (
        <Tag key={p} tone={PHASE[p].tone}>
          {PHASE[p].name}
        </Tag>
      ))}
    </div>
  );
}
function Hub({ mode, stale = false }: { mode: Mode; stale?: boolean }) {
  return (
    <Page title="Цикл">
      {stale ? (
        <Notice
          tone="illness"
          icon="calendar-blank"
          trail={
            <Button size="sm" variant="secondary" onClick={noop}>
              Оновити дату
            </Button>
          }
        >
          Графік застарів. Підказки вимкнені, поки не оновиш дату.
        </Notice>
      ) : (
        <Today mode={mode} />
      )}
      {!stale && (
        <Sec label="Календар">
          <Card pad="sm" emphasis="card">
            <MonthGrid month={TODAY} today={TODAY} day={dayTint(mode)} />
          </Card>
          <Legend mode={mode} />
        </Sec>
      )}
      <GroupedList>
        <ListRow
          icon={<IconTile tone="neutral" size={30} icon="calendar-plus" />}
          label="Оновити дату старту"
          chevron
          onClick={noop}
        />
        {mode !== 'log' && (
          <ListRow
            icon={<IconTile tone="neutral" size={30} icon="chart-line" />}
            label="Закономірності"
            sub="RPE за фазами"
            chevron
            onClick={noop}
          />
        )}
        <ListRow
          icon={<IconTile tone="neutral" size={30} icon="sliders-horizontal" />}
          label="Налаштування"
          value={modeLabel[mode]}
          chevron
          onClick={noop}
        />
      </GroupedList>
      <GroupedList
        header="Стани"
        footer="Позначення тут одразу додає відповідний стан у «Хронічні», і Цикл вимикається."
      >
        <ListRow
          icon={<IconTile tone="chronic" size={30} icon="heartbeat" />}
          label="Позначити вагітність"
          chevron
          onClick={noop}
        />
        <ListRow
          icon={<IconTile tone="chronic" size={30} icon="sun-horizon" />}
          label="Позначити менопаузу"
          chevron
          onClick={noop}
        />
      </GroupedList>
      <Private />
    </Page>
  );
}
export const HubRegular = () => <Hub mode="regular" />;
export const HubIrregular = () => <Hub mode="irregular" />;
export const HubLogOnly = () => <Hub mode="log" />;
export const HubStale = () => <Hub mode="regular" stale />;

/* ───── 7–8. Suppressed ───── */
function Suppressed({ kind }: { kind: 'preg' | 'meno' }) {
  return (
    <Page title="Цикл">
      <EmptyState
        icon={kind === 'preg' ? 'heartbeat' : 'sun-horizon'}
        title="Цикл вимкнено"
        body={
          kind === 'preg'
            ? 'У «Хронічних» є активна вагітність. Дані збережені; після завершення стану запитаємо нову дату старту.'
            : 'У «Хронічних» позначена менопауза. Дані збережені.'
        }
        centered
      >
        <Button variant="secondary" icon="arrow-right" onClick={noop}>
          Відкрити стани
        </Button>
      </EmptyState>
    </Page>
  );
}
export const SuppressedPregnancy = () => <Suppressed kind="preg" />;
export const SuppressedMenopause = () => <Suppressed kind="meno" />;

/* ───── 9–10. Marking ───── */
export function MarkPregnancy() {
  return (
    <>
      <Hub mode="regular" />
      <Sheet onClose={noop}>
        <div className="ul-flex ul-col ug-12" style={{ padding: '0 4px 8px' }}>
          <h2 className="ut-lg">Позначити вагітність</h2>
          <span className="ut-sm ut-muted">
            Вкажи дату початку (або орієнтовну). Триместр визначиться сам, а стан з’явиться в
            «Хронічних».
          </span>
          <Calendar value={TODAY - 40} onSelect={noop} tone="chronic" today={TODAY} max={TODAY} />
          <Notice tone="chronic" icon="info">
            Триместр 1 · ~6 тиждень
          </Notice>
          <Button variant="primary" fullWidth onClick={noop}>
            Додати стан
          </Button>
        </div>
      </Sheet>
    </>
  );
}
export function MarkMenopause() {
  return (
    <>
      <Hub mode="irregular" />
      <ConfirmDialog
        icon="sun-horizon"
        tone="chronic"
        title="Позначити менопаузу?"
        body="У «Хронічних» з’явиться стан «Менопауза», а Цикл вимкнеться. Дані збережуться."
        confirmLabel="Позначити"
        cancelLabel="Скасувати"
        onConfirm={noop}
        onCancel={noop}
      />
    </>
  );
}
export function ConditionsAfter() {
  return (
    <Page title="Стани">
      <GroupedList header="Активні" footer="Додано з екрана «Цикл».">
        <ListRow
          icon={<IconTile tone="chronic" size={30} icon="heartbeat" />}
          label="Вагітність · 1 триместр"
          sub="~6 тиждень · очікувано ще 34 тижні"
          trailing={<Tag tone="chronic">з «Цикл»</Tag>}
          chevron
          onClick={noop}
        />
      </GroupedList>
    </Page>
  );
}

/* ───── 11. Patterns ───── */
function Bar({ label, value, ci }: { label: string; value: number; ci: string }) {
  return (
    <div className="ul-flex ul-col ug-4">
      <div className="ul-flex ua-center" style={{ justifyContent: 'space-between' }}>
        <span className="ut-md">{label}</span>
        <span className="ut-sm ut-muted">
          RPE {value.toFixed(1)} ({ci})
        </span>
      </div>
      <ProgressBar value={((value - 5) / 5) * 100} tone="conditioning" />
    </div>
  );
}
export function Patterns() {
  return (
    <Page title="Закономірності">
      <Notice tone="neutral" icon="info">
        Це твої власні дані за 6 циклів, а не загальне правило. Різниця менша за шум — розрізнити не
        можемо.
      </Notice>
      <Card pad="md">
        <div className="ul-flex ul-col ug-12">
          <SectionLabel>Середній RPE за фазами</SectionLabel>
          <Bar label="Місячні" value={7.4} ci="±0,5" />
          <Bar label="Початок циклу" value={7.0} ci="±0,4" />
          <Bar label="Середина" value={7.1} ci="±0,6" />
          <Bar label="Кінець циклу" value={7.5} ci="±0,5" />
        </div>
      </Card>
      <span className="ut-sm ut-muted">
        Парні різниці по циклах, 95% інтервал (bootstrap). Мінімум 3 цикли з даними.
      </span>
      <Private />
    </Page>
  );
}
export function PatternsNotEnough() {
  return (
    <Page title="Закономірності">
      <EmptyState
        icon="chart-line"
        title="Поки замало даних"
        body="Потрібно щонайменше 3 цикли з тренуваннями, щоб порівнювати чесно."
        centered
      />
    </Page>
  );
}

/* ───── 12. Surfaces ───── */
export function Surfaces() {
  const ph = PHASE[phaseOf(TODAY)];
  return (
    <Page title="Поверхні" back={false}>
      <Sec label="Today — тихий чіп (можна вимкнути)">
        <Card as="button" pad="md" emphasis="card" onClick={noop}>
          <div className="ul-flex ua-center ug-12">
            <IconTile tone={ph.tone} size={36} icon="drop-half" />
            <div className="ul-flex ul-col">
              <span className="ut-md">День 10 · {ph.name}</span>
              <span className="ut-sm ut-muted">Оцінка за твоїми датами</span>
            </div>
          </div>
        </Card>
      </Sec>
      <Sec label="Сесія — нейтральна примітка під RPE">
        <Notice tone="neutral" icon="info">
          Схоже, ця сесія важча, ніж зазвичай. Таке буває; план не змінюємо.
        </Notice>
      </Sec>
      <Sec label="Календар — тінь фази + відмітки ваги й сну">
        <Card pad="sm">
          <MonthGrid month={TODAY} today={TODAY} day={dayTint('regular')} />
        </Card>
      </Sec>
      <Sec label="Atlas і тренер — нічого">
        <Card pad="md" emphasis="quiet">
          <span className="ut-sm ut-muted">
            Цикл не потрапляє ні в Atlas, ні в LLM, ні тренеру.
          </span>
        </Card>
      </Sec>
    </Page>
  );
}
export { MonthGridLegend };
