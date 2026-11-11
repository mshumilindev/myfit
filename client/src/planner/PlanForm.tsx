import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '../components/ui/Button';
import { Calendar } from '../components/ui/Calendar';
import { Field } from '../components/ui/Field';
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { Hint } from '../components/ui/Hint';
import { IconTile } from '../components/ui/IconTile';
import { PageHead } from '../components/ui/PageHead';
import { PresetChips } from '../components/ui/PresetChips';
import { Sheet } from '../components/ui/Overlays';
import { SearchField } from '../components/ui/SearchField';
import { Segmented } from '../components/ui/Segmented';
import { StickyActionBar } from '../components/ui/StickyActionBar';
import { WheelPicker } from '../components/ui/WheelPicker';
import { useT } from '../i18n';
import { Icon, ICON_NAMES } from '../ui';
import { PTONES, type Draft, type PTone, type RepeatKind } from './draft';
import { clock, dayFull, dayLong, dayMonth, durText, leadText, weekdayShorts } from './fmt';
import { fill, STRINGS } from './strings';
import { dayFromNumber, dayNumber, parseDay, weekday } from './zoned';
import './planner.css';

/** The pickers open as kit drawers over the form (owner 11.11), each with Cancel / Save on a staged copy. */
type Drawer = 'icon' | 'color' | 'start' | 'duration' | 'lead' | 'repeat' | 'date';

const DURATIONS = [15, 30, 45, 60, 90, 120];
const LEADS = [0, 10, 30, 60, 120, 1440];
const KINDS: RepeatKind[] = ['none', 'daily', 'weekly', 'weekdays', 'biweekly', 'monthly'];

const HM = (p: {
  h: number;
  m: number;
  hl: string;
  ml: string;
  hMax: number;
  onChange: (h: number, m: number) => void;
  hUnit?: string;
  mUnit?: string;
}) => (
  <div className="pl-hm">
    <WheelPicker
      label={p.hl}
      value={p.h}
      onChange={(h) => p.onChange(h, p.m)}
      min={0}
      max={p.hMax}
      unit={p.hUnit}
      input="manual"
      size="compact"
    />
    <WheelPicker
      label={p.ml}
      value={p.m}
      onChange={(m) => p.onChange(p.h, m)}
      min={0}
      max={55}
      step={5}
      unit={p.mUnit}
      input="manual"
      size="compact"
    />
  </div>
);

