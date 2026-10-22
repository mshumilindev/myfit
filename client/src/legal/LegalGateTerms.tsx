/**
 * Drawer 1 of the legal gate (SPO-295 N12): an existing user accepts what is still missing, in ONE blocking `Sheet`
 * (no close button; scrim and Esc do nothing): the Terms of Use + Privacy Policy + 18+ (`base`), and for a trainer, manager
 * or admin the Trainer Terms + DPA (`trainer`, with their key points). Only what is missing is shown: an existing member
 * who becomes a trainer sees the trainer block alone; a new trainer sees everything at once. One read-gate (every shown
 * document opened first) and one "I agree" box. Leaving without accepting is "Sign out" or "Delete my account" (SPO-285).
 */
import { useMemo } from 'react';
import { useT } from '../i18n';
import { useGateT } from '../i18n/legalGate';
import { useTrainerTermsT } from '../i18n/trainerTerms';
import { Button } from '../components/ui/Button';
import { IconTile } from '../components/ui/IconTile';
import { Notice } from '../components/ui/Notice';
import { Sheet } from '../components/ui/Overlays';
import { clearDocRead } from '../components/ui/docReadGate';
import {
  RegistrationAgreement,
  agreementDocIds,
  agreementVersions,
  useAgreementGate,
  type AgreementParts,
} from './AgreementBlock';
import { openLegalPage, useGateLeave } from './GateLeaveActions';
import { TrainerTermsBlock } from './TrainerTermsBlock';
import './LegalGate.css';

export function LegalGateTerms({
  parts,
  onContinue,
  onSignOut,
  refused = false,
}: {
  /** What is missing: the Terms / Privacy / 18+ part and / or the Trainer Terms + DPA part. */
  parts: Required<AgreementParts>;
  onContinue: () => void;
  onSignOut: () => void;
  /** The last attempt was refused for good by the server: say so (the drawer is shown again). */
  refused?: boolean;
}) {
  const { t } = useT();
  const g = useGateT();
  const s = useTrainerTermsT();
  const { base, trainer } = parts;
  const ids = useMemo(() => agreementDocIds({ base, trainer }), [base, trainer]);
  const versions = useMemo(() => agreementVersions({ base, trainer }), [base, trainer]);
  const gate = useAgreementGate(ids, base, versions);
  const leave = useGateLeave(onSignOut);
  const title = base ? g.termsTitle : s.title;
  const lead = base ? g.termsLead : s.lead;
  return (
    <>
      <Sheet onClose={() => undefined} dismissible={false} padded role="alertdialog" label={title}>
        <div className="lgg">
          <div className="lgg-head">
            <IconTile tone="accent" size={44} icon="shield-check" />
            <h2 className="lgg-t ut-xl ut-w7">{title}</h2>
          </div>
          <p className="lgg-lead ut-base ut-muted">{lead}</p>
          {trainer && <TrainerTermsBlock />}
          <RegistrationAgreement gate={gate} onOpen={openLegalPage} parts={{ base, trainer }} />
          {refused && (
            <Notice tone="danger" icon="info">
              {g.refusedError}
            </Notice>
          )}
          <div className="lgg-acts">
            <Button
              variant="primary"
              size="lg"
              disabled={!gate.canContinue}
              onClick={() => {
                clearDocRead(ids, versions);
                onContinue();
              }}
            >
              {t.onbContinue}
            </Button>
            {leave.buttons}
          </div>
        </div>
      </Sheet>
      {leave.dialogs}
    </>
  );
}
