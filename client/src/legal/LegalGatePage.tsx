/**
 * The legal gate as ONE full page (owner decision 22.10, replaces the two drawers and the Atlas / gym-search prompts
 * that followed them), built from kit parts (`FullPage`, `Stepper`, `Checklist`, `DocReader`): step 1 "Terms"
 * (required: every document read to its end, 18+, agreement, plus the Trainer Terms + DPA for a trainer, manager or
 * admin), step 2 "Your choices" (every optional consent, all off, with "Turn on all"). The checklist keeps every item
 * and turns finished ones green. Continue waits until the server has the agreement (`useGateRecorder`) and never asks
 * again. Atlas AI and gym search show what is sent right under their switch and are recorded when the person saves.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { currentUid } from '../api';
import { grantAtlas } from '../atlas/useAtlasAi';
import { Button } from '../components/ui/Button';
import { Checklist } from '../components/ui/Checklist';
import { ConsentRow } from '../components/ui/ConsentRow';
import { DocReader } from '../components/ui/DocReader';
import { AcceptCheck } from '../components/ui/DocReadList';
import { FullPage } from '../components/ui/FullPage';
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { IconTile } from '../components/ui/IconTile';
import { Notice } from '../components/ui/Notice';
import { Stepper } from '../components/ui/Stepper';
import { acceptBoxesEnabled, clearDocRead } from '../components/ui/docReadGate';
import { categoryList, useAtlasConsentT } from '../i18n/atlasConsent';
import { useGeoT } from '../i18n/geoConsent';
import { useGateT, type GateChoiceText } from '../i18n/legalGate';
import { useLegalT } from '../i18n/legal';
import { useLegalTrainerT } from '../i18n/legalTrainer';
import { useT } from '../i18n';
import { useTrainerTermsT } from '../i18n/trainerTerms';
import { agreementDocIds, agreementVersions, useAgreementGate } from './AgreementBlock';
import { renderBlocks } from './docBlocks';
import { clearGateDraft, loadGateDraft, saveGateDraft } from './gateDraft';
import { ATLAS_AI_CATEGORIES, GATE_CHOICES, choiceGrants, type GateChoice } from './gateChoices';
import { useGateRecorder } from './gateRecorder';
import { grantGeoSearch } from './geoGrant';
import { useGateLeave } from './GateLeaveActions';
import type { ConsentKind } from './consents';
import { enqueueConsents, flushPendingConsents } from './signupConsents';
import { TrainerTermsBlock } from './TrainerTermsBlock';
import './LegalGate.css';

type Parts = { base: boolean; trainer: boolean };

export function LegalGatePage({
  parts,
  withChoices,
  preview = false,
  onFinished,
  onSignOut,
}: {
  /** What step 1 asks for (both false = step 2 only). */
  parts: Parts;
  /** Step 2 (optional consents) follows step 1. */
  withChoices: boolean;
  /** Looks only: nothing is recorded (`?gatepreview=1`). */
  preview?: boolean;
  /** Everything is done (or step 2 skipped). */
  onFinished: () => void;
  onSignOut: () => void;
}) {
  const g = useGateT();
  const s = useTrainerTermsT();
  const hasTerms = parts.base || parts.trainer;
  const [step, setStep] = useState<'terms' | 'choices'>(hasTerms ? 'terms' : 'choices');
  const leave = useGateLeave(onSignOut);
  const steps = [
    ...(hasTerms ? [{ id: 'terms', label: g.page.stepTerms }] : []),
    ...(withChoices ? [{ id: 'choices', label: g.page.stepChoices }] : []),
  ];
  const current = Math.max(
    0,
    steps.findIndex((x) => x.id === step),
  );
  const termsDone = () => (withChoices ? setStep('choices') : onFinished());
  const label = step === 'choices' ? g.choicesTitle : parts.base ? g.termsTitle : s.title;
  const top =
    steps.length > 1 ? (
      <Stepper steps={steps} current={current} stepLabel={g.page.step} />
    ) : undefined;
  const common = { label, top, aside: leave.dialogs };
  return step === 'terms' ? (
    <TermsStep
      {...common}
      parts={parts}
      preview={preview}
      onRecorded={termsDone}
      leave={leave.buttons}
    />
  ) : (
    <ChoicesStep
      {...common}
      preview={preview}
      onFinished={onFinished}
      leave={hasTerms ? null : leave.buttons}
    />
  );
}

interface StepShell {
  label: string;
  top: ReactNode;
  aside: ReactNode;
}

