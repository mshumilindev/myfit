import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { FailedState } from '../../components/ui/FailedState';
import { Notice } from '../../components/ui/Notice';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { Tag } from '../../components/ui/Tag';
import { COACH_BREAKPOINT, useMinWidth } from '../../components/ui/breakpoints';
import { usePgT } from '../../i18n/coachProgram';
import { useRosterT } from '../../i18n/coachRoster';
import {
  CheckReport,
  PageFrame,
  trainingDays,
  type Finding,
  type PageButton,
} from '../../tools/programEditor';
import { useCoachWorld, type CoachWorldPort } from '../data';
import { Inspector, Page, Split } from '../layout/Layout';
import { programPageBack, programPageRoute, type CoachRoute } from '../routes';
import { useProgramDraft } from './draftStore';
import { requestEditorFocus } from './focusRequest';
import { firstName } from './parts';
import type { ProgramPort } from './port';
import { checkContextOf } from './ProgramTab';
import { useCoachEditorHost } from './toolHost';
import { toDoc } from './toolHostBase';
import { sharedRestrictions } from './check';
import './Program.css';

export interface CheckScreenProps {
  cid: string;
  /** Where the page was opened from: a client's Program tab or the Programs list. */
  from?: 'client' | 'list';
  onNavigate: (r: CoachRoute) => void;
  port?: ProgramPort;
  worldPort?: CoachWorldPort;
}

