/** Public legal pages (SPO-295 N2): the Privacy Policy and the Terms of Use, plus the DRAFT Trainer Terms and DPA (SPO-289). Reachable without signing in. */
import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Hint } from '../components/ui/Hint';
import { currentUid } from '../api';
import { addonsPref, useAddonAvailable } from '../addons/enabledSet';
import { scopeHidesAnything, scopeSections } from '../legal/docScope';
import { SpotterMark } from '../brand/SpotterMark';
import { LegalDoc } from '../components/ui/LegalDoc';
import { LegalLinks } from '../components/ui/LegalLinks';
import { useLegalT } from '../i18n/legal';
import { useLegalTrainerT } from '../i18n/legalTrainer';
import { LanguageSelector } from '../ui';
import { renderBlocks } from '../legal/docBlocks';
import { docVersion, fmtVersionDate } from '../legal/docVersion';
import { isLegalPopup, legalBackAction, performLegalBack, type LegalPageId } from '../legal/route';
import { useT } from '../i18n';

export function LegalPage({ page, fromApp = false }: { page: LegalPageId; fromApp?: boolean }) {
  const { lg, locale, fallback } = useLegalT();
  const { t } = useT();
  const action = legalBackAction({ popup: isLegalPopup(), fromApp });
  const trainer = useLegalTrainerT();
  const isTrainerDoc = page === 'trainer-terms' || page === 'dpa';
  const doc = isTrainerDoc ? (page === 'dpa' ? trainer.dpa : trainer.trainerTerms) : lg[page];
  const version = docVersion(page);
  // The lens: opened from the app, the document shows what applies to the installed add-ons (SPO-571 P5). The public page,
  // the gate and every consent hash use the full text; a list that has never been loaded, or no signed-in person, narrows nothing.
  const available = useAddonAvailable();
  const [full, setFull] = useState(false);
  // A signed-in person only: the add-on list is a device cache that outlives a sign-out; a visitor sees the full text.
  const scoped =
    (fromApp || isLegalPopup()) &&
    !isTrainerDoc &&
    !!currentUid() &&
    addonsPref.snapshot().updatedAt > 0;
  const narrowed =
    scoped && scopeHidesAnything(page as 'privacy' | 'terms', doc.sections, available);
  const shown =
    narrowed && !full
      ? scopeSections(page as 'privacy' | 'terms', doc.sections, available)
      : doc.sections.map((s, i) => ({ num: i + 1, section: s }));
  return (
    <LegalDoc
      title={doc.title}
      versionLabel={lg.ui.version(version)}
      updatedLabel={lg.ui.updated(fmtVersionDate(version, locale))}
      sections={shown.map(({ num, section: s }) => ({
        id: s.id,
        num,
        title: s.title,
        body: renderBlocks(s.body),
      }))}
      lens={
        narrowed ? (
          <>
            {full ? null : <Hint>{lg.ui.scopeNote}</Hint>}
            <Button variant="ghost" size="sm" onClick={() => setFull(!full)}>
              {full ? lg.ui.scopeMine : lg.ui.scopeAll}
            </Button>
          </>
        ) : undefined
      }
      brand={
        <>
          <SpotterMark size={32} variant="tight" />
          <span className="app-brand-word">spotter</span>
        </>
      }
      brandLabel={lg.ui.brandLabel}
      backLabel={action === 'close' ? t.close : t.backAction}
      onBack={() => performLegalBack(action)}
      headerEnd={<LanguageSelector compact />}
      contentsLabel={lg.ui.contents}
      saveLabel={lg.ui.save}
      printLabel={lg.ui.print}
      saveHint={lg.ui.saveHint}
      onPrint={() => window.print()}
      note={
        isTrainerDoc
          ? fallback
            ? `${trainer.draftNote} ${lg.ui.englishOnlyNote}`
            : trainer.draftNote
          : fallback
            ? lg.ui.englishOnlyNote
            : undefined
      }
      footer={
        <LegalLinks
          label={lg.ui.legalNav}
          privacyLabel={lg.ui.privacyLink}
          termsLabel={lg.ui.termsLink}
        />
      }
    />
  );
}
