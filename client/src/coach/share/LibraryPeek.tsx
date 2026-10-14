import type { ReactNode } from 'react';
import { Button } from '../../components/ui/Button';
import { Chip, ChipGroup } from '../../components/ui/Chip';
import { EmptyState } from '../../components/ui/EmptyState';
import { FailedState } from '../../components/ui/FailedState';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { IconTile } from '../../components/ui/IconTile';
import { Notice } from '../../components/ui/Notice';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { SidePanel } from '../layout/SidePanel';
import { exerciseDisplay } from '../../data/exerciseNames';
import { ShareCardView, useWords } from './ShareCardView';
import { equipName, type Words } from './labels';
import { KIND_ICON, resolveShare, USUAL_WEEKLY_SETS } from './resolve';
import type { ShareSourcePort } from './port';
import type { ShareRef, ShareSource, ShareView, Viewer } from './types';
import { useShareSource } from './useShare';
import './LibraryPeek.css';

export interface LibraryPeekProps {
  open: boolean;
  onClose: () => void;
  /** exercise, equipment, gym or muscle (the library kinds). */
  target: ShareRef | null;
  viewer: Viewer;
  who: string;
  /** "Share in chat": absent where the peek was opened from a shared card. */
  onShare?: (ref: ShareRef) => void;
  port?: ShareSourcePort;
}

function Sections({
  w,
  v,
  src,
  viewer,
  who,
}: {
  w: Words;
  v: ShareView;
  src: ShareSource;
  viewer: Viewer;
  who: string;
}) {
  const { sh } = w;
  const lib = src.library;
  const out: ReactNode[] = [];
  const me = viewer.clientId;
  if (v.kind === 'exercise') {
    const inProg = src.programs.filter(
      (p) =>
        p.assignedTo.includes(me) &&
        p.days.some((d) => d.rows?.some((r) => r.exerciseId === v.ref.id)),
    );
    out.push(
      <section key="prog" className="lpk-s">
        <SectionLabel>
          {viewer.side === 'trainer' ? sh.peekInProgram : sh.peekInYourProgram}
        </SectionLabel>
        {inProg.length === 0 ? (
          <Notice tone="note" icon="info">
            {sh.peekNotInProgram}
          </Notice>
        ) : (
          <GroupedList>
            {inProg.map((p) => (
              <ListRow
                key={p.id}
                icon={<IconTile icon={KIND_ICON.program} size={40} />}
                label={p.name}
                sub={p.days
                  .filter((d) => d.rows?.some((r) => r.exerciseId === v.ref.id))
                  .map((d) => d.name)
                  .join(', ')}
                strong
              />
            ))}
          </GroupedList>
        )}
      </section>,
    );
    const res = src.clients[me]?.results.find(
      (r) => r.id === v.ref.id || r.exerciseId === v.ref.id,
    );
    if (res) {
      const rv = resolveShare({ kind: 'results', id: res.id, ownerId: me }, viewer, src);
      out.push(
        <section key="res" className="lpk-s">
          <SectionLabel>
            {viewer.side === 'trainer' ? sh.peekResults(who) : sh.peekFactBest}
          </SectionLabel>
          {rv.state === 'locked' || rv.state === 'limited' ? (
            <Notice tone="note" icon="lock-simple" below={<small>{sh.peekLockedResultsWhy}</small>}>
              {sh.peekLockedResults(who)}
            </Notice>
          ) : (
            <ShareCardView view={rv} who={who} density="dock" />
          )}
        </section>,
      );
    } else if (viewer.side === 'trainer') {
      out.push(
        <Notice key="nores" tone="note" icon="info">
          {sh.peekNoResults}
        </Notice>,
      );
    }
  }
  if (v.kind === 'equipment') {
    const gyms = lib.gyms.filter((g) => g.equipmentIds.includes(v.ref.id));
    const exs = lib.exercises.filter((e) => e.equipment.includes(v.ref.id)).slice(0, 5);
    out.push(
      <section key="where" className="lpk-s">
        <SectionLabel>{sh.peekWhere}</SectionLabel>
        <GroupedList>
          {gyms.length === 0 ? (
            <ListRow label={sh.peekGymsCount(0)} />
          ) : (
            gyms.map((g) => (
              <ListRow
                key={g.id}
                icon={<IconTile icon={KIND_ICON.gym} size={40} />}
                label={g.name}
                sub={g.city}
                strong
              />
            ))
          )}
        </GroupedList>
      </section>,
      <section key="uses" className="lpk-s">
        <SectionLabel>{sh.peekUses}</SectionLabel>
        <GroupedList>
          {exs.map((e) => (
            <ListRow
              key={e.id}
              icon={<IconTile icon={KIND_ICON.exercise} size={40} />}
              label={exerciseDisplay(e.name, w.locale).primary}
              strong
            />
          ))}
        </GroupedList>
      </section>,
    );
  }
  if (v.kind === 'gym') {
    const g = lib.gyms.find((x) => x.id === v.ref.id);
    if (g && g.equipmentIds.length > 0)
      out.push(
        <section key="eq" className="lpk-s">
          <SectionLabel>{sh.peekFactMachines}</SectionLabel>
          <ChipGroup>
            {g.equipmentIds.slice(0, 12).map((id) => (
              <Chip key={id}>{equipName(w, id)}</Chip>
            ))}
          </ChipGroup>
        </section>,
      );
  }
  if (v.kind === 'muscle') {
    const exs = lib.exercises.filter((e) => e.muscles[0] === v.ref.id).slice(0, 6);
    const band = USUAL_WEEKLY_SETS[v.ref.id];
    const sets = v.facts.find((f) => f.key === 'setsWeek')?.value;
    if (band && typeof sets === 'number')
      out.push(
        <Notice key="verdict" tone="note" icon="chart-bar">
          {sets < band[0]
            ? sh.peekVerdict.below
            : sets > band[1]
              ? sh.peekVerdict.above
              : sh.peekVerdict.inside}
        </Notice>,
      );
    if (v.state === 'limited')
      out.push(
        <Notice key="lim" tone="note" icon="lock-simple">
          {sh.peekLockedSets(who)}
        </Notice>,
      );
    out.push(
      <section key="for" className="lpk-s">
        <SectionLabel>{sh.peekForMuscle}</SectionLabel>
        <GroupedList>
          {exs.map((e) => (
            <ListRow
              key={e.id}
              icon={<IconTile icon={KIND_ICON.exercise} size={40} />}
              label={exerciseDisplay(e.name, w.locale).primary}
              strong
            />
          ))}
        </GroupedList>
      </section>,
    );
  }
  return <>{out}</>;
}

