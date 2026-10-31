/**
 * The mail sender wiring: ONE place every Spotter email goes through (invitations, password links, confirmation letters).
 * Provider: Resend (REST). Secret: RESEND_API_KEY. Params: MAIL_FROM (an address on a domain verified in Resend), MAIL_FROM_NAME.
 * Without them `sendMail` answers `not-configured` and callers carry on (the admin still gets the link and QR).
 */
import { logger } from 'firebase-functions';
import { defineSecret, defineString } from 'firebase-functions/params';
import { sendViaResend, type MailMessage, type MailResult } from './mailCore';

export const MAIL_API_KEY = defineSecret('RESEND_API_KEY');
const FROM = defineString('MAIL_FROM', { default: '' });
const FROM_NAME = defineString('MAIL_FROM_NAME', { default: 'Spotter' });

export async function sendMail(m: MailMessage): Promise<MailResult> {
  let apiKey: string;
  try {
    apiKey = MAIL_API_KEY.value();
  } catch {
    apiKey = '';
  }
  const cfg = {
    apiKey,
    from: FROM.value(),
    fromName: FROM_NAME.value() || 'Spotter',
  };
  const res = await sendViaResend(cfg, m, (url, init) =>
    fetch(url, { ...init, signal: AbortSignal.timeout(8000) }),
  );
  // Outcome only: never the address, the token or the provider's text.
  if (!res.sent)
    logger.warn('mail not sent', {
      reason: res.reason,
      status: 'status' in res ? res.status : undefined,
    });
  return res;
}
