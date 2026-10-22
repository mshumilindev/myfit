import './LegalLinks.css';

export interface LegalLinksProps {
  /** Name of the nav landmark ("Legal"). */
  label: string;
  privacyLabel: string;
  termsLabel: string;
  /** Hash route for now (the placeholder until clean paths); the owner wants `/privacy` later, so the app passes it. */
  privacyHref?: string;
  /** Hash route for now, see `privacyHref`. */
  termsHref?: string;
  align?: 'center' | 'start';
}

/** "Privacy Policy · Terms of Use": the quiet link row under forms and in footers. */
export function LegalLinks({
  label,
  privacyLabel,
  termsLabel,
  privacyHref = '#/privacy',
  termsHref = '#/terms',
  align = 'center',
}: LegalLinksProps) {
  return (
    <nav className={`uilk uilk--${align} ut-xs`} aria-label={label}>
      <a href={privacyHref}>{privacyLabel}</a>
      <span aria-hidden>·</span>
      <a href={termsHref}>{termsLabel}</a>
    </nav>
  );
}
