import { useEffect, useState } from 'react';
import { BackButton } from '../../components/ui/BackButton';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ChoiceList, type ChoiceOption } from '../../components/ui/ChoiceList';
import { EmptyState } from '../../components/ui/EmptyState';
import { Notice } from '../../components/ui/Notice';
import { Snackbar } from '../../components/ui/Snackbar';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { StepList, type StepItem } from '../../components/ui/StepList';
import { Tag } from '../../components/ui/Tag';
import { Textarea } from '../../components/ui/Textarea';
import { coachDate } from '../format';
import { useTodayT } from '../../i18n/coachToday';
import type { CoachWorldApi } from '../data/useCoachWorld';
import type { DismissReason } from '../domain/decisions';
import type { Category } from '../domain/types';
import { Header, Page, Split } from '../layout/Layout';
import { chatRoute, type CoachRoute } from '../routes';
import { clientOf, findSignal, similarDecisions } from './model';
import { firstName } from './names';
import { optionsOf } from './SignalPreview';
import {
  describeDiffT,
  optionView,
  resultStepText,
  severityTone,
  severityWord,
  signalChart,
  signalText,
} from './signalCopy';
import { DecisionActions } from './decision/DecisionActions';
import { DecisionEvidence } from './decision/DecisionEvidence';
import type { TodayParamsApi } from './useTodayParams';
import { WorldFailed, WorldNotices } from './WorldNotices';
import { OutcomeNote } from './decision/OutcomeNote';

const UNDO_MS = 8000;

