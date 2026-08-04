/** Programs — trainer/admin authoring + client assignment (AC-ROLE-06, O-07). */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getRole, getUsername, request } from '../api';
import { ProgramCsvDialog } from './ProgramCsvDialog';
import { ProgramAssignDialog } from './ProgramAssignDialog';
import { programToCsv, type ProgramItemLike } from '../data/programCsv';
import type { ExerciseKind } from '../types';
import { EquipmentIcon, EQUIPMENT_IDS, type EquipmentId } from '../data/equipment';
import { MuscleChip, MuscleIcon, equipmentIconName } from '../components/Muscle';
import {
  addExercise,
  backfillWorkout,
  knownExercises,
  resolveMuscles,
  startWorkout,
  useStore,
} from '../store';
import type { MuscleGroup } from '../data/exercises';
import { ConfirmDialog, Icon, Spinner } from '../ui';
import { useT } from '../i18n';
import type { Shell } from '../App';
import { weekDayStatuses, programOutlook, type DayCell } from '../data/programDays';

interface ProgramItem {
  id: string;
  day: number;
  position: number;
  name: string;
  kind: ExerciseKind;
  sets: number;
  reps: number;
  durationMin: number | null;
  equipment: EquipmentId[];
  groupId?: string | null;
  groupOrder?: number | null;
  dropLast?: boolean;
}

interface Program {
  id: string;
  name: string;
  weeks: number;
  daysPerWeek: number;
  status: 'draft' | 'active' | 'archived';
  authorId: string;
  dayNames: Record<string, string>;
  items: ProgramItem[];
}

interface ClientOption {
  id: string;
  name: string;
}

interface ProgramAssignment {
  program: Program;
  assignedBy: string | null;
  startedAt: number;
  week: number;
  done: number;
  total: number;
  expectedSoFar: number;
  adherence: number | null;
}

const KINDS: ExerciseKind[] = ['strength', 'cardio', 'warmup', 'cooldown'];

function freshProgram(name: string): Program {
  return {
    id: crypto.randomUUID(),
    name,
    weeks: 8,
    daysPerWeek: 3,
    status: 'draft',
    authorId: '',
    dayNames: {},
    items: [],
  };
}

function normalizeItems(items: ProgramItem[]): ProgramItem[] {
  const seen = new Map<number, number>();
  return [...items]
    .sort((a, b) => a.day - b.day || a.position - b.position)
    .map((item) => {
      const next = seen.get(item.day) ?? 0;
      seen.set(item.day, next + 1);
      return { ...item, position: next, equipment: item.equipment ?? [] };
    });
}

function shortDayLabel(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '';
  return cleaned.length > 18 ? `${cleaned.slice(0, 17)}...` : cleaned;
}

