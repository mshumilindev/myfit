/** Invite letters (SPO-225/invites): text per locale, the Resend request, and every send outcome without a network. */
import { describe, expect, it, vi } from 'vitest';
import {
  MAIL_LOCALES,
  asMailLocale,
  resendRequest,
  inviteMail,
  sendViaResend,
  type MailerConfig,
} from '../../functions/src/mailCore';

const LINK = 'https://spotter-64c3b.web.app/#/join/tok123';
const CFG: MailerConfig = {
  apiKey: 'secret-key',
  from: 'no-reply@example.com',
  fromName: 'Spotter',
};
const MSG = inviteMail('en', 'a@b.co', { kind: 'invite', link: LINK, name: 'Ann', days: 7 });
const ok =
  (body: unknown, status = 200) =>
  async () => ({ ok: status < 300, status, json: async () => body });

describe('inviteMail', () => {
  it.each(MAIL_LOCALES.flatMap((l) => (['invite', 'reset'] as const).map((k) => [l, k] as const)))(
    '%s/%s carries the link in text and html and the expiry',
    (locale, kind) => {
      const m = inviteMail(locale, 'a@b.co', { kind, link: LINK, name: '', days: 7 });
      expect(m.subject.length).toBeGreaterThan(3);
      expect(m.text).toContain(LINK);
      expect(m.html).toContain(`href="${LINK}"`);
      expect(m.text).toContain('7');
    },
  );
  it('escapes a hostile name in html', () => {
    const m = inviteMail('en', 'a@b.co', {
      kind: 'invite',
      link: LINK,
      name: '<script>x</script>',
      days: 7,
    });
    expect(m.html).not.toContain('<script>');
  });
  it('falls back to en for an unknown locale', () => {
    expect(asMailLocale('xx')).toBe('en');
    expect(asMailLocale('uk')).toBe('uk');
  });
});

describe('sendViaResend', () => {
  it('builds the REST request with a named sender and bearer key', () => {
    const { url, init } = resendRequest(CFG, MSG);
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer secret-key');
    const body = JSON.parse(init.body);
    expect(body.from).toBe('Spotter <no-reply@example.com>');
    expect(body.to).toEqual(['a@b.co']);
  });
  it('reports sent only when the provider returns an id', async () => {
    expect(await sendViaResend(CFG, MSG, ok({ id: 'abc' }))).toEqual({ sent: true });
    expect(await sendViaResend(CFG, MSG, ok({}))).toEqual({ sent: false, reason: 'rejected' });
  });
  it('not-configured without config and never calls fetch', async () => {
    const f = vi.fn();
    expect(await sendViaResend(null, MSG, f)).toEqual({ sent: false, reason: 'not-configured' });
    expect(await sendViaResend({ ...CFG, apiKey: '' }, MSG, f)).toEqual({
      sent: false,
      reason: 'not-configured',
    });
    expect(f).not.toHaveBeenCalled();
  });
  it('rejected on http error', async () => {
    expect(await sendViaResend(CFG, MSG, ok({ message: 'x' }, 403))).toEqual({
      sent: false,
      reason: 'rejected',
    });
  });
  it('network on a thrown fetch, without leaking the address', async () => {
    const r = await sendViaResend(CFG, MSG, async () => {
      throw new Error('boom a@b.co');
    });
    expect(r).toEqual({ sent: false, reason: 'network' });
  });
  it('verify letters exist in every locale and carry the link without expiry', () => {
    for (const l of MAIL_LOCALES) {
      const m = inviteMail(l, 'a@b.co', { kind: 'verify', link: LINK, name: '', days: 0 });
      expect(m.text).toContain(LINK);
      expect(m.subject.length).toBeGreaterThan(3);
    }
  });
});
