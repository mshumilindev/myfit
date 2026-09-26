/**
 * Members drawer (design m12): tap a program's avatars (or "Assign") and the
 * assignment opens straight away — who is on this program, the other clients,
 * tick to add, untick to remove, one Save. Adding replaces a member's active
 * program (server rule: one active per member); removing unassigns.
 */
import { useMemo, useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { tokenMatch } from '../../search';
import { useT } from '../../i18n';
import { Icon, Sheet } from '../../ui';
import type { Person, Program } from './model';

export interface MemberAssignment {
  memberId: string;
  programId: string;
  startedAt: number;
}

export function AssigneesSheet({
  program,
  people,
  assignments,
  programNames,
  onSave,
  onClose,
}: {
  program: Program;
  people: Person[];
  /** Every known assignment (members on any of my programs). */
  assignments: MemberAssignment[];
  /** Names of my other programs, for "on X · will switch". */
  programNames: Map<string, string>;
  onSave: (add: string[], remove: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useT();
  const byMember = useMemo(() => new Map(assignments.map((a) => [a.memberId, a])), [assignments]);
  const onNow = useMemo(
    () => new Set(assignments.filter((a) => a.programId === program.id).map((a) => a.memberId)),
    [assignments, program.id],
  );
  const [checked, setChecked] = useState<Set<string>>(() => new Set(onNow));
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => Date.now());
  const [failed, setFailed] = useState(false);

  const add = [...checked].filter((id) => !onNow.has(id));
  const remove = [...onNow].filter((id) => !checked.has(id));
  const needle = q.trim().toLowerCase();
  const match = (p: Person) => !needle || tokenMatch(p.name, needle);
  const current = people.filter((p) => onNow.has(p.id) && match(p));
  const others = people.filter((p) => !onNow.has(p.id) && match(p));

  const weekOf = (a: MemberAssignment | undefined) => {
    if (!a) return '';
    const w = Math.max(1, Math.floor((now - a.startedAt) / (7 * 86_400_000)) + 1);
    return program.weeks > 0
      ? t.pgWeekOf(Math.min(w, program.weeks), program.weeks)
      : t.progWeekN(w);
  };

  const toggle = (id: string) =>
    setChecked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const row = (p: Person, onProgram: boolean) => {
    const on = checked.has(p.id);
    const a = byMember.get(p.id);
    const hint = onProgram
      ? on
        ? weekOf(a)
        : t.pgWillBeRemoved
      : a
        ? on
          ? t.pgOnOtherSwitch(programNames.get(a.programId) ?? t.pgAnotherProgram)
          : t.pgOnOther(programNames.get(a.programId) ?? t.pgAnotherProgram)
        : t.pgNoProgram;
    return (
      <button
        key={p.id}
        type="button"
        role="checkbox"
        aria-checked={on}
        className={`pg-member${onProgram && !on ? ' leaving' : ''}`}
        onClick={() => toggle(p.id)}
      >
        <Avatar
          userId={p.id}
          name={p.name}
          hasPhoto={!!p.avatar}
          rev={p.avatarRev ?? 0}
          size={34}
        />
        <span className="pg-member-txt">
          <b>{p.name}</b>
          <small>{hint}</small>
        </span>
        <span className={`pg-check${on ? ' on' : ''}`} aria-hidden>
          {on && <Icon name="check" />}
        </span>
      </button>
    );
  };

  const statusLine =
    program.status === 'active'
      ? t.progStatusActive
      : program.status === 'archived'
        ? t.progStatusArchived
        : t.progStatusDraft;
  const lengthLine = program.weeks === 0 ? t.progOpenEnded : t.progWeeksCount(program.weeks);

  async function save() {
    setBusy(true);
    setFailed(false);
    try {
      await onSave(add, remove);
      onClose();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet onClose={onClose} className="pg-assign-sheet">
      <div className="pg-sheet pg-assign">
        <div className="pg-assign-head">
          <span className={`pg-status ${program.status}`}>
            {statusLine} · {lengthLine}
          </span>
          <h3>{program.name}</h3>
        </div>
        {people.length === 0 ? (
          <p className="pg-empty">{t.progNoClients}</p>
        ) : (
          <>
            <label className="pg-search">
              <Icon name="magnifying-glass" />
              <input
                value={q}
                placeholder={t.pgSearchClients}
                aria-label={t.pgSearchClients}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            {current.length > 0 && (
              <>
                <div className="pg-label">{t.pgOnThisProgram(onNow.size)}</div>
                <div className="pg-members">{current.map((p) => row(p, true))}</div>
              </>
            )}
            {others.length > 0 && (
              <>
                <div className="pg-label">{t.pgOtherClients}</div>
                <div className="pg-members">{others.map((p) => row(p, false))}</div>
              </>
            )}
          </>
        )}
        {failed && <p className="pg-error">{t.pgSaveFailed}</p>}
        <button
          type="button"
          className="btn btn-primary pg-wide pg-save-delta"
          disabled={busy || (add.length === 0 && remove.length === 0)}
          onClick={() => void save()}
        >
          {busy ? t.saving : t.save}
          {add.length > 0 && <span className="plus">+{add.length}</span>}
          {remove.length > 0 && <span className="minus">−{remove.length}</span>}
        </button>
      </div>
    </Sheet>
  );
}
