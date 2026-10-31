/**
 * Transactional mail (SPO-225/invites): the pure parts. Message text per locale, the Cloudflare Email Service request,
 * and a sender that takes `fetch` so tests never touch the network. Wiring, secrets and params live in `mailer.ts`.
 * No address is ever logged here; callers log only the outcome.
 */

export const MAIL_LOCALES = ['en', 'uk', 'pl', 'lt', 'et'] as const;
export type MailLocale = (typeof MAIL_LOCALES)[number];
export const asMailLocale = (v: unknown): MailLocale =>
  (MAIL_LOCALES as readonly string[]).includes(v as string) ? (v as MailLocale) : 'en';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export type InviteKind = 'invite' | 'reset';

export interface InviteMailInput {
  kind: InviteKind;
  /** The sign-up link (`<origin>/#/join/<token>`). */
  link: string;
  /** The person's name when the admin gave one. */
  name: string;
  /** Days the link works. */
  days: number;
}

interface Words {
  subject: Record<InviteKind, string>;
  hello: (name: string) => string;
  lead: Record<InviteKind, string>;
  button: Record<InviteKind, string>;
  expires: (days: number) => string;
  fallback: string;
  qr: string;
  ignore: string;
  foot: string;
}

const WORDS: Record<MailLocale, Words> = {
  en: {
    subject: { invite: 'You are invited to Spotter', reset: 'Set a new password for Spotter' },
    hello: (n) => (n ? `Hi ${n},` : 'Hi,'),
    lead: {
      invite: 'You have been invited to Spotter. Create your account with the button below.',
      reset: 'An administrator sent you a link to set a new password for your Spotter account.',
    },
    button: { invite: 'Create my account', reset: 'Set a new password' },
    expires: (d) => `The link works once and expires in ${d} days.`,
    fallback: 'Button not working? Open this link:',
    qr: 'You can also open the same link on your phone by scanning the QR code your administrator shows you.',
    ignore:
      'If you did not expect this message, ignore it. Nothing happens until you open the link.',
    foot: 'Spotter · sent because an administrator entered this address.',
  },
  uk: {
    subject: { invite: 'Вас запрошено до Spotter', reset: 'Новий пароль для Spotter' },
    hello: (n) => (n ? `Привіт, ${n}!` : 'Привіт!'),
    lead: {
      invite: 'Вас запросили до Spotter. Створіть акаунт кнопкою нижче.',
      reset: 'Адміністратор надіслав вам посилання, щоб задати новий пароль до акаунта Spotter.',
    },
    button: { invite: 'Створити акаунт', reset: 'Задати новий пароль' },
    expires: (d) => `Посилання працює один раз і діє ${d} дн.`,
    fallback: 'Кнопка не працює? Відкрийте посилання:',
    qr: 'Те саме посилання можна відкрити на телефоні, відсканувавши QR-код, який покаже адміністратор.',
    ignore:
      'Якщо ви не чекали цього листа, просто проігноруйте його. Доки ви не відкриєте посилання, нічого не станеться.',
    foot: 'Spotter · лист надіслано, бо адміністратор вказав цю адресу.',
  },
  pl: {
    subject: { invite: 'Zaproszenie do Spotter', reset: 'Nowe hasło do Spotter' },
    hello: (n) => (n ? `Cześć ${n},` : 'Cześć,'),
    lead: {
      invite: 'Zaproszono Cię do Spotter. Załóż konto przyciskiem poniżej.',
      reset: 'Administrator przesłał Ci link do ustawienia nowego hasła do konta Spotter.',
    },
    button: { invite: 'Załóż konto', reset: 'Ustaw nowe hasło' },
    expires: (d) => `Link działa jednorazowo i wygasa po ${d} dniach.`,
    fallback: 'Przycisk nie działa? Otwórz ten link:',
    qr: 'Ten sam link możesz otworzyć na telefonie, skanując kod QR, który pokaże administrator.',
    ignore:
      'Jeśli nie spodziewałeś(-aś) się tej wiadomości, zignoruj ją. Dopóki nie otworzysz linku, nic się nie stanie.',
    foot: 'Spotter · wiadomość wysłano, bo administrator podał ten adres.',
  },
  lt: {
    subject: { invite: 'Kvietimas į Spotter', reset: 'Naujas Spotter slaptažodis' },
    hello: (n) => (n ? `Sveiki, ${n},` : 'Sveiki,'),
    lead: {
      invite: 'Jus pakvietė į Spotter. Susikurkite paskyrą paspaudę mygtuką.',
      reset: 'Administratorius atsiuntė nuorodą naujam Spotter paskyros slaptažodžiui nustatyti.',
    },
    button: { invite: 'Sukurti paskyrą', reset: 'Nustatyti naują slaptažodį' },
    expires: (d) => `Nuoroda veikia vieną kartą ir galioja ${d} d.`,
    fallback: 'Mygtukas neveikia? Atidarykite šią nuorodą:',
    qr: 'Tą pačią nuorodą galite atidaryti telefone nuskaitę QR kodą, kurį parodys administratorius.',
    ignore: 'Jei šio laiško nelaukėte, ignoruokite jį. Kol neatidarysite nuorodos, nieko nevyks.',
    foot: 'Spotter · laiškas išsiųstas, nes administratorius nurodė šį adresą.',
  },
  et: {
    subject: { invite: 'Kutse Spotterisse', reset: 'Uus parool Spotterisse' },
    hello: (n) => (n ? `Tere, ${n}!` : 'Tere!'),
    lead: {
      invite: 'Sind kutsuti Spotterisse. Loo konto allolevast nupust.',
      reset: 'Administraator saatis sulle lingi, et määrata Spotteri kontole uus parool.',
    },
    button: { invite: 'Loo konto', reset: 'Määra uus parool' },
    expires: (d) => `Link töötab ühe korra ja kehtib ${d} päeva.`,
    fallback: 'Nupp ei tööta? Ava see link:',
    qr: 'Sama lingi saad avada telefonis, skannides QR-koodi, mille administraator sulle näitab.',
    ignore: 'Kui sa seda kirja ei oodanud, ignoreeri seda. Enne lingi avamist ei juhtu midagi.',
    foot: 'Spotter · kiri saadeti, sest administraator sisestas selle aadressi.',
  },
};

