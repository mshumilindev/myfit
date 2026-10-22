/**
 * The account deletion flow (SPO-285, designs DelAcct1-3): three prompts (what goes, what else changes, type DELETE),
 * then the password step-up, which also performs the deletion on the server. Only after the server confirms does the
 * device leave: sign out with `forget`, which runs the device wipe (`deviceWipe.ts`). Offline or a wrong password: the
 * dialog says so and nothing happens. The first prompt offers "Download a copy first" (the data copy, SPO-295 N6): the host opens it.
 */
import { useMemo, useState } from 'react';
import { signOut } from '../api';
import { ReauthDialog } from '../coach/security/ReauthDialog';
import type { ReauthPort } from '../coach/security/reauth';
import { Button } from '../components/ui/Button';
import { StepConfirmDialog, type StepConfirmStepText } from '../components/ui/StepConfirmDialog';
import { useDeleteT } from '../i18n/accountDelete';
import { useExportT } from '../i18n/myDataExport';
import { createDeleteAccountPort } from './deleteAccount';

export const DELETE_WORD = 'DELETE';
const EFFECT_ICONS = ['barbell', 'heartbeat', 'chat-circle', 'key'];
const EFFECT2_ICONS = ['users', 'sign-out', 'users', 'barbell', 'cloud-slash'];

export interface DeleteAccountFlowProps {
  onCancel: () => void;
  /** Opens the data copy (the host closes this flow and shows it). Absent = the copy is not offered here. */
  onDownloadCopy?: () => void;
  /** tests */
  port?: ReauthPort;
  finish?: () => void | Promise<void>;
}

export function DeleteAccountFlow({
  onCancel,
  onDownloadCopy,
  port,
  finish = () => signOut({ forget: true }),
}: DeleteAccountFlowProps) {
  const d = useDeleteT();
  const x = useExportT();
  const [stage, setStage] = useState<'steps' | 'password'>('steps');
  const reauthPort = useMemo(() => port ?? createDeleteAccountPort(), [port]);
  const steps = useMemo<StepConfirmStepText[]>(
    () => [
      {
        id: 'what',
        icon: 'warning',
        title: d.step1Title,
        body: onDownloadCopy ? (
          <>
            {d.step1Body} {d.step1Copy}{' '}
            <Button variant="link" inline onClick={onDownloadCopy}>
              {x.deleteLink}
            </Button>
          </>
        ) : (
          d.step1Body
        ),
        effects: d.step1Effects.map((text, i) => ({ icon: EFFECT_ICONS[i], text })),
        confirmLabel: d.step1Confirm,
      },
      {
        id: 'changes',
        icon: 'warning',
        title: d.step2Title,
        body: d.step2Body,
        effects: d.step2Effects.map((text, i) => ({ icon: EFFECT2_ICONS[i], text })),
        confirmLabel: d.step2Confirm,
      },
      {
        id: 'type',
        icon: 'trash',
        title: d.step3Title,
        body: d.step3Body,
        confirmLabel: d.step3Confirm,
        typeWord: DELETE_WORD,
        typeLabel: d.step3Type,
      },
    ],
    [d, x, onDownloadCopy],
  );
  if (stage === 'password')
    return (
      <ReauthDialog
        action="delete-account"
        port={reauthPort}
        onCancel={onCancel}
        onDone={() => void finish()}
      />
    );
  return (
    <StepConfirmDialog
      steps={steps}
      cancelLabel={d.keep}
      progressLabel={d.progress}
      onConfirm={() => setStage('password')}
      onCancel={onCancel}
    />
  );
}
