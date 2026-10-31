/** Invite letters (SPO-225/invites): text per locale, the Cloudflare request, and every send outcome without a network. */
import { describe, expect, it, vi } from 'vitest';
import {
  MAIL_LOCALES,
  asMailLocale,
  cloudflareRequest,
  inviteMail,
  sendViaCloudflare,
  type MailerConfig,
} from '../../functions/src/mailCore';

const LINK = 'https://spotter-64c3b.web.app/#/join/tok123';
const CFG: MailerConfig = {
  accountId: 'acc',
  token: 'secret-token',
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

describe('sendViaCloudflare', () => {
  it('builds the REST request with address/name sender and bearer token', () => {
    const { url, init } = cloudflareRequest(CFG, MSG);
    expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/acc/email/sending/send');
    expect(init.headers.Authorization).toBe('Bearer secret-token');
    expect(JSON.parse(init.body).from).toEqual({
      address: 'no-reply@example.com',
      name: 'Spotter',
    });
  });
  it('reports sent on success', async () => {
    expect(
      await sendViaCloudflare(CFG, MSG, ok({ success: true, result: { delivered: ['a@b.co'] } })),
    ).toEqual({ sent: true });
  });
  it('not-configured without config and never calls fetch', async () => {
    const f = vi.fn();
    expect(await sendViaCloudflare(null, MSG, f)).toEqual({
      sent: false,
      reason: 'not-configured',
    });
    expect(await sendViaCloudflare({ ...CFG, token: '' }, MSG, f)).toEqual({
      sent: false,
      reason: 'not-configured',
    });
    expect(f).not.toHaveBeenCalled();
  });
  it('rejected on http error, success:false and permanent bounce', async () => {
    expect((await sendViaCloudflare(CFG, MSG, ok({ success: false }, 400))).sent).toBe(false);
    expect(await sendViaCloudflare(CFG, MSG, ok({ success: false }))).toEqual({
      sent: false,
      reason: 'rejected',
    });
    expect(
      await sendViaCloudflare(
        CFG,
        MSG,
        ok({ success: true, result: { permanent_bounces: ['a@b.co'] } }),
      ),
    ).toEqual({ sent: false, reason: 'rejected' });
  });
  it('network on a thrown fetch, without leaking the address', async () => {
    const r = await sendViaCloudflare(CFG, MSG, async () => {
      throw new Error('boom a@b.co');
    });
    expect(r).toEqual({ sent: false, reason: 'network' });
  });
});