function PeekBody({
  target,
  viewer,
  who,
  onShare,
  onClose,
  port,
}: Omit<LibraryPeekProps, 'open' | 'target'> & { target: ShareRef }) {
  const w = useWords();
  const { sh } = w;
  const { source, status, retry } = useShareSource(viewer.clientId, port);
  if (!source) {
    return status === 'error' ? (
      <FailedState
        title={sh.pickFailed}
        icon="cloud-slash"
        retryLabel={sh.pickRetry}
        onRetry={retry}
      />
    ) : (
      <SkeletonRows rows={4} label={sh.loadingPreview} />
    );
  }
  const v = resolveShare(target, viewer, source);
  if (v.state === 'removed')
    return (
      <EmptyState
        titleAs="h2"
        icon="trash"
        title={sh.peekGone(sh.kindLower[v.kind])}
        body={sh.peekGoneBody}
      >
        <Button variant="secondary" onClick={onClose}>
          {sh.peekDone}
        </Button>
      </EmptyState>
    );
  return (
    <div className="lpk">
      <ShareCardView view={v} who={who} density="peek" />
      {(v.state === 'ok' || v.state === 'limited') && (
        <Sections w={w} v={v} src={source} viewer={viewer} who={who} />
      )}
      <div className="lpk-act">
        {onShare && v.state !== 'locked' && (
          <Button variant="primary" icon="paper-plane-right" onClick={() => onShare(target)}>
            {sh.peekShare}
          </Button>
        )}
        <Button variant="ghost" onClick={onClose}>
          {sh.peekDone}
        </Button>
      </div>
    </div>
  );
}

/** Detail of a library item opened from a shared card or the picker: right drawer from 768 up, bottom sheet below. */
export function LibraryPeek(p: LibraryPeekProps) {
  const w = useWords();
  if (!p.open || !p.target) return null;
  return (
    <SidePanel
      open
      onClose={p.onClose}
      title={w.sh.kind[p.target.kind]}
      closeLabel={w.sh.pickClose}
    >
      <PeekBody {...p} target={p.target} />
    </SidePanel>
  );
}
