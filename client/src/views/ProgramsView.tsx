/** Programs — trainer/admin authoring + client assignment (AC-ROLE-06, O-07). */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getRole, request } from '../api';
import type { ExerciseKind } from '../types';
import { EquipmentIcon, EQUIPMENT_IDS, type EquipmentId } from '../data/equipment';
import { Icon, Spinner } from '../ui';
import { useT } from '../i18n';

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
}

interface Program {
  id: string;
  name: string;
  weeks: number;
  daysPerWeek: number;
  authorId: string;
  items: ProgramItem[];
}

interface ClientOption {
  id: string;
  name: string;
}

interface ProgramAssignment {
  program: Program;
  assignedBy: string | null;
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
    authorId: '',
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

export function ProgramsView() {
  const { t } = useT();
  const role = getRole();
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [draft, setDraft] = useState<Program>(() => freshProgram(t.progNew));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [assignClientIds, setAssignClientIds] = useState<string[]>([]);
  const [assignment, setAssignment] = useState<ProgramAssignment | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const dragItem = useRef<string | null>(null);

  const load = useCallback(() => {
    if (role === 'member') {
      request<{ assignment: ProgramAssignment | null }>('GET', '/api/programs/mine')
        .then((data) => {
          setFailed(false);
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
        .catch(() => setFailed(true));
      return;
    }
    request<{ programs: Program[] }>('GET', '/api/programs')
      .then((data) => {
        setFailed(false);
        setPrograms(data.programs);
        if (!selectedId && data.programs[0]) {
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
  const selectedDayItems = useMemo(
    () =>
      draft.items
        .filter((item) => item.day === selectedDay)
        .sort((a, b) => a.position - b.position),
    [draft.items, selectedDay],
  );
  const selectedClients = clients.filter((client) => assignClientIds.includes(client.id));

  function selectProgram(program: Program) {
    setSelectedId(program.id);
    setDraft({ ...program, items: normalizeItems(program.items) });
  }

  function newProgram() {
    const next = freshProgram(t.progNew);
    setSelectedId(null);
    setDraft(next);
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

  async function assign() {
    if (!selectedId || assignClientIds.length === 0) return;
    for (const memberId of assignClientIds) {
      await request('POST', `/api/programs/${selectedId}/assign`, { memberId });
    }
  }

  async function removeProgram(id: string) {
    await request('DELETE', `/api/programs/${id}`);
    setSelectedId(null);
    setDraft(freshProgram(t.progNew));
    load();
  }

  if (role === 'member') {
    const active = assignment?.program ?? null;
    return (
      <div className="screen programs-page">
        <div className="programs-top">
          <div>
            <div className="kicker">{t.training}</div>
            <h1 className="title-26">{t.progTitle}</h1>
          </div>
        </div>

        {failed && (
          <button className="program-card" onClick={load}>
            <Icon name="warning-circle" />
            <span>{t.retry}</span>
          </button>
        )}

        {!failed && !active && (
          <div className="today-program-card">
            <div className="program-card-head">
              <Icon name="copy" />
              <div>
                <div className="field-label">{t.progTitle}</div>
                <div className="n">{t.progNone}</div>
                <div className="s">{t.progMemberEmpty}</div>
              </div>
            </div>
            <div className="program-week-strip" aria-label={t.progWeekStrip}>
              {days.map((day) => (
                <div key={day} className="program-week-slot">
                  <span>{t.weekDayLetters[day - 1]}</span>
                  <strong>+</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {active && (
          <section className="program-member-detail">
            <div className="program-card-head">
              <Icon name="copy" />
              <div>
                <div className="field-label">{t.progWeekN(assignment?.week ?? 1)}</div>
                <div className="n">{active.name}</div>
                <div className="s">
                  {assignment
                    ? `${t.progSessions(assignment.done, assignment.total)}${
                        assignment.assignedBy ? ` · ${t.progAssignedBy(assignment.assignedBy)}` : ''
                      }`
                    : ''}
                </div>
              </div>
              {assignment?.adherence !== null && assignment?.adherence !== undefined && (
                <span className="tag tag-accent">{Math.round(assignment.adherence * 100)}%</span>
              )}
            </div>

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
                return (
                  <div key={day} className="program-member-day">
                    <div className="program-day-head">
                      <div>
                        <div className="field-label">{t.progDay(day)}</div>
                        <div className="program-day-sub">
                          {items.length > 0 ? t.progPrescriptionRule : t.progRestDay}
                        </div>
                      </div>
                      {equipment.length > 0 && (
                        <div className="program-start-equipment">
                          {equipment.map((id) => (
                            <EquipmentIcon key={id} equipment={id} />
                          ))}
                        </div>
                      )}
                    </div>
                    {items.length === 0 ? (
                      <div className="detail-muted">{t.progRestDay}</div>
                    ) : (
                      <div className="program-prescriptions">
                        {items.map((item) => (
                          <div key={item.id} className="program-prescription-row">
                            <span className="n">{item.name}</span>
                            <span className="s">
                              {item.kind === 'strength'
                                ? `${item.sets} × ${item.reps}`
                                : `${item.durationMin ?? 10} ${t.minShort}`}
                            </span>
                            <span className="equipment-mini">
                              {(item.equipment ?? []).map((id) => (
                                <EquipmentIcon key={id} equipment={id} />
                              ))}
                            </span>
                          </div>
                        ))}
                      </div>
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
    <div className="screen programs-page">
      <div className="programs-top">
        <div>
          <div className="kicker">{role === 'admin' ? t.roleAdmin : t.roleTrainer}</div>
          <h1 className="title-26">{t.progTitle}</h1>
        </div>
        <div className="program-actions">
          <button className="btn btn-secondary" onClick={newProgram}>
            <Icon name="plus" />
            {t.progNew}
          </button>
        </div>
      </div>

      <div className="program-layout">
        <aside className="program-list">
          {programs === null && !failed && <Spinner size={18} />}
          {failed && (
            <button className="program-card" onClick={load}>
              <Icon name="warning-circle" />
              <span>{t.retry}</span>
            </button>
          )}
          {programs?.length === 0 && <div className="detail-muted">{t.progEmpty}</div>}
          {(programs ?? []).map((program) => (
            <button
              key={program.id}
              className={`program-card${selectedId === program.id ? ' active' : ''}`}
              onClick={() => selectProgram(program)}
            >
              <span className="n">{program.name}</span>
              <span className="s">
                {program.weeks} {t.progWeeks} · {program.daysPerWeek} {t.progDaysPerWeek}
              </span>
            </button>
          ))}
        </aside>

        <section className="program-editor">
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
                value={draft.weeks}
                onChange={(e) => setDraft((p) => ({ ...p, weeks: Number(e.target.value) || 1 }))}
              />
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
                  <strong>{count > 0 ? count : '+'}</strong>
                </button>
              );
            })}
          </div>

          <div className="program-day">
            <div className="program-day-head">
              <div>
                <div className="field-label">{t.progDay(selectedDay)}</div>
                <div className="program-day-sub">{t.progPrescriptionRule}</div>
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
                    <option value="">{t.progCopyChoose}</option>
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
                  {t.progAddItem}
                </button>
              </div>
            </div>
            {selectedDayItems.length === 0 && <div className="detail-muted">{t.progNoItems}</div>}
            {selectedDayItems.map((item) => (
              <div
                key={item.id}
                className="program-item-row"
                onDragOver={(e) => {
                  if (dragItem.current && dragItem.current !== item.id) e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = dragItem.current;
                  dragItem.current = null;
                  if (from) moveItem(from, item.id, selectedDay);
                }}
              >
                <span
                  className="drag-handle"
                  draggable
                  title={t.reorder}
                  onDragStart={(e) => {
                    dragItem.current = item.id;
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={() => {
                    dragItem.current = null;
                  }}
                >
                  <Icon name="dots-six" />
                </span>
                <input
                  className="input"
                  value={item.name}
                  placeholder={t.addExercise}
                  onChange={(e) => patchItem(item.id, { name: e.target.value })}
                />
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
                <button className="trash" aria-label={t.delete} onClick={() => removeItem(item.id)}>
                  <Icon name="trash" />
                </button>
                <EquipmentSelector
                  value={item.equipment}
                  onChange={(equipment) => patchItem(item.id, { equipment })}
                />
              </div>
            ))}
          </div>

          <div className="program-footer">
            <div className="program-assign">
              <div className="member-picker">
                {selectedClients.length > 0 && (
                  <div className="equipment-chips">
                    {selectedClients.map((client) => (
                      <button
                        key={client.id}
                        className="equipment-chip"
                        onClick={() => toggleClient(client.id)}
                      >
                        {client.name}
                        <Icon name="x" />
                      </button>
                    ))}
                  </div>
                )}
                <div className="client-picks">
                  {clients.length === 0 && <span className="detail-muted">{t.progNoClients}</span>}
                  {clients.map((client) => (
                    <button
                      key={client.id}
                      className={`client-pick${assignClientIds.includes(client.id) ? ' selected' : ''}`}
                      onClick={() => toggleClient(client.id)}
                    >
                      <Icon name="user" />
                      {client.name}
                    </button>
                  ))}
                </div>
              </div>
              <button
                className="btn btn-secondary"
                disabled={!selectedId || assignClientIds.length === 0}
                onClick={assign}
              >
                {t.progAssign}
              </button>
            </div>
            <button
              className="danger-outline"
              disabled={!selectedId}
              onClick={() => selectedId && removeProgram(selectedId)}
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
    </div>
  );
}