/** The Decision screen: choose, see what happens next, record / wait / dismiss; recorded, snoozed, dismissed. */
export function DecisionScreen({
  api,
  params,
  onNavigate,
}: {
  api: CoachWorldApi;
  params: TodayParamsApi;
  onNavigate: (r: CoachRoute) => void;
}) {
  const { t, locale } = useTodayT();
  const world = api.world;
  const found = world && params.decision ? findSignal(world, params.decision) : undefined;
  const [choice, setChoice] = useState<string | null>(null);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [reason, setReason] = useState<DismissReason | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  /** Id of the decision just recorded: Undo is offered for UNDO_MS, then the toast goes. */
  const [undoId, setUndoId] = useState<string | null>(null);
  useEffect(() => {
    if (!undoId) return;
    const timer = window.setTimeout(() => setUndoId(null), UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [undoId]);

  const back = () => params.set({ decision: null, option: null, open: null });
  const signal = found?.signal;
  const client = world && signal ? clientOf(world, signal.clientId) : undefined;
  const opts = signal ? optionsOf(signal) : null;

  if (!world) {
    return (
      <Page className="td">
        <div>
          <BackButton label={t.backLabel} text={t.backLabel} onClick={back} />
        </div>
        {api.status === 'error' || api.status === 'offline' ? (
          <WorldFailed api={api} />
        ) : (
          <Header title="…" subtitle={t.queueLoading} />
        )}
      </Page>
    );
  }
  if (!found || !signal || !client || !opts) {
    return (
      <Page className="td">
        <div>
          <BackButton label={t.backLabel} text={t.backLabel} onClick={back} />
        </div>
        <Card pad="lg">
          <EmptyState
            titleAs="h2"
            icon="check-circle"
            title={t.notFoundTitle}
            body={t.notFoundBody}
          >
            <Button variant="secondary" onClick={back}>
              {t.backToAgenda}
            </Button>
          </EmptyState>
        </Card>
      </Page>
    );
  }

  const name = firstName(client.name);
  const text = signalText(t, signal);
  const rec = found.decisionId ? world.decisions.find((d) => d.id === found.decisionId) : undefined;
  const stateRec = world.decisions.find((d) => d.signal.key === signal.key && d.kind !== 'program');
  const state = found.state;
  const decided = state === 'decided';
  const chosenId = decided
    ? (rec?.optionId ?? null)
    : (choice ?? params.option ?? opts.suggested?.id ?? null);
  const chosen = opts.program.find((o) => o.id === chosenId) ?? null;
  const noChat = client.mode === 'program';
  const defaultDraft = noChat ? '' : t.opMessageDraft(name, signal.kind);
  const message = draft ?? defaultDraft;
  const shownMessage = decided ? (rec?.message ?? '') : message;

  const choices: ChoiceOption[] = opts.program.map((o) => {
    const v = optionView(t, o);
    return {
      id: o.id,
      title: v.title,
      description: v.description,
      tag: decided
        ? o.id === chosenId
          ? t.decChosen
          : undefined
        : v.suggested
          ? t.decSuggested
          : undefined,
    };
  });

  const until = (ts: number) => coachDate(ts, locale);
  const steps: StepItem[] = [];
  if (chosen?.diff || (decided && rec?.diff)) {
    const ops = (decided ? rec?.diff?.ops : chosen?.diff?.ops) ?? [];
    steps.push({
      id: 'program',
      icon: 'barbell',
      title: t.nextProgram,
      body: describeDiffT(t, ops),
    });
    const rs = resultStepText(t, signal);
    if (rs) steps.push({ id: 'result', icon: 'timer', title: t.nextResult, body: rs });
    steps.push({ id: 'sees', icon: 'eye', title: t.nextSees(name), body: t.nextSeesBody });
    if (noChat) {
      steps.push({
        id: 'msg',
        icon: 'envelope',
        title: t.nextMessage(name),
        body: t.nextNoChat(name),
      });
    } else if (decided) {
      if (shownMessage)
        steps.push({
          id: 'msg',
          icon: 'envelope',
          title: t.nextMessageSent(name),
          body: `“${shownMessage}”`,
        });
    } else {
      steps.push({
        id: 'msg',
        icon: 'envelope',
        title: t.nextMessage(name),
        body: editing ? (
          <div className="td-edit">
            <Textarea
              label={t.messageField(name)}
              value={message}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
            />
            <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
              {t.nextMessageDone}
            </Button>
          </div>
        ) : (
          <>
            <span>“{message}”</span>
            <div className="td-msg-note">
              {t.nextMessageNote}{' '}
              <Button variant="link" size="sm" onClick={() => setEditing(true)}>
                {t.nextMessageEdit}
              </Button>
            </div>
          </>
        ),
      });
    }
  }

  const record = () => {
    if (!chosen) return;
    setUndoId(api.recordDecision(signal, chosen, noChat ? '' : message));
  };

  const chart = signalChart(t, signal, world.now, locale, 'sessions');
  const similar = similarDecisions(world.decisions, signal.kind);
  const sharedList = Object.entries(client.consent)
    .filter(([, lvl]) => lvl !== 'off')
    .map(([cat]) => t.cat[cat as Category]);

  return (
    <Page className="td td-dec">
      <WorldNotices api={api} />
      <div>
        <BackButton label={t.backLabel} text={t.backLabel} onClick={back} />
      </div>
      <Header
        title={client.name}
        subtitle={t.programWeek(client.program, client.programWeek)}
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon="envelope"
            onClick={() => onNavigate(chatRoute(client.id))}
          >
            {t.messageTo(name)}
          </Button>
        }
      />
      <Split ratio="8-4">
        <div className="td-main">
          <Card as="section" pad="lg" aria-labelledby="td-dec-title" className="td-what">
            <ul className="td-tags">
              <li>
                <Tag tone={severityTone(signal.severity)}>{severityWord(t, signal.severity)}</Tag>
              </li>
              <li>
                <Tag tone="neutral">{t.confidence(signal.confidence)}</Tag>
              </li>
            </ul>
            <h2 className="td-dec-title" id="td-dec-title">
              {text.title}
            </h2>
            <p className="td-dec-body">{text.body}</p>
          </Card>

          {state === 'open' || decided ? (
            <section className="td-sec" aria-labelledby="td-h-choose">
              <SectionLabel role="heading" aria-level={2} id="td-h-choose">
                {t.decChoose}
              </SectionLabel>
              {choices.length ? (
                <ChoiceList
                  options={choices}
                  value={chosenId}
                  onChange={setChoice}
                  label={t.decOptionsLabel}
                  locked={decided}
                />
              ) : (
                <Notice tone="neutral" icon="info">
                  <strong>{t.noOptionsTitle}.</strong> {t.noOptionsBody}
                </Notice>
              )}
            </section>
          ) : null}

          {steps.length > 0 && (state === 'open' || decided) && (
            <section className="td-sec" aria-labelledby="td-h-next">
              <SectionLabel role="heading" aria-level={2} id="td-h-next">
                {t.decNext}
              </SectionLabel>
              <StepList items={steps} label={t.decNext} />
            </section>
          )}

          {decided && (
            <OutcomeNote
              tone="ok"
              icon="check-circle"
              ariaLabel={t.recordedAria}
              head={t.recordedTitle(
                chosenId ? (choices.find((c) => c.id === chosenId)?.title ?? '') : '',
                shownMessage ? name : null,
              )}
              sub={t.recordedSub(
                rec?.windowEndsAt != null
                  ? Math.round((rec.windowEndsAt - rec.decidedAt) / 86_400_000)
                  : null,
                rec?.windowEndsAt != null ? until(rec.windowEndsAt) : null,
              )}
              action={t.backToAgenda}
              onAction={back}
            />
          )}

          {decided && undoId && rec?.id === undoId && (
            <Snackbar
              position="inline"
              text={t.undoText}
              action={{
                label: t.undoLabel,
                ariaLabel: t.undoAria,
                onClick: () => {
                  api.undoDecision(undoId);
                  setUndoId(null);
                },
              }}
            />
          )}

          {state === 'snoozed' && (
            <OutcomeNote
              icon="clock-counter-clockwise"
              head={t.snoozedTitle}
              sub={t.snoozedBody(
                stateRec?.windowEndsAt != null ? until(stateRec.windowEndsAt) : '',
              )}
              action={t.backToAgenda}
              onAction={back}
            />
          )}

          {state === 'dismissed' && (
            <OutcomeNote
              icon="check-circle"
              head={t.dismissedTitle}
              sub={`${t.dismissedBody}${stateRec?.reason === 'wrong-data' ? ` ${t.dismissedWrongData}` : ''}`}
              action={t.backToAgenda}
              onAction={back}
            />
          )}

          {state === 'open' && (
            <DecisionActions
              t={t}
              api={api}
              signal={signal}
              chosen={chosen}
              record={record}
              dismissOpen={dismissOpen}
              setDismissOpen={setDismissOpen}
              reason={reason}
              setReason={setReason}
            />
          )}
        </div>

        <DecisionEvidence
          t={t}
          signal={signal}
          client={client}
          name={name}
          chart={chart}
          line={text.line}
          similar={similar}
          sharedList={sharedList}
          onNavigate={onNavigate}
        />
      </Split>
    </Page>
  );
}
