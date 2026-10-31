/**
 * The mail sender wiring (Cloudflare Email Service, REST). Secret: CF_EMAIL_TOKEN (an API token allowed to send email).
 * Params: CF_EMAIL_ACCOUNT_ID, MAIL_FROM (an address on a domain onboarded to Email Sending), MAIL_FROM_NAME.
 * Without them `sendMail` answers `not-configured` and callers carry on (the admin still gets the link and QR).
 */
import { logger } from 'firebase-functions';
import { defineSecret, defineString } from 'firebase-functions/params';
import { sendViaCloudflare, type MailMessage, type MailResult } from './mailCore';

export const CF_EMAIL_TOKEN = defineSecret('CF_EMAIL_TOKEN');
const ACCOUNT_ID = defineString('CF_EMAIL_ACCOUNT_ID', { default: '' });
const FROM = defineString('MAIL_FROM', { default: '' });
const FROM_NAME = defineString('MAIL_FROM_NAME', { default: 'Spotter' });

export async function sendMail(m: MailMessage): Promise<MailResult> {
  let token: string;
  try {
    token = CF_EMAIL_TOKEN.value();
  } catch {
    token = '';
  }
  const cfg = {
    accountId: ACCOUNT_ID.value(),
    token,
    from: FROM.value(),
    fromName: FROM_NAME.value() || 'Spotter',
  };
  const res = await sendViaCloudflare(cfg, m, (url, init) =>
    fetch(url, { ...init, signal: AbortSignal.timeout(8000) }),
  );
  // Outcome only: never the address, the token or the provider's text.
  if (!res.sent) logger.warn('mail not sent', { reason: res.reason });
  return res;
}
