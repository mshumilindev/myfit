import type { ReactNode } from 'react';
import { LegalLinks } from '../components/ui/LegalLinks';
import { SpotterMark } from '../brand/SpotterMark';
import { useLegalT } from '../i18n/legal';
import { LanguageSelector } from '../ui';
import './AuthView.css';

/** The sign-in card frame (logo, language, title, lead, legal links) the forgot-password screens share with `AuthView`. */
export function AuthShell({
  title,
  lead,
  children,
  onSubmit,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
  onSubmit?: () => void;
}) {
  const { lg } = useLegalT();
  return (
    <form
      noValidate
      className="auth-body"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
    >
      <div className="auth-card">
        <div className="auth-lang">
          <LanguageSelector />
        </div>
        <SpotterMark size={88} variant="tight" className="wordmark" />
        <h2 className="auth-title">{title}</h2>
        {lead && <p className="auth-sub">{lead}</p>}
        {children}
        <LegalLinks
          label={lg.ui.legalNav}
          privacyLabel={lg.ui.privacyLink}
          termsLabel={lg.ui.termsLink}
        />
      </div>
      <div className="auth-visual" aria-hidden />
    </form>
  );
}
