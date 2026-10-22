/**
 * "Before you continue" (SPO-295 N3, reused by the existing-user gate N12): the documents to open, then the 18+ and
 * agree boxes. Presentational: the caller owns the state (`useAgreementGate`) and the Continue / Accept button, which
 * stays disabled until `gate.canContinue`. Built only from kit pieces (DocReadList, AcceptCheck).
 */
import { useState } from 'react';
import { useT } from '../i18n';
import { useLegalT } from '../i18n/legal';
import { useTrainerTermsT } from '../i18n/trainerTerms';
import { AcceptCheck, DocReadList, type ReadDoc } from '../components/ui/DocReadList';
import {
  acceptBoxesEnabled,
  canAccept,
  useDocReadGate,
  type DocVersions,
} from '../components/ui/docReadGate';
import { currentVersion } from './consents';
import { TRAINER_DOC_IDS, TRAINER_VERSIONS } from './trainerTerms';
import './AgreementBlock.css';

/**
 * Which documents one agreement asks for: the Terms of Use + Privacy Policy (with the 18+ box) and / or, for a trainer,
 * manager or admin, the Trainer Terms + DPA. Default (nothing given) is the registration set: base only.
 */
export interface AgreementParts {
  base?: boolean;
  trainer?: boolean;
}

/** Ids of the documents to open, in the order they are listed. */
export function agreementDocIds(parts: AgreementParts = {}): string[] {
  const { base = true, trainer = false } = parts;
  return [...(base ? ['terms', 'privacy'] : []), ...(trainer ? TRAINER_DOC_IDS : [])];
}

/** The version of each of those documents (the key of the per-tab "opened" memory). */
export function agreementVersions(parts: AgreementParts = {}): Record<string, string> {
  const { base = true, trainer = false } = parts;
  return {
    ...(base ? { terms: currentVersion('terms'), privacy: currentVersion('policy-ack') } : {}),
    ...(trainer ? TRAINER_VERSIONS : {}),
  };
}

export interface AgreementStrings {
  header: string;
  lockedHint: string;
  notOpenedLabel: string;
  readLabel: string;
  /** Left out when age was already confirmed (a policy update): no 18+ box. */
  ageLabel?: string;
  agreeLabel: string;
}

export interface AgreementGate {
  opened: Readonly<Record<string, boolean>>;
  allOpened: boolean;
  markOpened: (id: string) => void;
  age: boolean;
  setAge: (v: boolean) => void;
  agree: boolean;
  setAgree: (v: boolean) => void;
  /** Every document opened AND both boxes ticked (the kit's `canAccept`). */
  canContinue: boolean;
}

/** `versions` (document id -> version) keeps the "opened" marks across a remount in this tab (see `useDocReadGate`). */
export function useAgreementGate(
  docIds: readonly string[],
  withAge = true,
  versions?: DocVersions,
): AgreementGate {
  const { opened, markOpened, allOpened } = useDocReadGate(docIds, versions);
  const [age, setAge] = useState(false);
  const [agree, setAgree] = useState(false);
  // The set of documents changed (a role promotion, a part dropped): earlier ticks were for other text, so start over.
  const setKey = `${withAge ? 'a' : '-'}:${docIds.join('|')}`;
  const [seenKey, setSeenKey] = useState(setKey);
  if (seenKey !== setKey) {
    setSeenKey(setKey);
    setAge(false);
    setAgree(false);
  }
  return {
    opened,
    allOpened,
    markOpened,
    age,
    setAge,
    agree,
    setAgree,
    canContinue: canAccept(allOpened, withAge ? [age, agree] : [agree]),
  };
}

export function AgreementBlock({
  docs,
  gate,
  onOpen,
  strings,
}: {
  docs: readonly ReadDoc[];
  gate: AgreementGate;
  /** Shows the document (a new tab / window); the block marks it opened. */
  onOpen: (id: string) => void;
  strings: AgreementStrings;
}) {
  const enabled = acceptBoxesEnabled(gate.allOpened);
  return (
    <div className="lgag">
      <DocReadList
        docs={docs}
        opened={gate.opened}
        onOpen={(id) => {
          onOpen(id);
          gate.markOpened(id);
        }}
        header={strings.header}
        lockedHint={strings.lockedHint}
        notOpenedLabel={strings.notOpenedLabel}
        readLabel={strings.readLabel}
      />
      {strings.ageLabel != null && (
        <AcceptCheck checked={gate.age} disabled={!enabled} onChange={gate.setAge}>
          {strings.ageLabel}
        </AcceptCheck>
      )}
      <AcceptCheck checked={gate.agree} disabled={!enabled} onChange={gate.setAgree}>
        {strings.agreeLabel}
      </AcceptCheck>
    </div>
  );
}

/**
 * The agreement wording (document rows, 18+ box when the base documents are asked, ONE agree box) in the app language.
 * `parts` default = the registration wording (Terms of Use + Privacy Policy); `trainer` adds the Trainer Terms + DPA
 * rows (and a combined agree sentence), `base: false` asks for the trainer documents alone.
 */
export function RegistrationAgreement({
  gate,
  onOpen,
  parts = {},
}: {
  gate: AgreementGate;
  onOpen: (id: string) => void;
  parts?: AgreementParts;
}) {
  const { t } = useT();
  const { lg } = useLegalT();
  const s = useTrainerTermsT();
  const { base = true, trainer = false } = parts;
  const docs = [
    ...(base
      ? [
          { id: 'terms', label: lg.ui.termsLink },
          { id: 'privacy', label: lg.ui.privacyLink },
        ]
      : []),
    ...(trainer
      ? [
          { id: 'trainer-terms', label: s.docTrainerTerms },
          { id: 'dpa', label: s.docDpa },
        ]
      : []),
  ];
  return (
    <AgreementBlock
      docs={docs}
      gate={gate}
      onOpen={onOpen}
      strings={{
        header: t.onbAgreeHeader,
        lockedHint: t.onbAgreeLocked,
        notOpenedLabel: t.onbAgreeNotOpened,
        readLabel: t.onbAgreeRead,
        ...(base && { ageLabel: t.onbAgreeAge }),
        agreeLabel: base ? (trainer ? s.agreeAll : t.onbAgreeAccept) : s.agree,
      }}
    />
  );
}