/** S-11, S-12: "Check before sending" for ONE client's draft. Read-only; fixes happen in the editor, on the same draft. */
export function CheckScreen({ cid, from = 'list', onNavigate, port, worldPort }: CheckScreenProps) {
  const { p } = usePgT();
  const { r } = useRosterT();
  const wide = useMinWidth(COACH_BREAKPOINT);
  const world = useCoachWorld(worldPort);
  const client = world.world?.rows.find((x) => x.client.id === cid)?.client;
  const api = useProgramDraft(
    cid,
    client ? checkContextOf(client) : { injury: 'off', restrictions: [] },
    port,
  );
  const { draft, bundle: b, check } = api;
  const host = useCoachEditorHost({
    restrictions: sharedRestrictions(
      client ? checkContextOf(client) : { injury: 'off', restrictions: [] },
    ),
  });
  const toEditor = () => onNavigate(programPageRoute(cid, 'edit', from));
  const backChrome = { label: p.ckBack, text: r.roBack, onClick: toEditor };
  const stateChrome = { back: backChrome, title: p.ckTitle };

  if (!client || client.invite) {
    if (world.world || world.error)
      return (
        <Page>
          <PageFrame chrome={stateChrome}>
            <Card>
              <EmptyState
                titleAs="h2"
                icon="user-focus"
                title={p.edNoClientTitle}
                body={p.edNoClientBody}
              >
                <Button variant="primary" onClick={() => onNavigate({ screen: 'clients' })}>
                  {p.edToClients}
                </Button>
              </EmptyState>
            </Card>
          </PageFrame>
        </Page>
      );
    return (
      <Page>
        <PageFrame chrome={stateChrome}>
          <SkeletonRows rows={5} />
        </PageFrame>
      </Page>
    );
  }
  if (!b || !draft || !check) {
    return (
      <Page>
        <PageFrame chrome={stateChrome}>
          {api.error ? (
            <FailedState
              icon="cloud-slash"
              title={p.ckLoadFailedTitle}
              body={p.edLoadFailedBody}
              retryLabel={p.edRetry}
              onRetry={api.retry}
            />
          ) : (
            <SkeletonRows rows={6} label={p.ckTitle} />
          )}
        </PageFrame>
      </Page>
    );
  }

  const first = firstName(client.name);
  const { counts } = check;
  const toFix = counts.fix;
  const sent = api.save.kind === 'sent';
  const sending = api.save.kind === 'sending';
  const errored = api.save.kind === 'error';
  const days = trainingDays(toDoc(draft), { weekOrder: host.weekOrder }).length;
  const injury = checkContextOf(client).injury;
  const hasConflict = check.findings.some((f) => f.kind === 'restriction');
  const level = injury === 'full' ? p.ckLevel.full : p.ckLevel.effects;
  const fixIn = (f: Finding) => {
    requestEditorFocus({ clientId: cid, day: f.fix?.day, itemId: f.fix?.itemId });
    toEditor();
  };
  const firstFix = check.findings.find((f) => f.sev === 'fix');
  const send = () => void api.send();
  const WHY = 'pg-ck-why';

  const actions: PageButton[] = [
    {
      id: 'editor',
      label: p.ckOpenEditor,
      onClick: toEditor,
    },
    {
      id: 'send',
      label: sent ? p.ckSentTo(first) : p.ckSendTo(first),
      shortLabel: sent ? p.ckSentTo(first) : p.ckSendBar,
      variant: toFix > 0 ? 'secondary' : 'primary',
      icon: sent ? 'check' : undefined,
      ariaDisabled: toFix > 0,
      describedBy: toFix > 0 ? WHY : undefined,
      disabled: sent || sending,
      onClick: toFix > 0 ? () => firstFix && fixIn(firstFix) : send,
    },
  ];

  const sendCard = (
    <Card pad="md" emphasis="glass" className="pg-sendcard">
      <SectionLabel>{p.ckSendV(b.draftVersion)}</SectionLabel>
      <div className="pg-sendcard-who">
        <Avatar name={client.name} size={32} />
        <div>
          <b>{client.name}</b>
          <span className="pg-note">{p.ckProgramLine(b.programName, days)}</span>
        </div>
        <Tag tone={toFix > 0 ? 'danger' : 'ok'}>
          {toFix > 0 ? p.ckToFixFirst(toFix) : p.ckReady}
        </Tag>
      </div>
      <p className="pg-note">
        {injury === 'off'
          ? p.ckNoInjury(first)
          : hasConflict
            ? p.ckSharesConflict(first, level)
            : p.ckSharesInjury(first, level)}
      </p>
      <p className="pg-note">{p.ckReceives(first, b.draftVersion)}</p>
      {toFix > 0 && (
        <Button
          variant="primary"
          fullWidth
          icon="pencil-simple"
          onClick={() => firstFix && fixIn(firstFix)}
        >
          {p.ckFixN(toFix)}
        </Button>
      )}
      {toFix > 0 ? (
        <small id={WHY} className="pg-note">
          {p.ckUnlocks(toFix)}
        </small>
      ) : (
        !sent && <small className="pg-note">{p.ckAllFine(b.draftVersion)}</small>
      )}
    </Card>
  );

  const notices = (
    <>
      {errored && (
        <Notice
          tone="danger"
          icon="warning"
          trail={
            <Button variant="secondary" size="sm" onClick={send}>
              {p.edRetry}
            </Button>
          }
        >
          {p.edErrUnavailable}
        </Notice>
      )}
      {sent && (
        <Notice
          tone="ok"
          icon="check-circle"
          trail={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onNavigate(programPageBack(programPageRoute(cid, 'edit', from)))}
            >
              {p.ptOpenEditor}
            </Button>
          }
        >
          {p.edSentTo(first, b.liveVersion)}
        </Notice>
      )}
    </>
  );

  return (
    <Page>
      <PageFrame
        chrome={{
          back: backChrome,
          title: p.ckTitle,
          subject: {
            name: client.name,
            text: p.edSubline(client.name, b.programName, b.draftVersion),
          },
          actions,
          notices,
        }}
        bar={toFix > 0 ? <span>{p.ckToFixFirst(toFix)}</span> : undefined}
      >
        <Split ratio="8-4">
          <div className="pg-main">
            <CheckReport
              check={check}
              doc={toDoc(draft)}
              labels={p}
              words={host.words}
              audience={client.name}
              host={host}
              onFix={fixIn}
            />
          </div>
          {wide ? (
            <Inspector label={p.ckSendV(b.draftVersion)} bare>
              {sendCard}
            </Inspector>
          ) : (
            <div>{sendCard}</div>
          )}
        </Split>
      </PageFrame>
    </Page>
  );
}