const esc = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/** The invite / set-password letter in one locale: subject, plain text and HTML (the same facts in both). */
export function inviteMail(locale: MailLocale, to: string, i: InviteMailInput): MailMessage {
  const w = WORDS[locale];
  const text = [
    w.hello(i.name),
    '',
    w.lead[i.kind],
    '',
    `${w.button[i.kind]}: ${i.link}`,
    '',
    w.expires(i.days),
    w.qr,
    '',
    w.ignore,
    '',
    w.foot,
  ].join('\n');
  const link = esc(i.link);
  const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"></head><body style="margin:0;background:#0b0c0e;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e9e9ea"><div style="max-width:560px;margin:0 auto;padding:32px 16px"><div style="background:#16171a;border:1px solid #2a2c31;border-radius:16px;padding:32px 28px"><h1 style="font-size:22px;line-height:1.3;margin:0 0 12px;color:#fff">${esc(w.subject[i.kind])}</h1><p style="font-size:15px;line-height:1.55;margin:0 0 8px;color:#b8bac0">${esc(w.hello(i.name))}</p><p style="font-size:15px;line-height:1.55;margin:0 0 16px;color:#b8bac0">${esc(w.lead[i.kind])}</p><a href="${link}" style="display:inline-block;background:#d9a24f;color:#1a1204;font-weight:700;font-size:15px;text-decoration:none;padding:13px 26px;border-radius:999px;margin:8px 0 20px">${esc(w.button[i.kind])}</a><p style="font-size:13px;line-height:1.5;margin:0 0 12px;color:#b8bac0">${esc(w.expires(i.days))} ${esc(w.qr)}</p><p style="font-size:12px;line-height:1.5;margin:0 0 16px;color:#8b8e96;word-break:break-all">${esc(w.fallback)}<br>${link}</p><p style="font-size:13px;line-height:1.5;margin:0;color:#b8bac0;border-left:3px solid #d9a24f;padding-left:12px">${esc(w.ignore)}</p></div><p style="font-size:12px;color:#7d8088;margin:20px 8px 0;line-height:1.5;text-align:center">${esc(w.foot)}</p></div></body></html>`;
  return { to, subject: w.subject[i.kind], text, html };
}

export interface MailerConfig {
  accountId: string;
  token: string;
  from: string;
  fromName: string;
}

export type MailResult =
  | { sent: true }
  | { sent: false; reason: 'not-configured' | 'not-verified' | 'rejected' | 'network' };

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** The Cloudflare Email Sending request for one message (REST: `from` takes `address`/`name`). */
export function cloudflareRequest(cfg: MailerConfig, m: MailMessage) {
  return {
    url: `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cfg.accountId)}/email/sending/send`,
    init: {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: { address: cfg.from, name: cfg.fromName },
        to: m.to,
        subject: m.subject,
        html: m.html,
        text: m.text,
      }),
    },
  };
}

/** Sends one message. Never throws and never returns the address or the provider's text: the outcome only. */
export async function sendViaCloudflare(
  cfg: MailerConfig | null,
  m: MailMessage,
  doFetch: FetchLike,
): Promise<MailResult> {
  if (!cfg || !cfg.accountId || !cfg.token || !cfg.from)
    return { sent: false, reason: 'not-configured' };
  const { url, init } = cloudflareRequest(cfg, m);
  try {
    const res = await doFetch(url, init);
    const body = (await res.json().catch(() => null)) as {
      success?: boolean;
      result?: { permanent_bounces?: string[] };
    } | null;
    if (!res.ok || body?.success !== true) return { sent: false, reason: 'rejected' };
    if ((body.result?.permanent_bounces ?? []).length > 0)
      return { sent: false, reason: 'rejected' };
    return { sent: true };
  } catch {
    return { sent: false, reason: 'network' };
  }
}
