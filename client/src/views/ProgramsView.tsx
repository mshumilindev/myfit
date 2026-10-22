/**
 * Programs — create and manage programs (design "Spotter — Programs Redesign",
 * V06 "Big tiles"). Only authoring lives here: starting or backfilling a
 * program day belongs to Today / Start.
 *
 * Home: "‹ Overview", My program (the one I'm on), programs I created (with the
 * avatars of who is on each — tap them to open the members drawer), Import CSV,
 * New program. A program opens in the editor page (./programs/ProgramPage).
 */
import { ClientProgramExtrasLazy } from '../coach/client/lazy';
import { openActivities } from './programs/activitiesVault';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ListRow } from '../components/ui/GroupedList';
import { collection, documentId, getDocs, query, where } from 'firebase/firestore';
import { callFn, currentUid, getRole, getUsername, trackMutation } from '../api';
import { db } from '../firebase';
import { offlineHydrate, offlineDedupe, offlineRevalidate } from '../offline/offlineCache';
import { useT } from '../i18n';
import type { Shell } from '../App';
import { ProgramsTabs, type ProgramsPeer } from '../components/ProgramsTabs';
import { UserAvatar } from '../components/Avatar';
import { clearProgramSeed, peekProgramSeed } from '../data/programSeed';
import { PROGRAM_NET_KEY } from '../data/programMine';
import type { ProgramItemLike } from '../data/programCsv';
import { knownExercises } from '../store';
import { Icon } from '../ui';
import { RowListSkeleton } from '../components/ui/Skeletons';
import { ProgramCsvDialog } from './ProgramCsvDialog';
import { ProgramPage, useLibraryNames } from './programs/ProgramPage';
import { AssigneesSheet, type MemberAssignment } from './programs/AssigneesSheet';
import { AvatarStack } from './programs/pieces';
import {
  PROGRAM_NEW_HASH,
  parseProgramsHash,
  programEditHash,
  programsHash,
} from './programs/programsRoute';
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
import { currentHash, replaceHash, setHash as goTo } from '../route';

type Open = { program: Program; saved: boolean; readOnly?: boolean };

