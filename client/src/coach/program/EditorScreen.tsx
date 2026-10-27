import { createContext, useContext, useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { ConfirmEffectsDialog } from '../../components/ui/ConfirmEffectsDialog';
import { FailedState } from '../../components/ui/FailedState';
import { Notice } from '../../components/ui/Notice';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { Snackbar } from '../../components/ui/Snackbar';
import { COACH_BREAKPOINT, useMinWidth } from '../../components/ui/breakpoints';
import { getRole } from '../../api';
import { useT } from '../../i18n';
import { usePgT } from '../../i18n/coachProgram';
import { useRosterT } from '../../i18n/coachRoster';
import {
  diffPrograms,
  EditorPage,
  gateLine,
  PageFrame,
  type EditorScene,
  type PageButton,
} from '../../tools/programEditor';
import { useCoachWorld, type CoachWorldPort } from '../data';
import { Page } from '../layout/Layout';
import type { Dow } from '../domain/types';
import { programPageBack, programPageRoute, type CoachRoute } from '../routes';
import { AssignmentCard } from './editor/AssignmentCard';
import { NoClientPage } from './NoClientPage';
import { useProgramDraft } from './draftStore';
import { consumeEditorFocus } from './focusRequest';
import type { ProgramPort } from './port';
import { firstName } from './parts';
import { checkContextOf } from './ProgramTab';
import { sharedRestrictions } from './check';
import { useCoachEditorHost } from './toolHost';
import { asProgram, toDoc } from './toolHostBase';
import { DOW_OF_ISO, ISO_OF_DOW } from './types';

export interface EditorScreenProps {
  cid: string;
  /** Where the page was opened from: a client's Program tab or the Programs list (Back returns there). */
  from?: 'client' | 'list';
  onNavigate: (r: CoachRoute) => void;
  port?: ProgramPort;
  worldPort?: CoachWorldPort;
  /** Stories / tests: open a scene (a weekday, a selected row, a pane, a dialog). */
  initial?: Omit<EditorScene, 'dialog'> & {
    dialog?: 'switch' | 'gate';
    versionOpen?: boolean;
  };
}

/** Stories and tests open a scene (a weekday, a selected row, a pane, a dialog) through this; the app never provides it. */
export const EditorInitialContext = createContext<EditorScreenProps['initial']>(undefined);

/**
 * S-06..S-10, S-13: the program editor of ONE client. A thin host of the program editor tool: it loads the draft, owns
 * what is about THIS client (assignment card with trainer days and versions, Save, Check, Send and its gate), and hands
 * the program itself to `<ProgramEditor>`.
 */
export function EditorScreen({
  cid,
  from = 'list',
  onNavigate,
  port,
  worldPort,
  initial: initialProp,
}: EditorScreenProps) {
  const fromContext = useContext(EditorInitialContext);
  const initial = initialProp ?? fromContext;
  const { p, locale } = usePgT();
  // Coach is behind the trainer / admin gate already; this keeps the assignment read-only for anyone else.
  const canEdit = getRole() !== 'member';
  const { t } = useT();
  const { r } = useRosterT();
  const wide = useMinWidth(COACH_BREAKPOINT);
  const world = useCoachWorld(worldPort);
  const client = world.world?.rows.find((x) => x.client.id === cid)?.client;
  const ctx = client ? checkContextOf(client) : { injury: 'off' as const, restrictions: [] };
  const api = useProgramDraft(cid, ctx, port);
  const { draft, bundle: b, check } = api;
  const library = useMemo(() => (port ? port.library(cid) : []), [port, cid]);
  const host = useCoachEditorHost({ library, restrictions: sharedRestrictions(ctx) });

  const [dialog, setDialog] = useState<null | 'gate'>(initial?.dialog === 'gate' ? 'gate' : null);
  const [verOpen, setVerOpen] = useState(initial?.versionOpen ?? false);
  const [toast, setToast] = useState<{ text: string; icon?: string } | null>(null);
  const [conflictHidden, setConflictHidden] = useState(false);
  // "Fix in editor" from the check: land on that weekday and row, once, when the editor opens.
  const [focus] = useState(() => consumeEditorFocus(cid));
  // A click on an issue under "Send unlocks when these are fixed" lands on that weekday and row (the draft lives in the
  // store, so re-opening the editor around it loses nothing).
  const [jump, setJump] = useState<{ n: number; day?: number; itemId?: string } | null>(null);

  const route = programPageRoute(cid, 'edit', from);
  const goBack = () => onNavigate(programPageBack(route));
  const backChrome = { label: p.edBack, text: r.roBack, onClick: goBack };
  const stateChrome = { back: backChrome, title: p.edTitle };

  if (!client || client.invite)
    return (
      <NoClientPage
        chrome={stateChrome}
        settled={!!(world.world || world.error)}
        onNavigate={onNavigate}
      />
    );
  if (!b || !draft) {
    return (
      <Page>
        <PageFrame chrome={stateChrome}>
          {api.error ? (
            <FailedState
              icon="cloud-slash"
              title={p.edLoadFailedTitle}
              body={p.edLoadFailedBody}
              retryLabel={p.edRetry}
              onRetry={api.retry}
            />
          ) : (
            <SkeletonRows rows={6} label={p.edTitle} />
          )}
        </PageFrame>
      </Page>
    );
  }

  const first = firstName(client.name);
  const toFix = check?.counts.fix ?? 0;
  const fixes = (check?.findings ?? []).filter((f) => f.sev === 'fix');
  const sending = api.save.kind === 'sending';
  const sent = api.save.kind === 'sent';
  const changes = diffPrograms(toDoc(b.live), toDoc(draft));

  const copyOther = async (clientId: string) => {
    await api.copyTo(clientId);
    const o = b.sharedWith.find((s) => s.clientId === clientId);
    if (o) {
      setToast({ text: p.edCopiedV(b.draftVersion, firstName(o.name)), icon: 'copy' });
      window.setTimeout(() => setToast(null), 4000);
    }
  };

  const onToggleDay = (d: Dow) =>
    api.setTrainerDays(
      api.trainerDays.includes(d)
        ? api.trainerDays.filter((x) => x !== d)
        : DOW_OF_ISO.filter((x) => x === d || api.trainerDays.includes(x)),
    );

  const goCheck = () => onNavigate(programPageRoute(cid, 'check', from));
  const trySend = () => {
    if (toFix > 0) setDialog('gate');
    else void api.send();
  };

  const saveState =
    api.save.kind === 'saving'
      ? p.edSaving
      : api.save.kind === 'sending'
        ? p.edSending
        : api.dirty
          ? p.edUnsaved
          : api.save.kind === 'saved'
            ? p.edSaved
            : '';

  const sendLabel = sent
    ? p.edSentTo(first, b.liveVersion)
    : sending
      ? p.edSending
      : p.edSendTo(first);
  const WHY = 'pe-band-note';

  const actions: PageButton[] = [
    {
      id: 'check',
      label: p.edCheck(toFix),
      shortLabel: p.edCheckShort(toFix),
      variant: toFix > 0 ? 'primary' : 'secondary',
      icon: toFix > 0 ? 'warning' : 'list-checks',
      onClick: goCheck,
    },
    {
      id: 'save',
      label: p.edSaveDraft,
      disabled: !api.dirty || api.save.kind === 'saving',
      onClick: () => void api.saveDraft(),
    },
    {
      id: 'send',
      label: sendLabel,
      shortLabel: p.edSendShort,
      variant: toFix > 0 ? 'secondary' : 'primary',
      icon: sent ? 'check' : undefined,
      ariaDisabled: toFix > 0 || sent || sending,
      describedBy: toFix > 0 ? WHY : undefined,
      disabled: sent || sending,
      onClick: trySend,
    },
  ];

  const err = api.save.kind === 'error' ? api.save.code : null;
  const errText =
    err === 'offline'
      ? p.edErrOffline
      : err === 'vault-locked'
        ? p.edErrLocked
        : err === 'forbidden'
          ? p.edErrForbidden
          : p.edErrUnavailable;

  const notices = (
    <>
      {err && err !== 'conflict' && (
        <Notice
          tone="danger"
          icon="warning"
          trail={
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                void (api.save.kind === 'error' && api.save.during === 'send'
                  ? api.send()
                  : api.saveDraft())
              }
            >
              {p.edRetry}
            </Button>
          }
        >
          {errText}
        </Notice>
      )}
      {err === 'conflict' && !conflictHidden && (
        <Notice
          tone="note"
          icon="share-network"
          trail={
            <>
              <Button variant="secondary" size="sm" onClick={() => api.reload()}>
                {p.edConflictReload}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConflictHidden(true)}>
                {p.edConflictKeep}
              </Button>
            </>
          }
        >
          <b>{p.edConflictTitle}.</b> {p.edConflictBody(first)}
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
              onClick={() => onNavigate({ screen: 'client', cid, tab: 'program' })}
            >
              {r.roBack}
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
      <EditorPage
        key={jump?.n ?? 0}
        chrome={{
          back: backChrome,
          title: p.edTitle,
          subject: {
            name: client.name,
            text: p.edSubline(client.name, b.programName, b.draftVersion),
          },
          state: saveState,
          actions,
          notices,
        }}
        band={{
          label: p.edBandAssignment,
          status: { label: p.ptDraft(b.draftVersion), tone: 'neutral' },
          note:
            toFix > 0
              ? {
                  id: WHY,
                  tone: 'illness',
                  icon: 'warning',
                  text: p.edSendUnlocks,
                  items: fixes.map((f, i) => ({
                    id: `${f.kind}-${i}`,
                    label: gateLine(p, t, f),
                    onClick: () =>
                      f.fix?.day != null || f.fix?.itemId
                        ? setJump({ n: (jump?.n ?? 0) + 1, day: f.fix?.day, itemId: f.fix?.itemId })
                        : goCheck(),
                  })),
                }
              : undefined,
          children: (
            <AssignmentCard
              p={p}
              locale={locale}
              bundle={b}
              draft={draft}
              trainerDays={api.trainerDays}
              clientName={client.name}
              wide={wide}
              changes={changes}
              versionOpen={verOpen}
              onVersionToggle={() => setVerOpen(!verOpen)}
              canEdit={canEdit}
              dirty={api.dirty}
              onToggleDay={onToggleDay}
              onClearStale={(ds) =>
                api.setTrainerDays(api.trainerDays.filter((d) => !ds.includes(d)))
              }
              onSetTimes={() => onNavigate({ screen: 'schedule' })}
              onCopyTo={(id) => void copyOther(id)}
            />
          ),
        }}
        doc={toDoc(draft)}
        onChange={(next) => api.edit(() => asProgram(next))}
        host={host}
        audience={client.name}
        partner={b.trainerName}
        partnerDays={api.trainerDays.map((d) => ISO_OF_DOW[d])}
        focus={jump ? { clientId: cid, day: jump.day, itemId: jump.itemId } : focus}
        initial={
          initial && { ...initial, dialog: initial.dialog === 'switch' ? 'switch' : undefined }
        }
      />

      {dialog === 'gate' && check && (
        <ConfirmEffectsDialog
          icon="warning"
          title={p.edGateTitle(toFix)}
          body={p.edGateBody(first, b.draftVersion)}
          effects={check.findings
            .filter((f) => f.sev === 'fix')
            .map((f) => ({ icon: 'warning', text: gateLine(p, t, f) }))}
          cancelLabel={p.edGateBack}
          cancelVariant="secondary"
          confirmLabel={p.edGateOpen}
          confirmVariant="primary"
          initialFocus="confirm"
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            setDialog(null);
            goCheck();
          }}
        />
      )}

      {toast && <Snackbar position="fixed" icon={toast.icon} text={toast.text} />}
    </Page>
  );
}
