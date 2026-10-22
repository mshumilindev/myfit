/**
 * Turning the Atlas AI chat (or Puter) off (SPO-286): one step, kit `ConfirmEffectsDialog`, short labels. Sending stops the
 * moment the person confirms; the chat history (device only) is cleared only when they tick the box.
 */
import { useState } from 'react';
import { ConfirmEffectsDialog } from '../components/ui/ConfirmEffectsDialog';
import { useAtlasConsentT } from '../i18n/atlasConsent';
import type { ConsentRecord } from '../legal/consents';
import type { AiEngine } from './aiConsent';
import { clearAtlasConversation } from './clearConversation';
import { withdrawAtlas } from './useAtlasAi';

export function AtlasWithdrawDialog({
  engine,
  onDone,
}: {
  engine: AiEngine;
  /** Not consulted any more (the cached records can be stale: Puter is always withdrawn with Gemini); kept for callers. */
  records?: readonly ConsentRecord[];
  /** `ok` = the withdrawal is recorded; false = it could not be saved (sending is off on this device anyway). */
  onDone: (result: { confirmed: boolean; ok: boolean }) => void;
}) {
  const x = useAtlasConsentT();
  const [clear, setClear] = useState(false);
  const puter = engine === 'puter';
  return (
    <ConfirmEffectsDialog
      icon="sign-out"
      title={puter ? x.puterOffTitle : x.offTitle}
      body={puter ? x.puterOffBody : x.offBody}
      check={puter ? undefined : { label: x.offClear, checked: clear, onChange: setClear }}
      confirmLabel={x.offConfirm}
      cancelLabel={x.offKeep}
      cancelVariant="secondary"
      onCancel={() => onDone({ confirmed: false, ok: true })}
      onConfirm={() => {
        if (clear && !puter) clearAtlasConversation();
        void withdrawAtlas(engine).then((ok) => onDone({ confirmed: true, ok }));
      }}
    />
  );
}