async function normalizeMine(a: ProgramAssignment): Promise<ProgramAssignment> {
  return { ...a, program: normalizeProgram(await openActivities(a.program)) };
}

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
  // The editor lives under the URL: `#/programs/<id>/edit` (a saved program) or `#/programs/new` (not saved yet). The hash
  // is the source of truth, so Back, reload and shared links all land on the same page.
  const [hash, setHash] = useState(() => currentHash());
  useEffect(() => {
    const on = () => setHash(currentHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  /** The unsaved program behind `#/programs/new`: blank, an import, or "Suggest a program" (taken once). */
  const [newDraft, setNewDraft] = useState<Program>(() => {
    const seed = peekProgramSeed();
    if (!seed) return freshProgram('');
    return {
      ...freshProgram(seed.name),
      weeks: seed.weeks,
      dayNames: seed.dayNames,
      targetMuscles: sanitizeTargetMuscles(seed.targetMuscles),
      items: normalizeItems(seed.items as unknown as ProgramItem[]),
    };
  });
  /** The program just saved from `#/programs/new`: the page keeps running while the list reloads. */
  const [justSaved, setJustSaved] = useState<Program | null>(null);
  const seeded = useRef(false);
  /** True when this view pushed the editor's history entry (Back pops it; otherwise Back replaces it with the list). */
  const pushed = useRef(false);
  useEffect(() => {
    const seed = peekProgramSeed();
    if (seed && !seeded.current) {
      seeded.current = true;
      pushed.current = true;
      goTo(PROGRAM_NEW_HASH);
    }
    clearProgramSeed(seed);
  }, []);

  const parsedRoute = parseProgramsHash(hash);

  function goEditor(r: Parameters<typeof programsHash>[0]) {
    pushed.current = true;
    goTo(programsHash(r));
  }
  function openNew(draft: Program) {
    setNewDraft(draft);
    goEditor({ kind: 'new' });
  }
  function closeEditor() {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else {
      replaceHash('#/programs');
      setHash('#/programs');
    }
  }

  const loadPrograms = useCallback(() => {
    const uid = currentUid();
    if (!uid) return;
    getDocs(query(collection(db, 'programs'), where('authorId', '==', uid)))
      .then(async (snap) => {
        const opened = await Promise.all(snap.docs.map((d) => openActivities(d.data() as Program)));
        const list = opened
          .map((p) => normalizeProgram(p))
          .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
        setFailed(false);
        setPrograms(list);
      })
      .catch(() => setFailed(true));
  }, []);

  // True once the network has answered: a sealed snapshot never overrides it.
  const mineLive = useRef(false);
  /** `force`: after a change (assign / unassign) never reuse a request that started before it. */
  const loadMine = useCallback((force = true) => {
    offlineDedupe(
      PROGRAM_NET_KEY,
      () => callFn<{ assignment: ProgramAssignment | null }>('programMine'),
      { force },
    )
      .then(async (data) => {
        const next = data.assignment ? await normalizeMine(data.assignment) : null;
        mineLive.current = true;
        setMine(next);
      })
      // offline: keep the snapshot on screen; without one there is simply no program to show
      .catch(() => undefined)
      .finally(() => setMineLoaded(true));
  }, []);

  useEffect(() => {
    loadPrograms();
    // Offline-first: the last good assignment (sealed on this device) first, never awaited by the network read.
    void offlineHydrate<ProgramAssignment>(
      'programMine',
      (a) => {
        void normalizeMine(a).then((m) => {
          if (mineLive.current) return;
          setMine((cur) => cur ?? m);
          setMineLoaded(true);
        });
      },
      { isLive: () => mineLive.current },
    );
    loadMine(false);
  }, [loadPrograms, loadMine]);

  useEffect(() => {
    if (!isCoach) return;
    type Reply = { people?: (Person & { role?: string })[]; clients?: Person[] };
    // the same roster the Clients / Admin screens keep: one snapshot, one in-flight request
    return offlineRevalidate<Person[]>({
      key: role === 'admin' ? 'adminPeople' : 'trainerClients',
      accept: Array.isArray,
      fetch: async () => {
        const data = await callFn<Reply>(role === 'admin' ? 'adminPeople' : 'trainerClients');
        return (role === 'admin' ? data.people : data.clients) ?? [];
      },
      apply: (rows) => setPeople(rows.filter((c) => c.id && c.name)),
      onError: () => setPeople((cur) => cur),
    });
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
    openNew(draft);
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

  // --- editor page -------------------------------------------------------------------
  const loaded = programs !== null && mineLoaded;
  let open: Open | null = null;
  if (parsedRoute?.kind === 'new') open = { program: newDraft, saved: false };
  else if (parsedRoute?.kind === 'edit') {
    const own =
      (programs ?? []).find((p) => p.id === parsedRoute.id) ??
      (justSaved?.id === parsedRoute.id ? justSaved : undefined);
    if (own) open = { program: own, saved: true };
    else if (mine?.program.id === parsedRoute.id)
      open = { program: mine.program, saved: true, readOnly: true };
  }
  // A link to a program that is not there (deleted, someone else's) goes back to the list instead of a blank page.
  const missing = !!parsedRoute && !open && loaded;
  useEffect(() => {
    if (!missing) return;
    replaceHash('#/programs');
  }, [missing]);

  if (parsedRoute && !open && !missing) {
    return (
      <div className="screen pg-page" aria-busy>
        <RowListSkeleton rows={3} withAvatar={false} />
      </div>
    );
  }

  if (open) {
    return (
      <>
        <ProgramPage
          key={open.program.id}
          initial={open.program}
          saved={open.saved}
          readOnly={open.readOnly}
          library={programs ?? []}
          shell={shell}
          onClose={() => {
            closeEditor();
            loadPrograms();
          }}
          onSaved={(p) => {
            // The first save of a new program turns `#/programs/new` into its own address.
            if (parsedRoute?.kind === 'new') {
              setJustSaved(p);
              replaceHash(programEditHash(p.id));
              setHash(currentHash());
            }
            loadPrograms();
            loadMine();
          }}
          onDeleted={() => {
            closeEditor();
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
    if (!mineLoaded) return <Card className="pg-card uisk" aria-hidden />;
    if (!mine) {
      return (
        <Card className="pg-card pg-mine-empty">
          <b>{t.progNone}</b>
          <span>{t.progMemberEmpty}</span>
        </Card>
      );
    }
    const p = mine.program;
    const byMe = p.authorId === currentUid() || mine.assignedBy === getUsername();
    const authored = (programs ?? []).find((x) => x.id === p.id);
    return (
      <Card
        as="button"
        tone="accent"
        emphasis="hero"
        className="pg-card pg-mine"
        onClick={() => goEditor({ kind: 'edit', id: (authored ?? p).id })}
      >
        <span className="pg-mine-top">
          <span className="pg-status active">
            {p.weeks > 0
              ? t.pgActiveWeekOf(Math.min(mine.week, p.weeks), p.weeks)
              : t.pgActiveWeek(mine.week)}
          </span>
          {mine.assignedBy && !byMe ? (
            <span className="pg-by">
              <UserAvatar name={mine.assignedBy} size={22} />
              {t.pgByTrainer(mine.assignedBy)}
            </span>
          ) : (
            <span className="pg-by">{t.progStatusMine}</span>
          )}
        </span>
        <span className="pg-card-name">{p.name}</span>
        <span className="pg-card-meta">{lengthText(p)}</span>
      </Card>
    );
  })();

  return (
    <div className="screen pg-page pg-home">
      <div className="pg-home-head ctl-row--md">
        <ProgramsTabs active="programs" onSelect={(peer) => onProgramsTab?.(peer)} />
        <h2 className="pg-h1">{t.progTitle}</h2>
        <span className="grow" />
        <div className="pg-home-actions desk">
          <Button variant="secondary" icon="upload-simple" onClick={() => setCsvOpen(true)}>
            {t.csvImport}
          </Button>
          <Button variant="primary" onClick={() => openNew(freshProgram(''))}>
            <Icon name="plus" />
            {t.progNew}
          </Button>
        </div>
      </div>

      <section>
        <div className="pg-label">{t.pgMyProgram}</div>
        {myProgram}
        <ClientProgramExtrasLazy />
      </section>

      <section>
        <div className="pg-label pg-label-row">
          <span>{t.pgCreatedByMe}</span>
          {programs && <span className="pg-count">{visible.length}</span>}
        </div>
        {failed && (
          <Card as="button" className="pg-card pg-retry" onClick={loadPrograms}>
            <Icon name="warning-circle" />
            {t.retry}
          </Card>
        )}
        {!failed && programs === null && <RowListSkeleton rows={3} withAvatar={false} />}
        {programs && programs.length === 0 && <p className="pg-empty">{t.progEmpty}</p>}
        <div className="pg-tiles">
          {visible.map((p) => {
            const on = membersOn(p.id);
            return (
              <Card key={p.id} pad="none" emphasis="card" className={`pg-card pg-tile ${p.status}`}>
                <ListRow
                  strong
                  label={p.name}
                  sub={lengthText(p)}
                  value={<span className={`pg-status ${p.status}`}>{statusText(p)}</span>}
                  onClick={() => goEditor({ kind: 'edit', id: p.id })}
                />
                {isCoach && (
                  <Button
                    variant="ghost"
                    size="sm"
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
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
        {archivedN > 0 && (
          <Button variant="link" icon="archive" onClick={() => setShowArchived((x) => !x)}>
            {showArchived ? t.pgHideArchived : t.pgArchivedN(archivedN)}
          </Button>
        )}
      </section>

      <div className="pg-home-actions mob">
        <Button variant="secondary" icon="upload-simple" onClick={() => setCsvOpen(true)}>
          {t.csvImport}
        </Button>
        <Button variant="primary" onClick={() => openNew(freshProgram(''))}>
          <Icon name="plus" />
          {t.progNew}
        </Button>
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
