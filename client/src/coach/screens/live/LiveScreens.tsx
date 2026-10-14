import { BackButton } from '../../../components/ui/BackButton';
import { Button, IconButton } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { GroupedList, ListRow } from '../../../components/ui/GroupedList';
import { InfoTable } from '../../../components/ui/InfoTable';
import { Notice } from '../../../components/ui/Notice';
import { SectionLabel } from '../../../components/ui/SectionLabel';
import { SeverityDot } from '../../../components/ui/SeverityDot';
import { SkeletonRows } from '../../../components/ui/Skeleton';
import { StatTile } from '../../../components/ui/StatTile';
import { COACH_BREAKPOINT, useMinWidth } from '../../../components/ui/breakpoints';
import { useLiveT } from '../../../i18n/coachLive';
import { ClientAvatar } from '../../ClientAvatar';
import { coachClock } from '../../format';
import { Header, Inspector, Page, Split } from '../../layout/Layout';
import { chatRoute, type CoachRoute } from '../../routes';
import { firstName } from '../format';
import { lastSeen, statusWord, subLine } from './liveText';
import { clockText, minutesOf, tonnesText, type LiveRow } from './model';
import type { LivePort } from './port';
import { useCoachLive, type LiveApi } from './useLive';
import './Live.css';

const TONE = { live: 'ok', offline: 'illness', finished: 'neutral' } as const;

export interface LiveScreenProps {
  onNavigate: (r: CoachRoute) => void;
  /** Test / story seam. */
  port?: LivePort;
  uid?: string | null;
}

function Unavailable({ api }: { api: LiveApi }) {
  const { lv } = useLiveT();
  if (api.status !== 'error') return null;
  return (
    <Notice
      tone="note"
      icon="cloud-slash"
      trail={
        <Button variant="secondary" size="sm" onClick={api.retry}>
          {lv.lvRetry}
        </Button>
      }
    >
      {lv.lvUnavailable}
    </Notice>
  );
}

/** Live (`#/c/live`): everyone training now, offline or just finished. A row opens that client's live page. */
export function LiveScreen({ onNavigate, port, uid }: LiveScreenProps) {
  const { lv } = useLiveT();
  const api = useCoachLive({ port, uid, tickMs: 1000 });
  const { rows, counts } = api;
  const loading = api.status === 'loading' && rows.length === 0;
  return (
    <Page>
      <Header
        title={lv.lvTitle}
        subtitle={
          rows.length ? lv.lvSummary(counts.live, counts.offline, counts.finished) : undefined
        }
      />
      <Unavailable api={api} />
      {loading ? (
        <SkeletonRows rows={3} label={lv.lvListLabel} />
      ) : rows.length === 0 ? (
        <Card pad="lg">
          <EmptyState titleAs="h2" centered icon="heartbeat" title={lv.lvNoneH} body={lv.lvNoneB} />
        </Card>
      ) : (
        <GroupedList list label={lv.lvListLabel}>
          {rows.map((r) => (
            <li key={r.client.id}>
              <ListRow
                strong
                icon={
                  <ClientAvatar
                    id={r.client.id}
                    name={r.client.name}
                    hasPhoto={r.client.hasPhoto}
                    size={40}
                  />
                }
                label={r.client.name}
                sub={subLine(lv, r)}
                value={
                  <span className="lv-rowv">
                    <span>
                      {r.state === 'finished' ? clockText(r.elapsedMs) : clockText(r.elapsedMs)}
                    </span>
                    <SeverityDot tone={TONE[r.state]}>{statusWord(lv, r)}</SeverityDot>
                  </span>
                }
                chevron
                aria-label={`${r.client.name}, ${statusWord(lv, r)}`}
                onClick={() => onNavigate({ screen: 'client', cid: r.client.id, tab: 'live' })}
              />
            </li>
          ))}
        </GroupedList>
      )}
    </Page>
  );
}

export interface LiveClientScreenProps extends LiveScreenProps {
  cid: string;
}

/**
 * One client's live page (S-22, `#/c/clients/<cid>/live`). The five service fields, the last session as context
 * and the finished totals. No per-set grid, ever (R-FE-062): the sets appear in the client's workouts afterwards.
 */