export function ProgramsView({ shell }: { shell: Shell }) {
  const { t } = useT();
  const store = useStore();
  const role = getRole();
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [draft, setDraft] = useState<Program>(() => freshProgram(t.progNew));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [programQuery, setProgramQuery] = useState('');
  const [assignClientIds, setAssignClientIds] = useState<string[]>([]);
  const [assignment, setAssignment] = useState<ProgramAssignment | null>(null);
  const [ignoredEquipWarn, setIgnoredEquipWarn] = useState<string[]>([]);
  /** EQ-5 · rows picked for “Group selected as superset”. */
  const [pickedItemIds, setPickedItemIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [memberEditing, setMemberEditing] = useState(false);
  const [memberDetailOpen, setMemberDetailOpen] = useState(false);
  const [memberLoaded, setMemberLoaded] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [confirmDeleteProgram, setConfirmDeleteProgram] = useState(false);
  const [outlookNow] = useState(() => Date.now());
  const didPickInitialProgram = useRef(false);
  const dragItem = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (role === 'member') {
      request<{ assignment: ProgramAssignment | null }>('GET', '/api/programs/mine')
        .then((data) => {
          setFailed(false);
          setMemberLoaded(true);
          setAssignment(
            data.assignment
              ? {
                  ...data.assignment,
                  program: {
                    ...data.assignment.program,
                    items: normalizeItems(data.assignment.program.items),
                  },
                }
              : null,
          );
        })
        .catch(() => {
          setFailed(true);
          setMemberLoaded(true);
        });
      return;
    }
    request<{ programs: Program[] }>('GET', '/api/programs')
      .then((data) => {
        setFailed(false);
        setPrograms(data.programs);
        if (!didPickInitialProgram.current && !selectedId && data.programs[0]) {
          didPickInitialProgram.current = true;
          setSelectedId(data.programs[0].id);
          setDraft({ ...data.programs[0], items: normalizeItems(data.programs[0].items) });
        }
      })
      .catch(() => setFailed(true));
  }, [role, selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (role === 'member') {
      return;
    }
    const path = role === 'admin' ? '/api/admin/people' : '/api/trainer/clients';
    request<{ people?: ClientOption[]; clients?: ClientOption[] }>('GET', path)
      .then((data) => {
        const rows = role === 'admin' ? (data.people ?? []) : (data.clients ?? []);
        setClients(rows.filter((c) => c.id && c.name));
      })
      .catch(() => setClients([]));
  }, [role]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => i + 1), []);
  const programMatches = useMemo(() => {
    const q = programQuery.trim().toLowerCase();
    if (!q) return programs ?? [];
    return (programs ?? []).filter((program) => program.name.toLowerCase().includes(q));
  }, [programQuery, programs]);
  const selectedDayItems = useMemo(
    () =>
      draft.items
        .filter((item) => item.day === selectedDay)
        .sort((a, b) => a.position - b.position),
    [draft.items, selectedDay],
  );
  const currentProgramWeek = Math.min(
    Math.max(1, draft.status === 'active' ? Math.ceil(draft.weeks / 2) : 1),
    Math.max(1, draft.weeks),
  );
  const selectedDaySetCount = selectedDayItems.reduce(
    (sum, item) => sum + (item.kind === 'strength' ? item.sets : 1),
    0,
  );
  const dayLabels = useMemo(() => {
    const labels = new Map<number, string>();
    for (const day of days) {
      const explicit = draft.dayNames?.[day]?.trim();
      if (explicit) {
        labels.set(day, shortDayLabel(explicit));
        continue;
      }
      const firstNamed = draft.items
        .filter((item) => item.day === day)
        .sort((a, b) => a.position - b.position)
        .find((item) => item.name.trim());
      if (firstNamed) labels.set(day, shortDayLabel(firstNamed.name));
    }
    return labels;
  }, [days, draft.items, draft.dayNames]);
  const selectedDayLabel = dayLabels.get(selectedDay) ?? t.progDay(selectedDay);

  function selectProgram(program: Program) {
    setSelectedId(program.id);
    setDraft({ ...program, items: normalizeItems(program.items) });
  }

  function newProgram() {
    const next = freshProgram(t.progNew);
    setSelectedId(null);
    setDraft(next);
  }

  function setDayName(day: number, name: string) {
    setDraft((p) => {
      const dayNames = { ...p.dayNames };
      if (name.trim()) dayNames[String(day)] = name;
      else delete dayNames[String(day)];
      return { ...p, dayNames };
    });
  }

  function duplicateProgram() {
    setSelectedId(null);
    setDraft((p) => ({
      ...p,
      id: crypto.randomUUID(),
      name: t.progDuplicateName(p.name),
      status: 'draft',
      items: p.items.map((item) => ({ ...item, id: crypto.randomUUID() })),
    }));
  }

  // Member self-authoring (AC-PROG-15): 'plan a week' = 1 week, 'build a program' = full.
  function startMemberDraft(weeks: number) {
    setSelectedId(null);
    setDraft({ ...freshProgram(t.progNew), weeks });
    setMemberEditing(true);
  }

  function editMemberProgram() {
    if (!assignment) return;
    setSelectedId(assignment.program.id);
    setDraft({ ...assignment.program, items: normalizeItems(assignment.program.items) });
    setMemberDetailOpen(false);
    setMemberEditing(true);
  }

  function exitMemberEditing() {
    setMemberEditing(false);
    setMemberDetailOpen(false);
    setSelectedId(null);
    setDraft(freshProgram(t.progNew));
    load();
  }

  function importItems(items: ProgramItemLike[]) {
    setDraft((p) => {
      const withIds = items.map((it) => ({ ...it, id: crypto.randomUUID() }));
      const maxDay = Math.max(p.daysPerWeek, 1, ...items.map((i) => i.day));
      return {
        ...p,
        daysPerWeek: Math.min(7, maxDay),
        items: normalizeItems([...p.items, ...withIds]),
      };
    });
  }

  function exportCsv() {
    const csv = programToCsv(
      draft.items.map((i) => ({
        day: i.day,
        position: i.position,
        name: i.name,
        kind: i.kind,
        sets: i.sets,
        reps: i.reps,
        durationMin: i.durationMin,
        equipment: i.equipment,
      })),
    );
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${draft.name.trim() || 'program'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Backfill a missed program day: a backdated session pre-seeded with that
  // day's prescriptions as ghost rows (weights come from history in the logger).
  function backfillDay(cell: DayCell) {
    const a = assignment;
    if (!a) return;
    const items = a.program.items
      .filter((i) => i.day === cell.day)
      .sort((x, y) => x.position - y.position);
    const w = backfillWorkout(cell.date, 45 * 60 * 1000, null);
    for (const it of items) {
      addExercise(w.id, it.name, it.kind, {
        plannedSets: it.kind === 'strength' ? it.sets : null,
        plannedReps: it.kind === 'strength' ? it.reps : null,
        plannedDurationMin: it.kind === 'strength' ? null : (it.durationMin ?? 10),
        equipment: it.equipment,
      });
    }
    shell.openOverlay({ screen: 'past-workout', workoutId: w.id });
  }

  function addItem(day: number) {
    const position = draft.items.filter((i) => i.day === day).length;
    setDraft((p) => ({
      ...p,
      items: [
        ...p.items,
        {
          id: crypto.randomUUID(),
          day,
          position,
          name: '',
          kind: 'strength',
          sets: 3,
          reps: 8,
          durationMin: null,
          equipment: [],
        },
      ],
    }));
  }

  /** EQ-5 · prescribe the picked exercises as one superset. */
  function groupPicked() {
    if (pickedItemIds.length < 2) return;
    const gid = crypto.randomUUID();
    setDraft((p) => ({
      ...p,
      items: p.items.map((i) =>
        pickedItemIds.includes(i.id)
          ? { ...i, groupId: gid, groupOrder: pickedItemIds.indexOf(i.id) }
          : i,
      ),
    }));
    setPickedItemIds([]);
  }

  function ungroupItem(id: string) {
    setDraft((p) => {
      const gid = p.items.find((i) => i.id === id)?.groupId ?? null;
      if (!gid) return p;
      return {
        ...p,
        items: p.items.map((i) =>
          i.groupId === gid ? { ...i, groupId: null, groupOrder: null } : i,
        ),
      };
    });
  }

  function patchItem(id: string, patch: Partial<ProgramItem>) {
    setDraft((p) => ({ ...p, items: p.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  }

  function removeItem(id: string) {
    setDraft((p) => ({ ...p, items: p.items.filter((i) => i.id !== id) }));
  }

  function moveItem(fromId: string, toId: string, toDay: number) {
    setDraft((p) => {
      const moving = p.items.find((i) => i.id === fromId);
      if (!moving || fromId === toId) return p;
      const rest = p.items.filter((i) => i.id !== fromId);
      const targetIndex = rest.findIndex((i) => i.id === toId);
      const target = targetIndex >= 0 ? targetIndex : rest.length;
      const next = [...rest];
      next.splice(target, 0, { ...moving, day: toDay });
      return {
        ...p,
        items: next.map((item) => ({
          ...item,
          position: next.filter((x) => x.day === item.day).findIndex((x) => x.id === item.id),
        })),
      };
    });
  }

  function copyDayTo(targetDay: number) {
    if (targetDay === selectedDay) return;
    setDraft((p) => {
      const source = p.items
        .filter((item) => item.day === selectedDay)
        .sort((a, b) => a.position - b.position);
      const copied = source.map((item, position) => ({
        ...item,
        id: crypto.randomUUID(),
        day: targetDay,
        position,
      }));
      return {
        ...p,
        items: normalizeItems([...p.items.filter((item) => item.day !== targetDay), ...copied]),
      };
    });
    setSelectedDay(targetDay);
  }

  function toggleClient(id: string) {
    setAssignClientIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        name: draft.name,
        weeks: draft.weeks,
        daysPerWeek: draft.daysPerWeek,
        dayNames: draft.dayNames,
        items: draft.items
          .filter((i) => i.name.trim())
          .map((i) => ({
            day: i.day,
            position: i.position,
            name: i.name.trim(),
            kind: i.kind,
            sets: i.sets,
            reps: i.reps,
            durationMin: i.durationMin,
            equipment: i.equipment,
            groupId: i.groupId ?? null,
            groupOrder: i.groupOrder ?? null,
            dropLast: !!i.dropLast,
          })),
      };
      const data = await request<{ program: Program }>('PUT', `/api/programs/${draft.id}`, payload);
      setSelectedId(data.program.id);
      setDraft({ ...data.program, items: normalizeItems(data.program.items) });
      load();
    } finally {
      setSaving(false);
    }
  }

  async function assign(startWeek: number) {
    if (!selectedId || assignClientIds.length === 0) return;
    for (const memberId of assignClientIds) {
      await request('POST', `/api/programs/${selectedId}/assign`, { memberId, startWeek });
    }
    setAssignClientIds([]);
  }

  async function removeProgram(id: string) {
    await request('DELETE', `/api/programs/${id}`);
    setConfirmDeleteProgram(false);
    setSelectedId(null);
    setDraft(freshProgram(t.progNew));
    load();
  }

  async function setStatus(status: 'draft' | 'active' | 'archived') {
    if (!selectedId) return;
    try {
      await request('POST', `/api/programs/${selectedId}/status`, { status });
      setDraft((p) => ({ ...p, status }));
      if (role === 'member') setMemberEditing(false);
      load();
    } catch {
      /* server rejects activation when a day is empty; keep draft */
    }
  }

  if (role === 'member' && !memberEditing) {
    const active = assignment?.program ?? null;
    const isMine = !!assignment && assignment.assignedBy === getUsername();
    const startedAt = assignment?.startedAt ?? null;
    const outlookInput =
      active && startedAt !== null
        ? {
            startedAt,
            weeks: active.weeks,
            daysPerWeek: active.daysPerWeek,
            itemCountByDay: active.items.reduce<Record<number, number>>((m, it) => {
              m[it.day] = (m[it.day] ?? 0) + 1;
              return m;
            }, {}),
            workoutDates: store.workouts
              .filter((w) => w.finishedAt !== null)
              .map((w) => w.startedAt),
            now: outlookNow,
          }
        : null;
    const outlook = outlookInput ? programOutlook(outlookInput) : null;
    const dayStatus = new Map<number, DayCell>(
      outlookInput && outlook
        ? weekDayStatuses(outlookInput, outlook.currentWeek).map((c) => [c.day, c])
        : [],
    );
    const liveOpen = store.workouts.some((w) => w.finishedAt === null);
    const activeEquipment = active
      ? ([...new Set(active.items.flatMap((item) => item.equipment ?? []))] as EquipmentId[])
      : [];
    const adherence =
      assignment?.adherence !== null && assignment?.adherence !== undefined
        ? Math.round(assignment.adherence * 100)
        : null;
    return (
      <div className="screen programs-page">
        <div className="programs-top">
          <div>
            <div className="kicker">{t.training}</div>
            <h2 className="title-26">{t.progTitle}</h2>
          </div>
        </div>

        {!memberLoaded && !failed && (
          <div className="program-skeleton" aria-hidden="true">
            <div className="sk" style={{ height: 14, width: '38%' }} />
            <div className="sk" style={{ height: 64, borderRadius: 'var(--radius-lg)' }} />
            <div className="sk" style={{ height: 132, borderRadius: 'var(--radius-lg)' }} />
          </div>
        )}

        {failed && (
          <button className="program-card" onClick={load}>
            <Icon name="warning-circle" />
            <span>{t.retry}</span>
          </button>
        )}

        {memberLoaded && !failed && !active && (
          <div className="program-routes">
            <div className="program-route-intro">
              <div className="field-label">{t.progTitle}</div>
              <div className="n">{t.progNone}</div>
              <div className="s">{t.progMemberEmpty}</div>
            </div>
            <button className="program-route" onClick={() => startMemberDraft(1)}>
              <Icon name="calendar-blank" />
              <div className="body">
                <div className="n">{t.progRoutePlanWeek}</div>
                <div className="s">{t.progRoutePlanWeekBody}</div>
              </div>
              <Icon name="arrow-right" className="go" />
            </button>
            <button className="program-route" onClick={() => startMemberDraft(8)}>
              <Icon name="squares-four" />
              <div className="body">
                <div className="n">{t.progRouteBuild}</div>
                <div className="s">{t.progRouteBuildBody}</div>
              </div>
              <Icon name="arrow-right" className="go" />
            </button>
            <div className="program-route passive">
              <Icon name="clock-countdown" />
              <div className="body">
                <div className="n">{t.progRouteWait}</div>
                <div className="s">{t.progRouteWaitBody}</div>
              </div>
            </div>
          </div>
        )}

        {active &&
          !memberDetailOpen &&
          (liveOpen ? (
            <section className="program-member-list compact">
              <button
                className="program-member-list-card active"
                onClick={() => setMemberDetailOpen(true)}
              >
                <span className="program-card-title">
                  <span className="n">{active.name}</span>
                  <span className="tag tag-accent">{t.progStatusActive}</span>
                  <Icon name="dots-three-vertical" />
                </span>
                <span className="s">
                  {t.progSessions(assignment?.done ?? 0, assignment?.total ?? 0)}
                  {assignment?.assignedBy && !isMine
                    ? ` · ${t.progAssignedBy(assignment.assignedBy)}`
                    : ''}
                </span>
                <span className="program-card-progress" aria-hidden>
                  {Array.from({ length: active.weeks }, (_, i) => i + 1).map((wk) => {
                    const cur = assignment?.week ?? 1;
                    return (
                      <span key={wk} className={wk === cur ? 'current' : wk < cur ? 'past' : ''} />
                    );
                  })}
                </span>
              </button>
              <div
                className="program-week-strip program-week-strip-compact"
                aria-label={t.progWeekStrip}
              >
                {days.map((day) => {
                  const count = active.items.filter((item) => item.day === day).length;
                  const st = dayStatus.get(day)?.status;
                  return (
                    <button
                      key={day}
                      className={`program-week-slot${count > 0 ? ' filled' : ''}${st ? ` ${st}` : ''}`}
                      onClick={() => setMemberDetailOpen(true)}
                    >
                      <span>{t.weekDayLetters[day - 1]}</span>
                      <strong>{count > 0 ? count : '+'}</strong>
                    </button>
                  );
                })}
              </div>
              {outlook?.missedCount ? (
                <div className="program-notice miss">
                  <Icon name="warning-circle" />
                  {t.progNoticeMissed(outlook.missedCount)}
                </div>
              ) : null}
            </section>
          ) : (
            <section className="program-member-list">
              <button className="program-member-cover" onClick={() => setMemberDetailOpen(true)}>
                <span className="field-label">{t.progStatusActive}</span>
                <span className="program-cover-title">{active.name}</span>
                <span className="program-cover-meta">
                  {t.progSessions(assignment?.done ?? 0, assignment?.total ?? 0)}
                  {assignment?.assignedBy && !isMine
                    ? ` · ${t.progAssignedBy(assignment.assignedBy)}`
                    : ''}
                </span>
                <span className="program-cover-progress">
                  <span>
                    {Array.from({ length: active.weeks }, (_, i) => i + 1).map((wk) => {
                      const cur = assignment?.week ?? 1;
                      return (
                        <i key={wk} className={wk === cur ? 'current' : wk < cur ? 'past' : ''} />
                      );
                    })}
                  </span>
                  <em>
                    {t.progWeekShort(assignment?.week ?? 1)} / {active.weeks}
                  </em>
                </span>
                {adherence !== null && <span className="tag tag-ok">{adherence}%</span>}
              </button>

              <div
                className="program-week-strip program-week-strip-compact"
                aria-label={t.progWeekStrip}
              >
                {days.map((day) => {
                  const count = active.items.filter((item) => item.day === day).length;
                  const st = dayStatus.get(day)?.status;
                  return (
                    <button
                      key={day}
                      className={`program-week-slot${count > 0 ? ' filled' : ''}${st ? ` ${st}` : ''}`}
                      onClick={() => setMemberDetailOpen(true)}
                    >
                      <span>{t.weekDayLetters[day - 1]}</span>
                      <strong>{count > 0 ? count : '+'}</strong>
                    </button>
                  );
                })}
              </div>

              <button
                className="program-member-list-card active"
                onClick={() => setMemberDetailOpen(true)}
              >
                <span className="program-card-title">
                  <span className="n">{active.name}</span>
                  <span className="tag tag-accent">{t.progStatusActive}</span>
                  <Icon name="dots-three-vertical" />
                </span>
                <span className="s">
                  {t.progDaysCount(active.daysPerWeek)} · {t.progWeeksCount(active.weeks)}
                </span>
                <span className="program-member-list-meta">
                  <span>{t.progSessions(assignment?.done ?? 0, assignment?.total ?? 0)}</span>
                  {adherence !== null && <span className="ok">{adherence}%</span>}
                </span>
              </button>

              <button className="program-member-list-card" onClick={() => startMemberDraft(8)}>
                <span className="program-card-title">
                  <span className="n">{t.progRouteBuild}</span>
                  <span className="tag tag-neutral">{t.progStatusDraft}</span>
                </span>
                <span className="s">{t.progRouteBuildBody}</span>
              </button>

              {activeEquipment.length > 0 && (
                <div className="program-member-equipment">
                  {activeEquipment.slice(0, 4).map((id) => (
                    <span key={id} className="tag tag-neutral">
                      <EquipmentIcon equipment={id} />
                      {t.equipmentNames[id]}
                    </span>
                  ))}
                </div>
              )}
            </section>
          ))}

        {active && memberDetailOpen && (
          <section className="program-member-detail">
            <div className="program-member-detail-top">
              <button
                className="round-icon"
                aria-label={t.backAction}
                onClick={() => setMemberDetailOpen(false)}
              >
                <Icon name="caret-left" />
              </button>
            </div>
            <div className="program-card-head">
              <Icon name="copy" />
              <div>
                <div className="field-label">
                  {t.progWeekN(assignment?.week ?? 1)}
                  {isMine && (
                    <span className="tag tag-accent program-mine-tag">{t.progStatusMine}</span>
                  )}
                </div>
                <div className="n">{active.name}</div>
                <div className="s">
                  {assignment
                    ? `${t.progSessions(assignment.done, assignment.total)}${
                        assignment.assignedBy && !isMine
                          ? ` · ${t.progAssignedBy(assignment.assignedBy)}`
                          : ''
                      }`
                    : ''}
                </div>
              </div>
              {assignment?.adherence !== null && assignment?.adherence !== undefined && (
                <span className="tag tag-ok">{Math.round(assignment.adherence * 100)}%</span>
              )}
              {isMine && (
                <button className="btn btn-secondary btn-sm" onClick={editMemberProgram}>
                  <Icon name="pencil-simple" />
                  {t.progEditPlan}
                </button>
              )}
            </div>

            <div className="program-weeks" aria-label={t.progTitle}>
              {Array.from({ length: active.weeks }, (_, i) => i + 1).map((wk) => {
                const cur = assignment?.week ?? 1;
                return (
                  <span
                    key={wk}
                    className={`program-week-bar${wk === cur ? ' current' : wk < cur ? ' past' : ''}`}
                  />
                );
              })}
            </div>

            {outlook && (
              <div className="program-notices">
                {outlook.finished ? (
                  <div className="program-notice ok">
                    <Icon name="check-circle" />
                    {t.progNoticeFinished}
                  </div>
                ) : outlook.weekComplete ? (
                  <div className="program-notice ok">
                    <Icon name="check-circle" />
                    {t.progNoticeWeekComplete(outlook.currentWeek)}
                  </div>
                ) : null}
                {outlook.missedCount > 0 && (
                  <div className="program-notice miss">
                    <Icon name="warning-circle" />
                    {t.progNoticeMissed(outlook.missedCount)}
                  </div>
                )}
              </div>
            )}

            <div className="program-week-strip" aria-label={t.progWeekStrip}>
              {days.map((day) => {
                const count = active.items.filter((item) => item.day === day).length;
                return (
                  <div key={day} className={`program-week-slot${count > 0 ? ' filled' : ''}`}>
                    <span>{t.weekDayLetters[day - 1]}</span>
                    <strong>{count > 0 ? count : '+'}</strong>
                  </div>
                );
              })}
            </div>

            <div className="program-member-days">
              {days.map((day) => {
                const items = active.items
                  .filter((item) => item.day === day)
                  .sort((a, b) => a.position - b.position);
                const equipment = [
                  ...new Set(items.flatMap((item) => item.equipment ?? [])),
                ] as EquipmentId[];
                const st = dayStatus.get(day)?.status;
                const cell = dayStatus.get(day);
                const isToday =
                  !!cell &&
                  Math.floor(cell.date / 86_400_000) === Math.floor(outlookNow / 86_400_000);
                // EQ-2 · the day sums its muscles; the gym inventory is
                // checked against the gym this member trains the most.
                const dayMuscles: MuscleGroup[] = [];
                for (const item of items) {
                  const m = resolveMuscles({ name: item.name, kind: item.kind });
                  if (m.primary && !dayMuscles.includes(m.primary)) dayMuscles.push(m.primary);
                  for (const sec of m.secondary) {
                    if (!dayMuscles.includes(sec)) dayMuscles.push(sec);
                  }
                }
                const gymCounts = new Map<string, number>();
                for (const w of store.workouts) {
                  if (w.gymId) gymCounts.set(w.gymId, (gymCounts.get(w.gymId) ?? 0) + 1);
                }
                const homeGym =
                  [...gymCounts.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .map(([id]) => store.gyms.find((g) => g.id === id))[0] ?? null;
                const missing =
                  homeGym?.inventory && homeGym.inventory.length > 0
                    ? equipment.filter((id) => !homeGym.inventory!.includes(id))
                    : [];
                const equipLabel = (id: string) => {
                  const names = t.equipmentNames as Record<string, string>;
                  return names[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
                };
                const warnKey = `${day}:${missing.join(',')}`;
                const letters = new Map<string, number>();
                for (const item of items) {
                  const gid = item.groupId ?? null;
                  if (gid && !letters.has(gid)) letters.set(gid, letters.size);
                }
                return (
                  <div
                    key={day}
                    className={`program-member-day${st === 'missed' ? ' missed' : st === 'logged' ? ' logged' : ''}`}
                  >
                    <div className="program-day-head">
                      <div>
                        <div className="pd-title-row">
                          <span className="pd-title">
                            {t.progDayLine(
                              t.weekDayNames[day - 1],
                              active.dayNames?.[day] || t.progDay(day),
                            )}
                          </span>
                          {isToday && st !== 'logged' && (
                            <span className="tag tag-accent">{t.today}</span>
                          )}
                        </div>
                      </div>
                      {st === 'logged' && (
                        <Icon name="check-circle" className="program-day-check" />
                      )}
                      {st === 'missed' && cell && (
                        <button
                          className="btn btn-secondary btn-sm program-day-backfill"
                          onClick={() => backfillDay(cell)}
                        >
                          <Icon name="arrow-counter-clockwise" />
                          {t.progBackfill}
                        </button>
                      )}
                    </div>
                    {items.length === 0 ? (
                      <div className="detail-muted">{t.progRestDay}</div>
                    ) : (
                      <>
                        {dayMuscles.length > 0 && (
                          <div className="pd-chips">
                            {dayMuscles.map((m) => (
                              <MuscleChip key={m} muscle={m} />
                            ))}
                          </div>
                        )}
                        <div className="program-prescriptions">
                          {items.map((item) => {
                            const gid = item.groupId ?? null;
                            const letter = gid
                              ? String.fromCharCode(65 + (letters.get(gid) ?? 0))
                              : null;
                            return (
                              <div key={item.id} className="program-prescription-row pdr">
                                <span className={`pdr-bar${gid ? ' on' : ''}`} />
                                <span className="n">
                                  {item.name}
                                  {letter && (
                                    <span className="pdr-index">
                                      {letter}
                                      {(item.groupOrder ?? 0) + 1}
                                    </span>
                                  )}
                                </span>
                                {item.dropLast && (
                                  <span className="pdr-drop">
                                    <Icon name="caret-line-down" />
                                    {t.dropOnLast}
                                  </span>
                                )}
                                <span className="s">
                                  {item.kind === 'strength'
                                    ? `${item.sets} × ${item.reps}`
                                    : `${item.durationMin ?? 10} ${t.minShort}`}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        {equipment.length > 0 && (
                          <div className="pd-equip">
                            {equipment
                              .filter((id) => !missing.includes(id))
                              .map((id) => (
                                <span key={id} className="mchip">
                                  <Icon name={equipmentIconName(id)} />
                                  {equipLabel(id)}
                                </span>
                              ))}
                            {missing.map((id) => (
                              <span key={id} className="mchip ruby">
                                <Icon name="warning-circle" />
                                {equipLabel(id)}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                    {missing.length > 0 && homeGym && !ignoredEquipWarn.includes(warnKey) && (
                      <div className="pd-warn">
                        <Icon name="warning-circle" />
                        <div className="pd-warn-body">
                          <p>{t.gymMissingSwap(homeGym.name, equipLabel(missing[0]))}</p>
                          <div className="pd-warn-actions">
                            <button
                              className="pd-warn-swap"
                              onClick={() => {
                                if (isMine) editMemberProgram();
                                else setIgnoredEquipWarn((x) => [...x, warnKey]);
                              }}
                            >
                              {t.suggestSwap}
                            </button>
                            <button
                              className="pd-warn-ignore"
                              onClick={() => setIgnoredEquipWarn((x) => [...x, warnKey])}
                            >
                              {t.ignoreLabel}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    {isToday && st !== 'logged' && items.length > 0 && !liveOpen && (
                      <button
                        className="btn btn-primary pd-start"
                        onClick={() => {
                          const w = startWorkout(null);
                          for (const item of items) {
                            addExercise(w.id, item.name, item.kind, {
                              plannedSets: item.kind === 'strength' ? item.sets : 1,
                              plannedReps: item.kind === 'strength' ? item.reps : null,
                              plannedDurationMin:
                                item.kind === 'strength' ? null : (item.durationMin ?? 10),
                              equipment: item.equipment,
                              groupId: item.groupId ?? null,
                              groupOrder: item.groupOrder ?? null,
                            });
                          }
                          shell.openOverlay({ screen: 'session', workoutId: w.id });
                        }}
                      >
                        <Icon name="play" />
                        {t.startDay(active.dayNames?.[day] || t.progDay(day))}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="screen programs-page programs-author-page">
      <div className="programs-top">
        <div>
          <div className="kicker">
            {role === 'admin' ? t.roleAdmin : role === 'trainer' ? t.roleTrainer : t.training}
          </div>
          <h2 className="title-26">{t.progTitle}</h2>
        </div>
        <div className="program-actions">
          {role === 'member' ? (
            <button className="btn btn-secondary" onClick={exitMemberEditing}>
              {t.cancel}
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={newProgram}>
              <Icon name="plus" />
              {t.progNew}
            </button>
          )}
        </div>
      </div>

      <div className={`program-layout${role === 'member' ? ' solo' : ''}`}>
        {role !== 'member' && (
          <aside className="program-list">
            <div className="program-list-head">
              <div className="program-list-title">{t.progTitle}</div>
              <button className="program-list-new" onClick={newProgram} aria-label={t.progNew}>
                <Icon name="plus" />
              </button>
            </div>
            <label className="program-search">
              <Icon name="magnifying-glass" />
              <input
                value={programQuery}
                placeholder={t.progSearchPrograms}
                onChange={(e) => setProgramQuery(e.target.value)}
              />
            </label>
            {programs === null && !failed && <Spinner size={18} />}
            {failed && (
              <button className="program-card" onClick={load}>
                <Icon name="warning-circle" />
                <span>{t.retry}</span>
              </button>
            )}
            {programs?.length === 0 && <div className="detail-muted">{t.progEmpty}</div>}
            {programs && programs.length > 0 && programMatches.length === 0 && (
              <div className="detail-muted">{t.progNoSearchResults}</div>
            )}
            {programMatches.map((program) => (
              <button
                key={program.id}
                className={`program-card${selectedId === program.id ? ' active' : ''}`}
                onClick={() => selectProgram(program)}
              >
                <span className="program-card-title">
                  <span className="n">{program.name}</span>
                  <span className={`tag tag-${program.status === 'active' ? 'accent' : 'neutral'}`}>
                    {program.status === 'active'
                      ? t.progStatusActive
                      : program.status === 'archived'
                        ? t.progStatusArchived
                        : t.progStatusDraft}
                  </span>
                </span>
                <span className="s">
                  {t.progWeeksCount(program.weeks)} · {t.progDaysCount(program.daysPerWeek)}
                  {program.status === 'active' ? ` · ${t.progWeekShort(currentProgramWeek)}` : ''}
                </span>
              </button>
            ))}
            <div className="program-sidebar-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setCsvOpen(true)}>
                <Icon name="upload-simple" />
                {t.csvImport}
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={draft.items.length === 0}
                onClick={exportCsv}
              >
                <Icon name="download-simple" />
                {t.csvExportProgram}
              </button>
            </div>
          </aside>
        )}

        <section className="program-editor">
          <div className="program-editor-head">
            <div className="program-editor-title-row">
              <div className="program-title-block">
                <div className="program-title-line">
                  <input
                    className="program-title-input"
                    value={draft.name}
                    onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                    aria-label={t.progNameHeader}
                  />
                  <span className={`tag tag-${draft.status === 'active' ? 'accent' : 'neutral'}`}>
                    {draft.status === 'active'
                      ? t.progStatusActive
                      : draft.status === 'archived'
                        ? t.progStatusArchived
                        : t.progStatusDraft}
                  </span>
                </div>
                <div className="program-meta-edit">
                  <label>
                    <input
                      value={draft.weeks}
                      type="number"
                      min={1}
                      max={52}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, weeks: Number(e.target.value) || 1 }))
                      }
                      aria-label={t.progWeeks}
                    />
                    <span>{t.progWeeksWord(draft.weeks)}</span>
                  </label>
                  <span>·</span>
                  <label>
                    <input
                      value={draft.daysPerWeek}
                      type="number"
                      min={1}
                      max={7}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, daysPerWeek: Number(e.target.value) || 1 }))
                      }
                      aria-label={t.progDaysPerWeek}
                    />
                    <span>{t.progDaysAWeekWord(draft.daysPerWeek)}</span>
                  </label>
                  {selectedId && (
                    <>
                      <span>·</span>
                      <span>{t.progAssignedMembers(clients.length)}</span>
                    </>
                  )}
                  <span>·</span>
                  <span>{t.progCreatedBy(getUsername() ?? t.adminYou)}</span>
                </div>
              </div>
              <div className="program-head-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={draft.items.length === 0}
                  onClick={duplicateProgram}
                >
                  <Icon name="copy" />
                  {t.progDuplicate}
                </button>
                {role !== 'member' && (
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={!selectedId}
                    onClick={() => setAssignOpen(true)}
                  >
                    <Icon name="user-focus" />
                    {t.progAssign}
                  </button>
                )}
              </div>
            </div>

            <div className="program-weeks program-weeks-detail" aria-label={t.progPlanProgress}>
              {Array.from({ length: Math.max(1, draft.weeks) }, (_, i) => i + 1).map((wk) => (
                <span key={wk} className="program-week-cell">
                  <span
                    className={`program-week-bar${wk === currentProgramWeek ? ' current' : wk < currentProgramWeek ? ' past' : ''}`}
                  />
                  <span className={wk === currentProgramWeek ? 'active' : ''}>
                    {wk === 1 ? t.progWeekShort(1) : wk}
                  </span>
                </span>
              ))}
            </div>
          </div>

          <div className="program-fields">
            <label className="field-block">
              <span className="field-label">{t.progName}</span>
              <input
                className="input"
                value={draft.name}
                onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
              />
            </label>
            <label className="field-block">
              <span className="field-label">{t.progWeeks}</span>
              <input
                className="input"
                type="number"
                min={1}
                max={52}
                value={draft.weeks === 0 ? '' : draft.weeks}
                disabled={draft.weeks === 0}
                placeholder={draft.weeks === 0 ? t.progOpenEnded : undefined}
                onChange={(e) => setDraft((p) => ({ ...p, weeks: Number(e.target.value) || 1 }))}
              />
              <label className="program-openended">
                <input
                  type="checkbox"
                  checked={draft.weeks === 0}
                  onChange={(e) => setDraft((p) => ({ ...p, weeks: e.target.checked ? 0 : 8 }))}
                />
                {t.progNoEndDate}
              </label>
            </label>
            <label className="field-block">
              <span className="field-label">{t.progDaysPerWeek}</span>
              <input
                className="input"
                type="number"
                min={1}
                max={7}
                value={draft.daysPerWeek}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, daysPerWeek: Number(e.target.value) || 1 }))
                }
              />
            </label>
          </div>

          <div className="program-io">
            <button className="btn btn-secondary btn-sm" onClick={() => setCsvOpen(true)}>
              <Icon name="upload-simple" />
              {t.csvImport}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={draft.items.length === 0}
              onClick={exportCsv}
            >
              <Icon name="download-simple" />
              {t.csvExport}
            </button>
          </div>

          <div className="program-week-strip" aria-label={t.progWeekStrip}>
            {days.map((day) => {
              const count = draft.items.filter((item) => item.day === day).length;
              return (
                <button
                  key={day}
                  className={`program-week-slot${selectedDay === day ? ' today' : ''}${count > 0 ? ' filled' : ''}`}
                  onClick={() => setSelectedDay(day)}
                >
                  <span>{t.weekDayLetters[day - 1]}</span>
                  <strong>
                    {count > 0 ? (dayLabels.get(day) ?? t.progDay(day)) : t.progRestShort}
                  </strong>
                  <em>
                    {count > 0
                      ? t.progDayWorkoutSummary(
                          count,
                          draft.items
                            .filter((item) => item.day === day)
                            .reduce(
                              (sum, item) => sum + (item.kind === 'strength' ? item.sets : 1),
                              0,
                            ),
                        )
                      : t.progRestDay}
                  </em>
                </button>
              );
            })}
          </div>

          <div className="program-day">
            <div className="program-day-head">
              <div>
                <div className="field-label program-day-title">
                  {t.progDayLine(t.weekDayNames[selectedDay - 1], selectedDayLabel)}
                </div>
                <input
                  className="input program-day-name-input"
                  value={draft.dayNames?.[selectedDay] ?? ''}
                  placeholder={t.progDayNamePlaceholder}
                  maxLength={40}
                  onChange={(e) => setDayName(selectedDay, e.target.value)}
                />
                <div className="program-day-sub">
                  {selectedDayItems.length > 0
                    ? t.progDayWorkoutSummary(selectedDayItems.length, selectedDaySetCount)
                    : t.progPrescriptionRule}
                </div>
              </div>
              <div className="program-day-tools">
                <label className="copy-day">
                  <span className="field-label">{t.progCopyDay}</span>
                  <select
                    className="input"
                    value=""
                    onChange={(e) => {
                      const target = Number(e.target.value);
                      if (target) copyDayTo(target);
                    }}
                  >
                    <option value="">{t.progCopyDay}</option>
                    {days
                      .filter((day) => day !== selectedDay)
                      .map((day) => (
                        <option key={day} value={day}>
                          {t.progDay(day)}
                        </option>
                      ))}
                  </select>
                </label>
                <button className="link" onClick={() => addItem(selectedDay)}>
                  <Icon name="plus" />
                  {t.progAddItemToDay(selectedDayLabel)}
                </button>
              </div>
            </div>
            {selectedDayItems.length === 0 && <div className="detail-muted">{t.progNoItems}</div>}
            {selectedDayItems.length > 0 && (
              <div className="program-table-head" aria-hidden>
                <span>{t.exerciseLabel}</span>
                <span>{t.progSets}</span>
                <span>{t.progReps}</span>
                <span className="pir-muscles-head">{t.musclesCol}</span>
                <span>{t.progEquipment}</span>
                <span />
              </div>
            )}
            {selectedDayItems.map((item) => {
              const gid = item.groupId ?? null;
              const gLetters = new Map<string, number>();
              for (const it of selectedDayItems) {
                const g = it.groupId ?? null;
                if (g && !gLetters.has(g)) gLetters.set(g, gLetters.size);
              }
              const gLabel = gid
                ? `${String.fromCharCode(65 + (gLetters.get(gid) ?? 0))}${(item.groupOrder ?? 0) + 1}`
                : null;
              const picked = pickedItemIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  className={`program-item-row${draggingId === item.id ? ' dragging' : ''}${
                    draggingId && draggingId !== item.id ? ' drop-target' : ''
                  }${picked ? ' picked' : ''}${gid ? ' grouped' : ''}`}
                  onDragOver={(e) => {
                    if (dragItem.current) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = dragItem.current;
                    dragItem.current = null;
                    setDraggingId(null);
                    if (from) moveItem(from, item.id, selectedDay);
                  }}
                >
                  <span
                    className="drag-handle"
                    draggable
                    title={gid ? t.ungroup : t.reorder}
                    onClick={() => {
                      if (gid) {
                        ungroupItem(item.id);
                      } else {
                        setPickedItemIds((x) =>
                          x.includes(item.id) ? x.filter((v) => v !== item.id) : [...x, item.id],
                        );
                      }
                    }}
                    onDragStart={(e) => {
                      dragItem.current = item.id;
                      setDraggingId(item.id);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', item.id);
                    }}
                    onDragEnd={() => {
                      dragItem.current = null;
                      setDraggingId(null);
                    }}
                  >
                    {gLabel ? (
                      <span className="pir-gindex">
                        <span className="pir-gbar" />
                        {gLabel}
                      </span>
                    ) : (
                      <Icon name="dots-six" />
                    )}
                  </span>
                  <span className="pir-name">
                    <input
                      className="input"
                      value={item.name}
                      placeholder={t.addExercise}
                      onChange={(e) => patchItem(item.id, { name: e.target.value })}
                    />
                    {item.kind === 'strength' && (
                      <button
                        className={`pdr-drop pir-droplast${item.dropLast ? '' : ' off'}`}
                        title={t.dropOnLast}
                        onClick={() => patchItem(item.id, { dropLast: !item.dropLast })}
                      >
                        <Icon name="caret-line-down" />
                        {t.dropOnLast}
                      </button>
                    )}
                  </span>
                  <select
                    className="input"
                    value={item.kind}
                    onChange={(e) => patchItem(item.id, { kind: e.target.value as ExerciseKind })}
                  >
                    {KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {t.exerciseKindNames[kind]}
                      </option>
                    ))}
                  </select>
                  {item.kind === 'strength' ? (
                    <>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        value={item.sets}
                        aria-label={t.progSets}
                        onChange={(e) => patchItem(item.id, { sets: Number(e.target.value) || 1 })}
                      />
                      <input
                        className="input"
                        type="number"
                        min={1}
                        value={item.reps}
                        aria-label={t.progReps}
                        onChange={(e) => patchItem(item.id, { reps: Number(e.target.value) || 1 })}
                      />
                    </>
                  ) : (
                    <input
                      className="input"
                      type="number"
                      min={1}
                      value={item.durationMin ?? 10}
                      aria-label={t.progDuration}
                      onChange={(e) =>
                        patchItem(item.id, { durationMin: Number(e.target.value) || 1 })
                      }
                    />
                  )}
                  <button
                    className="trash"
                    aria-label={t.delete}
                    onClick={() => removeItem(item.id)}
                  >
                    <Icon name="trash" />
                  </button>
                  <EquipmentSelector
                    value={item.equipment}
                    onChange={(equipment) => patchItem(item.id, { equipment })}
                  />
                  <span className="pir-muscles">
                    {(() => {
                      // EQ-5: words, primary bright and secondaries in grey.
                      const m = resolveMuscles({ name: item.name, kind: item.kind });
                      if (!m.primary) return null;
                      return (
                        <>
                          <span className="pm">{t.muscleGroups[m.primary]}</span>
                          {m.secondary.slice(0, 2).map((x) => (
                            <span key={x} className="sm">
                              {' · '}
                              {t.muscleGroups[x]}
                            </span>
                          ))}
                        </>
                      );
                    })()}
                  </span>
                </div>
              );
            })}
            <aside className="program-day-rail">
              {(() => {
                const dayMuscles: MuscleGroup[] = [];
                for (const item of selectedDayItems) {
                  const m = resolveMuscles({ name: item.name, kind: item.kind });
                  if (m.primary && !dayMuscles.includes(m.primary)) dayMuscles.push(m.primary);
                  for (const sec of m.secondary) {
                    if (!dayMuscles.includes(sec)) dayMuscles.push(sec);
                  }
                }
                const equipment = [
                  ...new Set(selectedDayItems.flatMap((i) => i.equipment ?? [])),
                ] as string[];
                const gymCounts = new Map<string, number>();
                for (const w of store.workouts) {
                  if (w.gymId) gymCounts.set(w.gymId, (gymCounts.get(w.gymId) ?? 0) + 1);
                }
                const homeGym =
                  role === 'member'
                    ? ([...gymCounts.entries()]
                        .sort((a, b) => b[1] - a[1])
                        .map(([id]) => store.gyms.find((g) => g.id === id))[0] ?? null)
                    : null;
                const missing =
                  homeGym?.inventory && homeGym.inventory.length > 0
                    ? equipment.filter((id) => !homeGym.inventory!.includes(id))
                    : [];
                const equipLabel = (id: string) => {
                  const names = t.equipmentNames as Record<string, string>;
                  return names[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
                };
                return (
                  <>
                    <h6>{t.thisDayCovers}</h6>
                    <div className="rail-chips">
                      {dayMuscles.map((m) => (
                        <span key={m} className="fchip" style={{ cursor: 'default' }}>
                          <MuscleIcon muscle={m} variant="chip" tone="primary" />
                          {t.muscleGroups[m]}
                        </span>
                      ))}
                    </div>
                    <p className="rail-note">{t.dayCoversNote}</p>
                    <h6>{t.equipmentNeeded}</h6>
                    {equipment
                      .filter((id) => !missing.includes(id))
                      .map((id) => (
                        <div key={id} className="rail-equip-cell">
                          {equipLabel(id)}
                        </div>
                      ))}
                    {missing.map((id) => (
                      <div key={id} className="rail-equip-cell ruby">
                        {equipLabel(id)}
                      </div>
                    ))}
                    <div className="sheet-note" style={{ background: 'var(--color-surface)' }}>
                      <p>{t.equipCheckNote}</p>
                    </div>
                  </>
                );
              })()}
            </aside>
            {selectedDayItems.length > 1 && (
              <div className="program-day-actions-row desktop-only">
                <button className="btn btn-secondary btn-sm" onClick={() => addItem(selectedDay)}>
                  {t.addExercise}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={pickedItemIds.length < 2}
                  onClick={() => groupPicked()}
                >
                  {t.groupSelectedSuperset}
                </button>
              </div>
            )}
          </div>

          <div className="program-footer">
            <div className="program-no-weight-note">
              <Icon name="scales" />
              <span>{t.progNoWeightNote}</span>
            </div>
            {role !== 'member' && (
              <button
                className="btn btn-secondary"
                disabled={!selectedId}
                onClick={() => setAssignOpen(true)}
              >
                <Icon name="user" />
                {t.progAssign}
              </button>
            )}
            {selectedId && draft.status !== 'active' && (
              <button
                className="btn btn-secondary"
                disabled={
                  !Array.from({ length: draft.daysPerWeek }, (_, i) => i + 1).every((day) =>
                    draft.items.some((it) => it.day === day),
                  )
                }
                onClick={() => setStatus('active')}
              >
                {t.progActivate}
              </button>
            )}
            {selectedId && draft.status === 'active' && (
              <button className="btn btn-secondary" onClick={() => setStatus('archived')}>
                {t.progArchive}
              </button>
            )}
            <button
              className="danger-outline"
              disabled={!selectedId}
              onClick={() => selectedId && setConfirmDeleteProgram(true)}
            >
              <Icon name="trash" />
              {t.delete}
            </button>
            <button
              className="btn btn-primary"
              disabled={saving || !draft.name.trim()}
              onClick={save}
            >
              {saving ? t.saving : t.save}
            </button>
          </div>
        </section>
      </div>
      {csvOpen && (
        <ProgramCsvDialog
          known={knownExercises().map((e) => e.name)}
          onClose={() => setCsvOpen(false)}
          onImport={importItems}
        />
      )}
      {assignOpen && (
        <ProgramAssignDialog
          clients={clients}
          programName={draft.name}
          selectedIds={assignClientIds}
          onToggle={toggleClient}
          weeks={draft.weeks}
          onClose={() => setAssignOpen(false)}
          onConfirm={assign}
        />
      )}
      {confirmDeleteProgram && selectedId && (
        <ConfirmDialog
          danger
          title={t.deleteProgramTitle(draft.name)}
          body={t.deleteProgramBody}
          confirmLabel={t.delete}
          cancelLabel={t.keep}
          onCancel={() => setConfirmDeleteProgram(false)}
          onConfirm={() => void removeProgram(selectedId)}
        />
      )}
    </div>
  );
}

function EquipmentSelector({
  value,
  onChange,
}: {
  value: EquipmentId[];
  onChange: (value: EquipmentId[]) => void;
}) {
  const { t } = useT();
  const [query, setQuery] = useState('');
  const panelRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const d = panelRef.current;
      if (d?.open && e.target instanceof Node && !d.contains(e.target)) d.open = false;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && panelRef.current?.open) panelRef.current.open = false;
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);
  const common = EQUIPMENT_IDS.slice(0, 6);
  const q = query.trim().toLowerCase();
  const matches = (q ? EQUIPMENT_IDS : common).filter((id) =>
    t.equipmentNames[id].toLowerCase().includes(q),
  );

  function toggle(id: EquipmentId) {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  }

  function highlighted(label: string) {
    if (!q) return label;
    const idx = label.toLowerCase().indexOf(q);
    if (idx < 0) return label;
    return (
      <>
        {label.slice(0, idx)}
        <mark>{label.slice(idx, idx + query.length)}</mark>
        {label.slice(idx + query.length)}
      </>
    );
  }

  return (
    <div className="equipment-picker">
      {value.length > 0 && (
        <div className="equipment-chips">
          {value.map((id) => (
            <button key={id} className="equipment-chip" onClick={() => toggle(id)}>
              <EquipmentIcon equipment={id} />
              {t.equipmentNames[id]}
              <Icon name="x" />
            </button>
          ))}
        </div>
      )}
      <label className="equipment-search">
        <Icon name="magnifying-glass" />
        <input
          value={query}
          placeholder={t.progEquipment}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="equipment-options">
        {matches.map((id) => (
          <button
            key={id}
            className={`equipment-option${value.includes(id) ? ' selected' : ''}`}
            onClick={() => toggle(id)}
          >
            <EquipmentIcon equipment={id} />
            <span>{highlighted(t.equipmentNames[id])}</span>
          </button>
        ))}
      </div>
      <details className="equipment-compact-panel" ref={panelRef}>
        <summary>
          <Icon name="plus" />
          {t.progEquipment}
        </summary>
        <label className="equipment-search">
          <Icon name="magnifying-glass" />
          <input
            value={query}
            placeholder={t.progEquipment}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="equipment-options">
          {matches.map((id) => (
            <button
              key={id}
              className={`equipment-option${value.includes(id) ? ' selected' : ''}`}
              onClick={() => toggle(id)}
            >
              <EquipmentIcon equipment={id} />
              <span>{highlighted(t.equipmentNames[id])}</span>
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
