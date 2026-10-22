/** Public legal pages (SPO-295 N2): the Privacy Policy and the Terms of Use, plus the DRAFT Trainer Terms and DPA (SPO-289). Reachable without signing in. */
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
  return (
    <LegalDoc
      title={doc.title}
      versionLabel={lg.ui.version(version)}
      updatedLabel={lg.ui.updated(fmtVersionDate(version, locale))}
      sections={doc.sections.map((s) => ({ id: s.id, title: s.title, body: renderBlocks(s.body) }))}
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