/** Add / edit one plan, from kit parts (design SPO-555). Pure form: the page saves and deletes. */
export function PlanForm(p: {
  initial: Draft;
  editing: boolean;
  onSave: (d: Draft) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const s = STRINGS[locale];
  const [d, setD] = useState<Draft>(p.initial);
  const [drawer, setDrawer] = useState<Drawer | null>(null);
  /** The drawer edits this copy; Save moves it into the form, Cancel drops it. */
  const [st, setSt] = useState<Draft>(p.initial);
  const [q, setQ] = useState('');
  const anchor = useRef<HTMLButtonElement>(null);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const setS = (patch: Partial<Draft>) => setSt((x) => ({ ...x, ...patch }));
  const openDrawer = (k: Drawer) => {
    setSt(d);
    setQ('');
    setDrawer(k);
  };
  const closeDrawer = () => setDrawer(null);
  const commit = () => {
    setD(st);
    closeDrawer();
  };
  const startMin = d.hour * 60 + d.minute;
  const dn = weekdayShorts(locale);
  const repLabel: Record<RepeatKind, string> = {
    none: s.sn,
    daily: s.sd,
    weekly: s.sw,
    weekdays: s.swd,
    biweekly: s.sb,
    monthly: s.sm,
  };
  const icons = useMemo(() => {
    const k = q.trim().toLowerCase().replace(/\s+/g, '-');
    return ICON_NAMES.filter((n) => !k || n.includes(k));
  }, [q]);
  const iconName = d.icon.charAt(0).toUpperCase() + d.icon.slice(1).replace(/-/g, ' ');
  const dayChips = (x: Draft, put: (p: Partial<Draft>) => void, layout: 'wrap' | 'grid') => (
    <PresetChips
      layout={layout}
      label={s.days}
      tone="accent"
      items={dn.map((l, i) => ({
        id: String(i),
        label: l,
        selected: x.days.includes(i),
        onClick: () =>
          put({
            days: x.days.includes(i)
              ? x.days.length > 1
                ? x.days.filter((v) => v !== i)
                : x.days
              : [...x.days, i],
          }),
      }))}
    />
  );
  const weekly = (x: Draft) => x.repeat === 'weekly' || x.repeat === 'biweekly';

  const body = (): { title: string; node: ReactNode } => {
    switch (drawer) {
      case 'icon':
        return {
          title: s.icon,
          node: (
            <>
              <SearchField
                value={q}
                onChange={setQ}
                placeholder={s.searchIcons}
                clearLabel={s.clearSearch}
              />
              {icons.length ? (
                <div className="pl-ip pl-ip--scroll" role="radiogroup" aria-label={s.icon}>
                  {icons.map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={n === st.icon}
                      aria-label={n.replace(/-/g, ' ')}
                      title={n.replace(/-/g, ' ')}
                      className={`pl-ip-b${n === st.icon ? ' is-on' : ''}`}
                      onClick={() => setS({ icon: n })}
                    >
                      <Icon name={n} />
                    </button>
                  ))}
                </div>
              ) : (
                <Hint>{fill(s.noIcon, { q })}</Hint>
              )}
            </>
          ),
        };
      case 'color':
        return {
          title: s.color,
          node: (
            <div className="pl-sw" role="radiogroup" aria-label={s.color}>
              {PTONES.map((c: PTone, i) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={c === st.color}
                  aria-label={s.cols[i]}
                  className={`pl-sw-b uit--${c}${c === st.color ? ' is-on' : ''}`}
                  onClick={() => setS({ color: c })}
                >
                  <span />
                </button>
              ))}
            </div>
          ),
        };
      case 'start':
        return {
          title: s.starts,
          node: (
            <>
              <HM
                h={st.hour}
                m={st.minute}
                hl={s.hour}
                ml={s.minutes}
                hMax={23}
                onChange={(hour, minute) => setS({ hour, minute })}
              />
            </>
          ),
        };
      case 'duration':
        return {
          title: s.duration,
          node: (
            <>
              <HM
                h={Math.floor(st.durationMin / 60)}
                m={st.durationMin % 60}
                hl={s.hours}
                ml={s.minutes}
                hMax={12}
                hUnit={s.h}
                mUnit={s.min}
                onChange={(h, m) => setS({ durationMin: Math.max(5, h * 60 + m) })}
              />
            </>
          ),
        };
      case 'lead':
        return {
          title: s.remindMe,
          node: (
            <>
              <HM
                h={Math.floor(st.lead / 60)}
                m={st.lead % 60}
                hl={s.hours}
                ml={s.minutes}
                hMax={48}
                hUnit={s.h}
                mUnit={s.min}
                onChange={(h, m) => setS({ lead: Math.min(2880, h * 60 + m) })}
              />
            </>
          ),
        };
      case 'date':
        return {
          title: s.date,
          node: (
            <Calendar
              mode="single"
              value={dayNumber(st.start)}
              onSelect={(n) => {
                const day = dayFromNumber(n);
                setS({ start: day, days: weekly(st) ? st.days : [weekday(day)] });
              }}
            />
          ),
        };
      case 'repeat': {
        const names: Record<RepeatKind, string> = {
          none: s.rn,
          daily: s.rd,
          weekly: s.rw,
          weekdays: s.rwd,
          biweekly: s.rb,
          monthly: s.rm,
        };
        const sub = (k: RepeatKind): string | undefined =>
          k === 'weekly' || k === 'biweekly'
            ? fill(s.onDay, { d: dayLong(locale, st.start) })
            : k === 'weekdays'
              ? s.monFri
              : k === 'monthly'
                ? fill(s.onNth, { n: String(parseDay(st.start).d) })
                : undefined;
        return {
          title: s.repeats,
          node: (
            <>
              <GroupedList surface="raised">
                {KINDS.map((k) => (
                  <ListRow
                    key={k}
                    label={names[k]}
                    sub={sub(k)}
                    check={st.repeat === k}
                    onClick={() => setS({ repeat: k })}
                  />
                ))}
              </GroupedList>
              {weekly(st) && dayChips(st, setS, 'wrap')}
              {st.repeat !== 'none' && (
                <GroupedList surface="raised" header={s.endsHdr}>
                  <ListRow
                    label={s.never}
                    check={st.ends.kind === 'never'}
                    onClick={() => setS({ ends: { kind: 'never' } })}
                  />
                  <ListRow
                    label={s.onDate}
                    check={st.ends.kind === 'on'}
                    value={st.ends.kind === 'on' ? dayMonth(locale, st.ends.day) : undefined}
                    onClick={() =>
                      setS({
                        ends: { kind: 'on', day: st.ends.kind === 'on' ? st.ends.day : st.start },
                      })
                    }
                  />
                  <ListRow
                    label={s.afterN}
                    check={st.ends.kind === 'count'}
                    value={st.ends.kind === 'count' ? String(st.ends.count) : undefined}
                    onClick={() =>
                      setS({
                        ends: {
                          kind: 'count',
                          count: st.ends.kind === 'count' ? st.ends.count : 10,
                        },
                      })
                    }
                  />
                </GroupedList>
              )}
              {st.ends.kind === 'on' && st.repeat !== 'none' && (
                <Calendar
                  mode="single"
                  value={dayNumber(st.ends.day)}
                  onSelect={(n) => setS({ ends: { kind: 'on', day: dayFromNumber(n) } })}
                />
              )}
              {st.ends.kind === 'count' && st.repeat !== 'none' && (
                <WheelPicker
                  label={s.afterN}
                  value={st.ends.count}
                  onChange={(count) => setS({ ends: { kind: 'count', count } })}
                  min={1}
                  max={99}
                  input="manual"
                  size="compact"
                />
              )}
            </>
          ),
        };
      }
      default:
        return { title: '', node: null };
    }
  };
  const dr = drawer ? body() : null;

  const durCustom = !DURATIONS.includes(d.durationMin);
  const leadCustom = !LEADS.includes(d.lead);
  return (
    <>
      <div className="screen pl-screen">
        <div className="pl-form">
          <PageHead
            back={{ label: t.backAction, onClick: p.onClose }}
            title={p.editing ? s.editPlan : s.newPlan}
          />
          <GroupedList header={s.basedOn}>
            <ListRow
              icon={<IconTile icon="calendar-plus" tone="accent" size={32} />}
              label={s.own}
              sub={s.ownSub}
            />
          </GroupedList>
          <GroupedList header={s.what}>
            <ListRow
              icon={<IconTile icon={d.icon} tone={d.color as never} size={32} />}
              label={s.icon}
              value={iconName}
              chevron
              onClick={() => openDrawer('icon')}
            />
            <ListRow
              icon={<IconTile icon="palette" tone={d.color as never} size={32} />}
              label={s.color}
              value={s.cols[PTONES.indexOf(d.color)]}
              chevron
              onClick={() => openDrawer('color')}
            />
            <ListRow as="label" label={s.titleLabel} labelFixed>
              <Field
                bare
                value={d.title}
                aria-label={s.titleLabel}
                placeholder={s.titlePlaceholder}
                maxLength={80}
                onChange={(e) => set({ title: e.target.value })}
              />
            </ListRow>
          </GroupedList>
          <GroupedList header={s.when}>
            {d.repeat === 'none' && (
              <ListRow
                label={s.date}
                value={dayFull(locale, d.start)}
                chevron
                onClick={() => openDrawer('date')}
              />
            )}
            <ListRow
              label={s.starts}
              value={clock(startMin)}
              chevron
              onClick={() => openDrawer('start')}
            />
            <ListRow
              label={s.repeats}
              value={repLabel[d.repeat]}
              chevron
              onClick={() => openDrawer('repeat')}
            />
          </GroupedList>
          <div className="pl-form-g">
            <div className="uigl-h">{s.duration}</div>
            <PresetChips
              layout="wrap"
              label={s.duration}
              tone="accent"
              items={[
                ...DURATIONS.map((m) => ({
                  id: String(m),
                  label: durText(s, m),
                  selected: m === d.durationMin,
                  onClick: () => set({ durationMin: m }),
                })),
                {
                  id: 'c',
                  label: durCustom ? durText(s, d.durationMin) : s.custom,
                  selected: durCustom,
                  onClick: () => openDrawer('duration'),
                },
              ]}
            />
          </div>
          {weekly(d) && dayChips(d, set, 'grid')}
          <div className="pl-form-g">
            <div className="uigl-h">{s.reminder}</div>
            <Segmented
              value={d.mode}
              onChange={(mode) => set({ mode })}
              label={s.reminder}
              fill
              options={[
                { value: 'quiet', label: s.quiet },
                { value: 'ring', label: s.ring },
              ]}
            />
            <Hint>{d.mode === 'ring' ? s.ringHint : s.quietHint}</Hint>
          </div>
          <div className="pl-form-g">
            <div className="uigl-h">{s.remindMe}</div>
            <PresetChips
              layout="wrap"
              label={s.remindMe}
              tone="accent"
              items={[
                ...LEADS.map((m) => ({
                  id: String(m),
                  label: leadText(s, m),
                  selected: m === d.lead,
                  onClick: () => set({ lead: m }),
                })),
                {
                  id: 'c',
                  label: leadCustom ? leadText(s, d.lead) : s.custom,
                  selected: leadCustom,
                  onClick: () => openDrawer('lead'),
                },
              ]}
            />
          </div>
          {p.onDelete && (
            <Button variant="danger" fullWidth onClick={p.onDelete}>
              {s.del}
            </Button>
          )}
        </div>
      </div>
      <StickyActionBar>
        <Button variant="secondary" onClick={p.onClose}>
          {s.cancel}
        </Button>
        <Button disabled={!d.title.trim()} onClick={() => p.onSave(d)}>
          {s.save}
        </Button>
      </StickyActionBar>
      {dr && (
        <Sheet onClose={closeDrawer} label={dr.title} returnFocusRef={anchor}>
          <div className="ul-flex ul-col ug-12">
            <h2 className="ut-xl ut-w7">{dr.title}</h2>
            {dr.node}
            <div className="ul-flex ug-8">
              <Button fullWidth variant="secondary" onClick={closeDrawer}>
                {s.cancel}
              </Button>
              <Button fullWidth onClick={commit}>
                {s.save}
              </Button>
            </div>
          </div>
        </Sheet>
      )}
    </>
  );
}
