/**
 * Programs — create and manage programs (design "Spotter — Programs Redesign",
 * V06 "Big tiles"). Only authoring lives here: starting or backfilling a
 * program day belongs to Today / Start.
 *
 * Home: "‹ Overview", My program (the one I'm on), programs I created (with the
 * avatars of who is on each — tap them to open the members drawer), Import CSV,
 * New program. A program opens in the builder (./programs/ProgramBuilder).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, documentId, getDocs, query, where } from 'firebase/firestore';
import { callFn, currentUid, getRole, getUsername, trackMutation } from '../api';
import { db } from '../firebase';
import { useT } from '../i18n';
import type { Shell } from '../App';
import { ProgramsTabs, type ProgramsPeer } from '../components/ProgramsTabs';
import { Avatar } from '../components/Avatar';
import { clearProgramSeed, peekProgramSeed } from '../data/programSeed';
import type { ProgramItemLike } from '../data/programCsv';
import { knownExercises } from '../store';
import { Icon, RowListSkeleton } from '../ui';
import { ProgramCsvDialog } from './ProgramCsvDialog';
import { ProgramBuilder, useLibraryNames, type BuilderStep } from './programs/ProgramBuilder';
import { AssigneesSheet, type MemberAssignment } from './programs/AssigneesSheet';
import { AvatarStack } from './programs/pieces';
import {
  freshProgram,
  normalizeItems,
  normalizeProgram,
  sanitizeTargetMuscles,
  trainingDays,
  type Person,
  type Program,
  type ProgramAssignment,
  type ProgramItem,
} from './programs/model';
import './programs/programs.css';

type Open = { program: Program; saved: boolean; step: BuilderStep; readOnly?: boolean };

export function ProgramsView({
  shell,
  onProgramsTab,
}: {
  shell: Shell;
  /** Peer tabs (Programs ↔ Exercises…) owned by App; now a back link to Overview. */
  onProgramsTab?: (peer: ProgramsPeer) => void;
}) {
  const { t } = useT();
  const role = getRole();
  const isCoach = role === 'trainer' || role === 'admin';
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [mine, setMine] = useState<ProgramAssignment | null>(null);
  const [mineLoaded, setMineLoaded] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [assignments, setAssignments] = useState<MemberAssignment[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [membersOf, setMembersOf] = useState<Program | null>(null);
  const [open, setOpen] = useState<Open | null>(() => {
    // "Suggest a program" (Today) hands over a prefilled draft, taken once.
    const seed = peekProgramSeed();
    if (!seed) return null;
    return {
      saved: false,
      step: 'week',
      program: {
        ...freshProgram(seed.name),
        weeks: seed.weeks,
        dayNames: seed.dayNames,
        targetMuscles: sanitizeTargetMuscles(seed.targetMuscles),
        items: normalizeItems(seed.items as unknown as ProgramItem[]),
      },
    };
  });
  useEffect(() => {
    clearProgramSeed(peekProgramSeed());
  }, []);

  const loadPrograms = useCallback(() => {
    const uid = currentUid();
    if (!uid) return;
    getDocs(query(collection(db, 'programs'), where('authorId', '==', uid)))
      .then((snap) => {
        const list = snap.docs
          .map((d) => normalizeProgram(d.data() as Program))
          .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
        setFailed(false);
        setPrograms(list);
      })
      .catch(() => setFailed(true));
  }, []);

  const loadMine = useCallback(() => {
    callFn<{ assignment: ProgramAssignment | null }>('programMine')
      .then((data) => {
        setMine(
          data.assignment
            ? { ...data.assignment, program: normalizeProgram(data.assignment.program) }
            : null,
        );
      })
      .catch(() => setMine(null))
      .finally(() => setMineLoaded(true));
  }, []);

  useEffect(() => {
    loadPrograms();
    loadMine();
  }, [loadPrograms, loadMine]);

  useEffect(() => {
    if (!isCoach) return;
    callFn<{
      people?: (Person & { role?: string })[];
      clients?: Person[];
    }>(role === 'admin' ? 'adminPeople' : 'trainerClients')
      .then((data) => {
        const rows = role === 'admin' ? (data.people ?? []) : (data.clients ?? []);
        setPeople(rows.filter((c) => c.id && c.name));
      })
      .catch(() => setPeople([]));
  }, [isCoach, role]);

  // Each client's current assignment (one per member, doc id = member id);
  // trainers/admins may read them. Tells who is on which of my programs and
  // who is on something else.
  const memberIds = useMemo(() => people.map((p) => p.id).join(','), [people]);
  const loadAssignments = useCallback(() => {
    if (!isCoach || !memberIds) return;
    const ids = memberIds.split(',');
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
    Promise.all(
      chunks.map((c) =>
        getDocs(query(collection(db, 'assignments'), where(documentId(), 'in', c))),
      ),
    )
      .then((snaps) =>
        setAssignments(
          snaps.flatMap((s) =>
            s.docs.map((d) => {
              const a = d.data() as MemberAssignment;
              return {
                memberId: a.memberId ?? d.id,
                programId: a.programId,
                startedAt: a.startedAt,
              };
            }),
          ),
        ),
      )
      .catch(() => setAssignments([]));
  }, [isCoach, memberIds]);
  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const programNames = useLibraryNames(programs ?? []);
  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const membersOn = (id: string): Person[] =>
    assignments
      .filter((a) => a.programId === id)
      .map((a) => peopleById.get(a.memberId))
      .filter((p): p is Person => !!p);

  async function saveMembers(program: Program, add: string[], remove: string[]) {
    await trackMutation(
      (async () => {
        for (const memberId of add)
          await callFn('assignProgram', { id: program.id, memberId, startWeek: 1 });
        for (const memberId of remove) await callFn('unassignProgram', { memberId });
      })(),
    );
    loadAssignments();
    loadPrograms();
    if (add.includes(currentUid() ?? '') || remove.includes(currentUid() ?? '')) loadMine();
  }

  function importToNew(items: ProgramItemLike[]) {
    const draft = freshProgram(t.progNew);
    const incoming = items.map((it) => ({ ...it, id: crypto.randomUUID() }) as ProgramItem);
    for (const d of new Set(incoming.map((i) => i.day)))
      draft.dayNames[String(d)] = t.weekDayNames[d - 1] ?? t.progDay(d);
    draft.items = normalizeItems(incoming);
    setCsvOpen(false);
    setOpen({ program: draft, saved: false, step: 'basics' });
  }

  const membersDrawer = membersOf && (
    <AssigneesSheet
      program={membersOf}
      people={people}
      assignments={assignments}
      programNames={programNames}
      onSave={(add, remove) => saveMembers(membersOf, add, remove)}
      onClose={() => setMembersOf(null)}
    />
  );

  // --- builder ----------------------------------------------------------------------
  if (open) {
    return (
      <>
        <ProgramBuilder
          key={open.program.id}
          initial={open.program}
          saved={open.saved}
          startStep={open.step}
          readOnly={open.readOnly}
          library={programs ?? []}
          shell={shell}
          onClose={() => {
            setOpen(null);
            loadPrograms();
          }}
          onSaved={() => {
            loadPrograms();
            loadMine();
          }}
          onDeleted={() => {
            setOpen(null);
            loadPrograms();
            loadAssignments();
          }}
          onAssign={isCoach ? (p) => setMembersOf(p) : undefined}
        />
        {membersDrawer}
      </>
    );
  }

  // --- home -------------------------------------------------------------------------
  const visible = (programs ?? []).filter((p) => showArchived || p.status !== 'archived');
  const archivedN = (programs ?? []).filter((p) => p.status === 'archived').length;
  const statusText = (p: Program) =>
    p.status === 'active'
      ? t.progStatusActive
      : p.status === 'archived'
        ? t.progStatusArchived
        : t.progStatusDraft;
  const lengthText = (p: Program) =>
    `${p.weeks === 0 ? t.progOpenEnded : t.progWeeksCount(p.weeks)} · ${t.progDaysCount(trainingDays(p).length)}`;

  const myProgram = (() => {
    if (!mineLoaded) return <div className="pg-card sk" aria-hidden />;
    if (!mine) {
      return (
        <div className="pg-card pg-mine-empty">
          <b>{t.progNone}</b>
          <span>{t.progMemberEmpty}</span>
        </div>
      );
    }
    const p = mine.program;
    const byMe = p.authorId === currentUid() || mine.assignedBy === getUsername();
    const authored = (programs ?? []).find((x) => x.id === p.id);
    return (
      <button
        type="button"
        className="pg-card pg-mine"
        onClick={() =>
          setOpen(
            authored
              ? { program: authored, saved: true, step: 'review' }
              : { program: p, saved: true, step: 'review', readOnly: true },
          )
        }
      >
        <span className="pg-mine-top">
          <span className="pg-status active">
            {p.weeks > 0
              ? t.pgActiveWeekOf(Math.min(mine.week, p.weeks), p.weeks)
              : t.pgActiveWeek(mine.week)}
          </span>
          {mine.assignedBy && !byMe ? (
            <span className="pg-by">
              <Avatar name={mine.assignedBy} size={22} />
              {t.pgByTrainer(mine.assignedBy)}
            </span>
          ) : (
            <span className="pg-by">{t.progStatusMine}</span>
          )}
        </span>
        <span className="pg-card-name">{p.name}</span>
        <span className="pg-card-meta">{lengthText(p)}</span>
      </button>
    );
  })();

  return (
    <div className="screen pg-page pg-home">
      <div className="pg-home-top">
        <ProgramsTabs active="programs" onSelect={(peer) => onProgramsTab?.(peer)} />
      </div>
      <div className="pg-home-head">
        <h2 className="pg-h1">{t.progTitle}</h2>
        <span className="grow" />
        <div className="pg-home-actions desk">
          <button type="button" className="pg-sec" onClick={() => setCsvOpen(true)}>
            <Icon name="upload-simple" />
            {t.csvImport}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setOpen({ program: freshProgram(''), saved: false, step: 'basics' })}
          >
            <Icon name="plus" />
            {t.progNew}
          </button>
        </div>
      </div>

      <section>
        <div className="pg-label">{t.pgMyProgram}</div>
        {myProgram}
      </section>

      <section>
        <div className="pg-label pg-label-row">
          <span>{t.pgCreatedByMe}</span>
          {programs && <span className="pg-count">{visible.length}</span>}
        </div>
        {failed && (
          <button type="button" className="pg-card pg-retry" onClick={loadPrograms}>
            <Icon name="warning-circle" />
            {t.retry}
          </button>
        )}
        {!failed && programs === null && <RowListSkeleton rows={3} withAvatar={false} />}
        {programs && programs.length === 0 && <p className="pg-empty">{t.progEmpty}</p>}
        <div className="pg-tiles">
          {visible.map((p) => {
            const on = membersOn(p.id);
            return (
              <div key={p.id} className={`pg-card pg-tile ${p.status}`}>
                <button
                  type="button"
                  className="pg-tile-main"
                  onClick={() => setOpen({ program: p, saved: true, step: 'review' })}
                >
                  <span className={`pg-status ${p.status}`}>{statusText(p)}</span>
                  <span className="pg-card-name">{p.name}</span>
                  <span className="pg-card-meta">{lengthText(p)}</span>
                </button>
                {isCoach && (
                  <button
                    type="button"
                    className="pg-tile-members"
                    aria-label={t.pgMembersOn(p.name)}
                    onClick={() => setMembersOf(p)}
                  >
                    {on.length ? (
                      <AvatarStack people={on} />
                    ) : (
                      <span className="pg-assign-link">
                        <Icon name="user-focus" />
                        {t.progAssign}
                      </span>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {archivedN > 0 && (
          <button type="button" className="pg-link-btn" onClick={() => setShowArchived((x) => !x)}>
            <Icon name="archive" />
            {showArchived ? t.pgHideArchived : t.pgArchivedN(archivedN)}
          </button>
        )}
      </section>

      <div className="pg-home-actions mob">
        <button type="button" className="pg-sec" onClick={() => setCsvOpen(true)}>
          <Icon name="upload-simple" />
          {t.csvImport}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setOpen({ program: freshProgram(''), saved: false, step: 'basics' })}
        >
          <Icon name="plus" />
          {t.progNew}
        </button>
      </div>

      {csvOpen && (
        <ProgramCsvDialog
          known={knownExercises().map((e) => e.name)}
          onClose={() => setCsvOpen(false)}
          onImport={importToNew}
        />
      )}
      {membersDrawer}
    </div>
  );
}