export function LiveClientScreen({ cid, onNavigate, port, uid }: LiveClientScreenProps) {
  const { lv } = useLiveT();
  const wide = useMinWidth(COACH_BREAKPOINT);
  const api = useCoachLive({ port, uid, tickMs: 1000 });
  const client = api.clients.get(cid);
  const row = api.rows.find((r) => r.client.id === cid);
  const first = firstName(client?.name ?? lv.lvClient);

  const back = (
    <BackButton
      label={lv.lvBack}
      text={lv.lvBack}
      onClick={() => onNavigate({ screen: 'clients' })}
    />
  );

  if (!client) {
    return (
      <Page>
        <div>{back}</div>
        {api.loadingClients ? (
          <SkeletonRows rows={4} label={lv.lvTitle} />
        ) : (
          <Card pad="lg">
            <EmptyState
              titleAs="h2"
              centered
              icon="heartbeat"
              title={lv.lvNoneH}
              body={lv.lvNoneB}
            />
          </Card>
        )}
      </Page>
    );
  }

  const toChat = () => onNavigate(chatRoute(cid));
  const toClient = () => onNavigate({ screen: 'client', cid });
  // phone: icon buttons (the header has no room for two labelled ones next to the name)
  const actions = wide ? (
    <>
      <Button variant="secondary" icon="envelope" onClick={toChat}>
        {lv.lvMessage(first)}
      </Button>
      <Button variant="primary" icon="user-focus" onClick={toClient}>
        {lv.lvOpenClient}
      </Button>
    </>
  ) : (
    <>
      <IconButton icon="envelope" label={lv.lvMessage(first)} onClick={toChat} />
      <IconButton icon="user-focus" label={lv.lvOpenClient} onClick={toClient} />
    </>
  );

  return (
    <Page>
      <div>{back}</div>
      <Header
        title={client.name}
        subtitle={row ? subLine(lv, row) : lv.lvSubNone(first)}
        actions={actions}
      />
      <Unavailable api={api} />
      <Split ratio="8-4">
        <div className="lv-main">
          {row ? (
            <LiveCard row={row} first={first} />
          ) : api.status === 'loading' ? (
            <SkeletonRows rows={4} label={lv.lvTitle} />
          ) : (
            <Card pad="lg">
              <EmptyState
                titleAs="h2"
                centered
                icon="heartbeat"
                title={lv.lvNoneClientH(first)}
                body={lv.lvNoneClientB}
              />
            </Card>
          )}
        </div>
        <Inspector label={lv.lvClient}>
          <div className="lv-client">
            <ClientAvatar id={client.id} name={client.name} hasPhoto={client.hasPhoto} size={48} />
            <strong>{client.name}</strong>
          </div>
          <InfoTable
            label={lv.lvClient}
            rows={[
              ...(client.goal ? [{ id: 'goal', label: lv.lvGoal, value: client.goal }] : []),
              { id: 'program', label: lv.lvProgram, value: client.program },
              ...(client.gym
                ? [{ id: 'week', label: lv.lvWeek(client.programWeek), value: client.gym }]
                : []),
            ]}
          />
        </Inspector>
      </Split>
    </Page>
  );
}

function LiveCard({ row, first }: { row: LiveRow; first: string }) {
  const { lv } = useLiveT();
  const s = row.session;
  const unknown = lv.lvUnknown;
  const heartbeat = row.state === 'finished' ? '–' : lastSeen(lv, row.lastSeenS ?? 0);
  return (
    <>
      {row.duplicates > 0 && (
        <Notice tone="note" icon="info">
          {lv.lvDuplicate(first)}
        </Notice>
      )}
      <Card pad="lg" className="lv-card">
        <SectionLabel>{lv.lvStatusLive}</SectionLabel>
        <StatTile
          big
          role="timer"
          aria-live="off"
          aria-label={`${lv.lvClockLabel}: ${clockText(row.elapsedMs)}`}
          label={
            <SeverityDot tone={TONE[row.state]}>
              {row.state === 'finished' && s.finishedAt != null
                ? `${statusWord(lv, row)} ${coachClock(s.finishedAt)}`
                : statusWord(lv, row)}
            </SeverityDot>
          }
          value={clockText(row.elapsedMs)}
          sub={
            row.state === 'finished' && s.finalSets != null
              ? lv.lvFinishedLine(
                  coachClock(s.finishedAt ?? s.updatedAt),
                  s.finalSets,
                  tonnesText(s.finalTonnageKg ?? 0),
                )
              : row.state === 'offline'
                ? heartbeat
                : `${minutesOf(row.elapsedMs)} min`
          }
        />
        <InfoTable
          label={lv.lvFieldsLabel}
          rows={[
            { id: 'name', label: lv.lvFName, value: s.sessionName ?? unknown },
            { id: 'started', label: lv.lvFStarted, value: coachClock(s.startedAt) },
            { id: 'gym', label: lv.lvFGym, value: s.gymName ?? unknown },
            { id: 'exercises', label: lv.lvFExercises, value: s.exerciseCount ?? unknown },
            { id: 'heartbeat', label: lv.lvFHeartbeat, value: heartbeat },
          ]}
        />
      </Card>
      {s.lastName != null && s.lastSets != null && (
        <Card pad="lg">
          <SectionLabel>{lv.lvLastSession}</SectionLabel>
          <p className="lv-last">
            {lv.lvLastLine(s.lastName, s.lastSets, tonnesText(s.lastTonnageKg ?? 0))}
          </p>
        </Card>
      )}
      <Notice tone="neutral" icon="lock-simple">
        {lv.lvNote(first)}
      </Notice>
    </>
  );
}