function TermsStep({
  parts,
  preview,
  onRecorded,
  leave,
  label,
  top,
  aside,
}: StepShell & {
  parts: Parts;
  preview: boolean;
  onRecorded: () => void;
  leave: ReactNode;
}) {
  const { lg } = useLegalT();
  const trainerDocs = useLegalTrainerT();
  const g = useGateT();
  const p = g.page;
  const s = useTrainerTermsT();
  const { base, trainer } = parts;
  const ids = useMemo(() => agreementDocIds({ base, trainer }), [base, trainer]);
  const versions = useMemo(() => agreementVersions({ base, trainer }), [base, trainer]);
  const gate = useAgreementGate(ids, base, versions);
  // Unsent progress survives a reload (this device only, see gateDraft.ts).
  const uid = currentUid();
  const sig = ids.map((id) => `${id}@${versions[id] ?? ''}`).join('|');
  const [draft] = useState(() => (!preview && uid ? loadGateDraft(uid, sig) : null));
  const applied = useRef(false);
  const { markOpened, setAge, setAgree } = gate;
  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    if (!draft) return;
    draft.opened.filter((id) => ids.includes(id)).forEach(markOpened);
    if (draft.age) setAge(true);
    if (draft.agree) setAgree(true);
  }, [draft, ids, markOpened, setAge, setAgree]);
  useEffect(() => {
    if (preview || !uid) return;
    saveGateDraft(uid, sig, {
      opened: ids.filter((id) => gate.opened[id]),
      age: gate.age,
      agree: gate.agree,
    });
  }, [preview, uid, sig, ids, gate.opened, gate.age, gate.agree]);
  const rec = useGateRecorder(parts, preview, () => {
    if (uid) clearGateDraft(uid);
    clearDocRead(ids, versions);
    onRecorded();
  });
  const busy = rec.state === 'saving' || rec.state === 'waiting';
  const nameOf = (id: string) =>
    id === 'terms'
      ? lg.ui.termsLink
      : id === 'privacy'
        ? lg.ui.privacyLink
        : id === 'trainer-terms'
          ? s.docTrainerTerms
          : s.docDpa;
  const docOf = (id: string) =>
    id === 'trainer-terms'
      ? trainerDocs.trainerTerms
      : id === 'dpa'
        ? trainerDocs.dpa
        : lg[id as 'terms' | 'privacy'];
  const docs = ids.map((id) => ({
    id,
    label: nameOf(id),
    body: (
      <>
        {docOf(id).sections.map((sec) => (
          <section key={sec.id}>
            <h4 className="ut-base ut-w6">{sec.title}</h4>
            {renderBlocks(sec.body)}
          </section>
        ))}
      </>
    ),
  }));
  const boxes = acceptBoxesEnabled(gate.allOpened);
  const items = [
    ...ids.map((id) => ({ id, label: p.leftRead(nameOf(id)), done: gate.opened[id] === true })),
    ...(base ? [{ id: 'age', label: p.leftAge, done: gate.age }] : []),
    { id: 'agree', label: p.leftAgree, done: gate.agree },
  ];
  return (
    <FullPage
      label={label}
      top={top}
      aside={aside}
      actions={
        <div className="uifp-row">
          {boxes && !gate.canContinue && (
            <Button
              variant="secondary"
              size="lg"
              icon="check-circle"
              onClick={() => {
                gate.setAge(true);
                gate.setAgree(true);
              }}
            >
              {p.acceptAll}
            </Button>
          )}
          <Button
            variant="primary"
            size="lg"
            loading={busy}
            disabled={!gate.canContinue || busy}
            onClick={rec.start}
          >
            {rec.state === 'failed' ? p.retry : busy ? p.saving : p.next}
          </Button>
        </div>
      }
    >
      <div className="lgg-head">
        <IconTile tone="accent" size={44} icon="shield-check" />
        <h2 className="lgg-t ut-xl ut-w7">{base ? g.termsTitle : s.title}</h2>
      </div>
      <p className="lgg-lead ut-base ut-muted">{base ? g.termsLead : s.lead}</p>
      {trainer && <TrainerTermsBlock />}
      <DocReader
        docs={docs}
        read={gate.opened}
        onRead={gate.markOpened}
        readLabel={p.readLabel}
        unreadLabel={p.unreadLabel}
      />
      {base && (
        <AcceptCheck checked={gate.age} disabled={!boxes} onChange={gate.setAge}>
          <AgeText />
        </AcceptCheck>
      )}
      <AcceptCheck checked={gate.agree} disabled={!boxes} onChange={gate.setAgree}>
        <AgreeText base={base} trainer={trainer} />
      </AcceptCheck>
      <Checklist title={gate.canContinue ? p.leftDone : p.leftTitle} items={items} />
      {rec.state === 'saving' && (
        <Notice tone="neutral" icon="info">
          {p.saving}
        </Notice>
      )}
      {rec.state === 'waiting' && (
        <Notice tone="neutral" icon="info">
          {p.waiting}
        </Notice>
      )}
      {rec.state === 'failed' && (
        <Notice tone="danger" icon="info">
          {p.failed}
        </Notice>
      )}
      {leave}
    </FullPage>
  );
}

function AgeText() {
  return <>{useT().t.onbAgreeAge}</>;
}
function AgreeText({ base, trainer }: Parts) {
  const { t } = useT();
  const s = useTrainerTermsT();
  return <>{base ? (trainer ? s.agreeAll : t.onbAgreeAccept) : s.agree}</>;
}

