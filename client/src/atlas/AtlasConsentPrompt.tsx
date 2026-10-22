/**
 * The consent shown when the Atlas AI chat (or its Puter backup) is turned on (SPO-286), every time it is turned on.
 * Kit `ConsentPrompt`, all or nothing. "What is sent" is built from `ATLAS_AI_CATEGORIES`, the list `buildChatFacts` is
 * held to (`chatFacts.consent.test.ts`). Dismissing it is "Not now" and records nothing.
 */
import { useState } from 'react';
import { ConsentPrompt } from '../components/ui/ConsentPrompt';
import { LegalLinks } from '../components/ui/LegalLinks';
import { Notice } from '../components/ui/Notice';
import { categoryList, useAtlasConsentT } from '../i18n/atlasConsent';
import { useLegalT } from '../i18n/legal';
import { ATLAS_AI_CATEGORIES } from '../legal/gateChoices';
import { currentVersion } from '../legal/consents';
import type { AiEngine } from './aiConsent';
import { grantAtlas } from './useAtlasAi';

export function AtlasConsentPrompt({
  engine,
  onDone,
}: {
  engine: AiEngine;
  /** `true` = saved and on; `false` = "Not now" or closed, nothing recorded. */
  onDone: (granted: boolean) => void;
}) {
  const x = useAtlasConsentT();
  const { lg, locale } = useLegalT();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const puter = engine === 'puter';
  const list = categoryList(locale, x, ATLAS_AI_CATEGORIES);

  return (
    <ConsentPrompt
      icon="sparkle"
      tone="atlas"
      title={puter ? x.puterTitle : x.title}
      lead={puter ? x.puterLead : x.lead}
      factsLabel={x.factsLabel}
      facts={[
        { icon: 'chat-circle', label: x.sentLabel, sub: x.sent(list) },
        {
          icon: 'shield-warning',
          label: x.whoLabel,
          sub: puter ? x.puterWho : x.who,
          tone: 'injury',
        },
        { icon: 'first-aid-kit', label: x.adviceLabel, sub: x.advice },
        { icon: 'lock-simple', label: x.staysLabel, sub: x.stays },
        { icon: 'arrow-counter-clockwise', label: x.choiceLabel, sub: x.choice },
      ]}
      before={
        failed ? (
          <Notice tone="danger" icon="warning-circle">
            {x.saveFailed}
          </Notice>
        ) : undefined
      }
      primary={puter ? x.puterPrimary : x.primary}
      primaryDisabled={busy}
      secondary={x.secondary}
      closeLabel={x.close}
      foot={
        <>
          <LegalLinks
            label={lg.ui.legalNav}
            privacyLabel={lg.ui.privacyLink}
            termsLabel={lg.ui.termsLink}
          />
          <span className="ut-xs ut-faint">
            {x.version(currentVersion(puter ? 'atlas-puter' : 'atlas-ai'))}
          </span>
        </>
      }
      onPrimary={() => {
        setBusy(true);
        setFailed(false);
        void grantAtlas(engine).then((ok) => {
          setBusy(false);
          if (ok) onDone(true);
          else setFailed(true);
        });
      }}
      onSecondary={() => onDone(false)}
    />
  );
}