function ChoicesStep({
  preview,
  onFinished,
  leave,
  label,
  top,
  aside,
}: StepShell & {
  preview: boolean;
  onFinished: () => void;
  leave: ReactNode;
}) {
  const g = useGateT();
  const p = g.page;
  const atlas = useAtlasConsentT();
  const geo = useGeoT();
  const { locale } = useLegalT();
  const [on, setOn] = useState<ReadonlySet<ConsentKind>>(new Set());
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const toggle = (kind: ConsentKind, v: boolean) =>
    setOn((cur) => {
      const next = new Set(cur);
      if (v) next.add(kind);
      else next.delete(kind);
      return next;
    });
  const allOn = on.size === GATE_CHOICES.length;
  const setAll = (v: boolean) => setOn(v ? new Set(GATE_CHOICES.map((c) => c.kind)) : new Set());
  const textOf = (c: GateChoice): GateChoiceText =>
    c.kind === 'atlas-ai' ? g.atlas : c.kind === 'geo-search' ? g.geo : g.health[c.feature!];
  const facts = (kind: ConsentKind) => {
    if (kind === 'atlas-ai') {
      const list = categoryList(locale, atlas, ATLAS_AI_CATEGORIES);
      return [
        { icon: 'chat-circle', label: atlas.sentLabel, sub: atlas.sent(list) },
        { icon: 'shield-warning', label: atlas.whoLabel, sub: atlas.who },
        { icon: 'first-aid-kit', label: atlas.adviceLabel, sub: atlas.advice },
        { icon: 'lock-simple', label: atlas.staysLabel, sub: atlas.stays },
      ];
    }
    if (kind === 'geo-search')
      return [
        { icon: 'map-pin', label: geo.sentLabel, sub: geo.sent },
        { icon: 'shield-warning', label: geo.whoLabel, sub: geo.who },
        { icon: 'lock-simple', label: geo.withoutLabel, sub: geo.without },
      ];
    return null;
  };
  const rows = (group: GateChoice['group']) =>
    GATE_CHOICES.filter((c) => c.group === group).map((c) => {
      const x = textOf(c);
      const f = on.has(c.kind) ? facts(c.kind) : null;
      return (
        <div key={c.kind} className="lgp-row">
          <ConsentRow
            icon={c.icon}
            tone={c.tone}
            label={x.label}
            sub={x.sub}
            status={g.ifOff(x.hint)}
            on={on.has(c.kind)}
            disabled={busy}
            onChange={(v) => toggle(c.kind, v)}
          />
          {f && (
            <div className="lgp-facts">
              {f.map((r) => (
                <ListRow
                  key={r.label}
                  icon={<IconTile tone="neutral" size={30} icon={r.icon} />}
                  label={r.label}
                  sub={r.sub}
                />
              ))}
            </div>
          )}
        </div>
      );
    });

  async function save() {
    setBusy(true);
    setFailed(false);
    if (preview) {
      await new Promise((r) => setTimeout(r, 600));
      setBusy(false);
      onFinished();
      return;
    }
    const uid = currentUid();
    const grants = choiceGrants(on);
    if (uid && grants.length) enqueueConsents(uid, grants);
    let ok = true;
    if (grants.length) await flushPendingConsents();
    if (on.has('atlas-ai')) ok = (await grantAtlas('gemini')) && ok;
    if (on.has('geo-search')) ok = (await grantGeoSearch()) && ok;
    setBusy(false);
    if (ok) onFinished();
    else setFailed(true);
  }

  return (
    <FullPage
      label={label}
      top={top}
      aside={aside}
      actions={
        <div className="uifp-row">
          <Button variant="secondary" size="lg" disabled={busy} onClick={onFinished}>
            {g.later}
          </Button>
          <Button
            variant="primary"
            size="lg"
            loading={busy}
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? p.choicesSaving : on.size ? g.save : p.finish}
          </Button>
        </div>
      }
    >
      <div className="lgg-head">
        <IconTile tone="accent" size={44} icon="shield-check" />
        <h2 className="lgg-t ut-xl ut-w7">{g.choicesTitle}</h2>
      </div>
      <p className="lgg-lead ut-base ut-muted">{g.choicesLead}</p>
      <div className="lgp-bulk">
        <span className="ut-sm ut-muted">{p.onCount(on.size, GATE_CHOICES.length)}</span>
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => setAll(!allOn)}>
          {allOn ? p.allOff : p.allOn}
        </Button>
      </div>
      <GroupedList surface="raised" header={g.atlasHeader} footer={g.atlasFooter}>
        {rows('atlas')}
      </GroupedList>
      <GroupedList surface="raised" header={g.healthHeader} footer={g.healthFooter}>
        {rows('health')}
      </GroupedList>
      <GroupedList surface="raised" header={g.outsideHeader}>
        {rows('outside')}
      </GroupedList>
      <Notice tone="neutral" icon="info">
        {g.notice} {p.optionalNote}
      </Notice>
      {failed && (
        <Notice tone="danger" icon="info">
          {p.choicesFailed}
        </Notice>
      )}
      {leave}
    </FullPage>
  );
}
