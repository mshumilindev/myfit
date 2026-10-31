/**
 * Transactional mail (SPO-225/invites): the pure parts. Message text per locale, the Resend request,
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

/** `selfreset`: the person asked for the letter themselves (forgot password); `reset`: an administrator sent it. */
export type InviteKind = 'invite' | 'reset' | 'verify' | 'selfreset';

export interface InviteMailInput {
  kind: InviteKind;
  /** The sign-up link (`<origin>/#/join/<token>`). */
  link: string;
  /** The person's name when the admin gave one. */
  name: string;
  /** Days the link works (ignored for `verify` and `selfreset`). */
  days: number;
  /** Hours the link works (`selfreset`). */
  hours?: number;
}

type WordKind = Exclude<InviteKind, 'selfreset'>;

/** The letter of a person who asked to reset their own password: five short strings per locale. */
interface SelfWords {
  subject: string;
  lead: string;
  expires: (hours: number) => string;
  ignore: string;
  foot: string;
}
const SELF: Record<MailLocale, SelfWords> = {
  en: {
    subject: 'Reset your Spotter password',
    lead: 'Someone (hopefully you) asked to reset the password of your Spotter account. Your training data stays as it is.',
    expires: (h) => `The link works once and expires in ${h} hour${h === 1 ? '' : 's'}.`,
    ignore:
      'If you did not ask for this, ignore this letter: nothing changes until the link is opened.',
    foot: 'Spotter · sent because a password reset was requested for this address.',
  },
  uk: {
    subject: 'Скидання пароля Spotter',
    lead: 'Хтось (сподіваємось, ви) попросив скинути пароль до акаунта Spotter. Ваші дані тренувань лишаються як є.',
    expires: (h) => `Посилання працює один раз і діє ${h} год.`,
    ignore:
      'Якщо ви цього не просили, проігноруйте лист: поки посилання не відкрито, нічого не змінюється.',
    foot: 'Spotter · лист надіслано, бо для цієї адреси попросили скинути пароль.',
  },
  pl: {
    subject: 'Reset hasła do Spotter',
    lead: 'Ktoś (mamy nadzieję, że Ty) poprosił o reset hasła do konta Spotter. Twoje dane treningowe pozostają bez zmian.',
    expires: (h) => `Link działa jednorazowo i wygasa po ${h} godz.`,
    ignore:
      'Jeśli to nie Ty, zignoruj ten list: dopóki link nie zostanie otwarty, nic się nie zmienia.',
    foot: 'Spotter · wiadomość wysłano, bo dla tego adresu poproszono o reset hasła.',
  },
  lt: {
    subject: 'Spotter slaptažodžio atkūrimas',
    lead: 'Kažkas (tikimės, kad jūs) paprašė atkurti jūsų Spotter paskyros slaptažodį. Jūsų treniruočių duomenys lieka nepakitę.',
    expires: (h) => `Nuoroda veikia vieną kartą ir galioja ${h} val.`,
    ignore: 'Jei to neprašėte, ignoruokite laišką: kol nuoroda neatidaryta, nieko nevyksta.',
    foot: 'Spotter · laiškas išsiųstas, nes šiam adresui paprašyta atkurti slaptažodį.',
  },
  et: {
    subject: 'Spotteri parooli lähtestamine',
    lead: 'Keegi (loodetavasti sina) palus lähtestada sinu Spotteri konto parool. Sinu treeningandmed jäävad samaks.',
    expires: (h) => `Link töötab ühe korra ja kehtib ${h} tundi.`,
    ignore: 'Kui sa seda ei palunud, ignoreeri kirja: kuni linki ei avata, ei muutu midagi.',
    foot: 'Spotter · kiri saadeti, sest sellele aadressile telliti parooli lähtestamine.',
  },
};

interface Words {
  subject: Record<WordKind, string>;
  hello: (name: string) => string;
  lead: Record<WordKind, string>;
  button: Record<WordKind, string>;
  expires: (days: number) => string;
  fallback: string;
  qr: string;
  once: string;
  ignore: Record<WordKind, string>;
  foot: Record<WordKind, string>;
}

const WORDS: Record<MailLocale, Words> = {
  en: {
    subject: {
      invite: 'You are invited to Spotter',
      reset: 'Set a new password for Spotter',
      verify: 'Confirm your email for Spotter',
    },
    hello: (n) => (n ? `Hi ${n},` : 'Hi,'),
    lead: {
      invite: 'You have been invited to Spotter. Create your account with the button below.',
      reset: 'An administrator sent you a link to set a new password for your Spotter account.',
      verify: 'Confirm this email address so you can sign in with it and recover your account.',
    },
    button: { invite: 'Create my account', reset: 'Set a new password', verify: 'Confirm email' },
    expires: (d) => `The link works once and expires in ${d} days.`,
    fallback: 'Button not working? Open this link:',
    qr: 'You can also open the same link on your phone by scanning the QR code your administrator shows you.',
    once: 'The link works once.',
    ignore: {
      invite:
        'If you did not expect this message, ignore it. Nothing happens until you open the link.',
      reset:
        'If you did not expect this message, ignore it. Nothing happens until you open the link.',
      verify: 'If you did not expect this message, ignore it. The address stays unconfirmed.',
    },
    foot: {
      invite: 'Spotter · sent because an administrator entered this address.',
      reset: 'Spotter · sent because an administrator entered this address.',
      verify: 'Spotter · sent because this address was added to a Spotter account.',
    },
  },
  uk: {
    subject: {
      invite: 'Вас запрошено до Spotter',
      reset: 'Новий пароль для Spotter',
      verify: 'Підтвердіть пошту для Spotter',
    },
    hello: (n) => (n ? `Привіт, ${n}!` : 'Привіт!'),
    lead: {
      invite: 'Вас запросили до Spotter. Створіть акаунт кнопкою нижче.',
      reset: 'Адміністратор надіслав вам посилання, щоб задати новий пароль до акаунта Spotter.',
      verify: 'Підтвердіть цю адресу, щоб входити з нею й відновлювати акаунт.',
    },
    button: {
      invite: 'Створити акаунт',
      reset: 'Задати новий пароль',
      verify: 'Підтвердити пошту',
    },
    expires: (d) => `Посилання працює один раз і діє ${d} дн.`,
    fallback: 'Кнопка не працює? Відкрийте посилання:',
    qr: 'Те саме посилання можна відкрити на телефоні, відсканувавши QR-код, який покаже адміністратор.',
    once: 'Посилання працює один раз.',
    ignore: {
      invite:
        'Якщо ви не чекали цього листа, просто проігноруйте його. Доки ви не відкриєте посилання, нічого не станеться.',
      reset:
        'Якщо ви не чекали цього листа, просто проігноруйте його. Доки ви не відкриєте посилання, нічого не станеться.',
      verify: 'Якщо ви не чекали цього листа, проігноруйте його. Адреса лишиться непідтвердженою.',
    },
    foot: {
      invite: 'Spotter · лист надіслано, бо адміністратор вказав цю адресу.',
      reset: 'Spotter · лист надіслано, бо адміністратор вказав цю адресу.',
      verify: 'Spotter · лист надіслано, бо цю адресу додали до акаунта Spotter.',
    },
  },
  pl: {
    subject: {
      invite: 'Zaproszenie do Spotter',
      reset: 'Nowe hasło do Spotter',
      verify: 'Potwierdź e-mail w Spotter',
    },
    hello: (n) => (n ? `Cześć ${n},` : 'Cześć,'),
    lead: {
      invite: 'Zaproszono Cię do Spotter. Załóż konto przyciskiem poniżej.',
      reset: 'Administrator przesłał Ci link do ustawienia nowego hasła do konta Spotter.',
      verify: 'Potwierdź ten adres, aby logować się nim i odzyskiwać konto.',
    },
    button: { invite: 'Załóż konto', reset: 'Ustaw nowe hasło', verify: 'Potwierdź e-mail' },
    expires: (d) => `Link działa jednorazowo i wygasa po ${d} dniach.`,
    fallback: 'Przycisk nie działa? Otwórz ten link:',
    qr: 'Ten sam link możesz otworzyć na telefonie, skanując kod QR, który pokaże administrator.',
    once: 'Link działa jednorazowo.',
    ignore: {
      invite:
        'Jeśli nie spodziewałeś(-aś) się tej wiadomości, zignoruj ją. Dopóki nie otworzysz linku, nic się nie stanie.',
      reset:
        'Jeśli nie spodziewałeś(-aś) się tej wiadomości, zignoruj ją. Dopóki nie otworzysz linku, nic się nie stanie.',
      verify:
        'Jeśli nie spodziewałeś(-aś) się tej wiadomości, zignoruj ją. Adres pozostanie niepotwierdzony.',
    },
    foot: {
      invite: 'Spotter · wiadomość wysłano, bo administrator podał ten adres.',
      reset: 'Spotter · wiadomość wysłano, bo administrator podał ten adres.',
      verify: 'Spotter · wiadomość wysłano, bo ten adres dodano do konta Spotter.',
    },
  },
  lt: {
    subject: {
      invite: 'Kvietimas į Spotter',
      reset: 'Naujas Spotter slaptažodis',
      verify: 'Patvirtinkite el. paštą Spotter',
    },
    hello: (n) => (n ? `Sveiki, ${n},` : 'Sveiki,'),
    lead: {
      invite: 'Jus pakvietė į Spotter. Susikurkite paskyrą paspaudę mygtuką.',
      reset: 'Administratorius atsiuntė nuorodą naujam Spotter paskyros slaptažodžiui nustatyti.',
      verify: 'Patvirtinkite šį adresą, kad galėtumėte juo prisijungti ir atkurti paskyrą.',
    },
    button: {
      invite: 'Sukurti paskyrą',
      reset: 'Nustatyti naują slaptažodį',
      verify: 'Patvirtinti el. paštą',
    },
    expires: (d) => `Nuoroda veikia vieną kartą ir galioja ${d} d.`,
    fallback: 'Mygtukas neveikia? Atidarykite šią nuorodą:',
    qr: 'Tą pačią nuorodą galite atidaryti telefone nuskaitę QR kodą, kurį parodys administratorius.',
    once: 'Nuoroda veikia vieną kartą.',
    ignore: {
      invite: 'Jei šio laiško nelaukėte, ignoruokite jį. Kol neatidarysite nuorodos, nieko nevyks.',
      reset: 'Jei šio laiško nelaukėte, ignoruokite jį. Kol neatidarysite nuorodos, nieko nevyks.',
      verify: 'Jei šio laiško nelaukėte, ignoruokite jį. Adresas liks nepatvirtintas.',
    },
    foot: {
      invite: 'Spotter · laiškas išsiųstas, nes administratorius nurodė šį adresą.',
      reset: 'Spotter · laiškas išsiųstas, nes administratorius nurodė šį adresą.',
      verify: 'Spotter · laiškas išsiųstas, nes šis adresas pridėtas prie Spotter paskyros.',
    },
  },
  et: {
    subject: {
      invite: 'Kutse Spotterisse',
      reset: 'Uus parool Spotterisse',
      verify: 'Kinnita e-post Spotteris',
    },
    hello: (n) => (n ? `Tere, ${n}!` : 'Tere!'),
    lead: {
      invite: 'Sind kutsuti Spotterisse. Loo konto allolevast nupust.',
      reset: 'Administraator saatis sulle lingi, et määrata Spotteri kontole uus parool.',
      verify: 'Kinnita see aadress, et saaksid sellega sisse logida ja kontot taastada.',
    },
    button: { invite: 'Loo konto', reset: 'Määra uus parool', verify: 'Kinnita e-post' },
    expires: (d) => `Link töötab ühe korra ja kehtib ${d} päeva.`,
    fallback: 'Nupp ei tööta? Ava see link:',
    qr: 'Sama lingi saad avada telefonis, skannides QR-koodi, mille administraator sulle näitab.',
    once: 'Link töötab ühe korra.',
    ignore: {
      invite: 'Kui sa seda kirja ei oodanud, ignoreeri seda. Enne lingi avamist ei juhtu midagi.',
      reset: 'Kui sa seda kirja ei oodanud, ignoreeri seda. Enne lingi avamist ei juhtu midagi.',
      verify: 'Kui sa seda kirja ei oodanud, ignoreeri seda. Aadress jääb kinnitamata.',
    },
    foot: {
      invite: 'Spotter · kiri saadeti, sest administraator sisestas selle aadressi.',
      reset: 'Spotter · kiri saadeti, sest administraator sisestas selle aadressi.',
      verify: 'Spotter · kiri saadeti, sest see aadress lisati Spotteri kontole.',
    },
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
  const own = i.kind === 'selfreset' ? SELF[locale] : null;
  const k: WordKind = i.kind === 'selfreset' ? 'reset' : i.kind;
  const expiry =
    i.kind === 'verify' ? w.once : own ? own.expires(i.hours ?? 1) : `${w.expires(i.days)} ${w.qr}`;
  const subject = own?.subject ?? w.subject[k];
  const lead = own?.lead ?? w.lead[k];
  const ignore = own?.ignore ?? w.ignore[k];
  const foot = own?.foot ?? w.foot[k];
  const text = [
    w.hello(i.name),
    '',
    lead,
    '',
    `${w.button[k]}: ${i.link}`,
    '',
    ...(own || i.kind === 'verify' ? [expiry] : [w.expires(i.days), w.qr]),
    '',
    ignore,
    '',
    foot,
  ].join('\n');
  const link = esc(i.link);
  const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"></head><body style="margin:0;background:#0b0c0e;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e9e9ea"><div style="max-width:560px;margin:0 auto;padding:32px 16px"><div style="background:#16171a;border:1px solid #2a2c31;border-radius:16px;padding:32px 28px"><h1 style="font-size:22px;line-height:1.3;margin:0 0 12px;color:#fff">${esc(subject)}</h1><p style="font-size:15px;line-height:1.55;margin:0 0 8px;color:#b8bac0">${esc(w.hello(i.name))}</p><p style="font-size:15px;line-height:1.55;margin:0 0 16px;color:#b8bac0">${esc(lead)}</p><a href="${link}" style="display:inline-block;background:#d9a24f;color:#1a1204;font-weight:700;font-size:15px;text-decoration:none;padding:13px 26px;border-radius:999px;margin:8px 0 20px">${esc(w.button[k])}</a><p style="font-size:13px;line-height:1.5;margin:0 0 12px;color:#b8bac0">${esc(expiry)}</p><p style="font-size:12px;line-height:1.5;margin:0 0 16px;color:#8b8e96;word-break:break-all">${esc(w.fallback)}<br>${link}</p><p style="font-size:13px;line-height:1.5;margin:0;color:#b8bac0;border-left:3px solid #d9a24f;padding-left:12px">${esc(ignore)}</p></div><p style="font-size:12px;color:#7d8088;margin:20px 8px 0;line-height:1.5;text-align:center">${esc(foot)}</p></div></body></html>`;
  return { to, subject, text, html };
}

export interface MailerConfig {
  apiKey: string;
  from: string;
  fromName: string;
}

export type MailResult =
  | { sent: true }
  | {
      sent: false;
      reason: 'not-configured' | 'not-verified' | 'rejected' | 'network';
      /** HTTP status of the provider's answer (never its text): tells a bad key (401) from an unverified domain (403). */
      status?: number;
    };

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** The Resend `POST /emails` request for one message. The sender is `Name <address>`; the body carries text and html. */
export function resendRequest(cfg: MailerConfig, m: MailMessage) {
  return {
    url: 'https://api.resend.com/emails',
    init: {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'spotter-functions',
      },
      body: JSON.stringify({
        from: `${cfg.fromName.replace(/[<>",\r\n]/g, '')} <${cfg.from}>`,
        to: [m.to],
        subject: m.subject,
        html: m.html,
        text: m.text,
      }),
    },
  };
}

/** Sends one message. Never throws and never returns the address or the provider's text: the outcome only. */
export async function sendViaResend(
  cfg: MailerConfig | null,
  m: MailMessage,
  doFetch: FetchLike,
): Promise<MailResult> {
  if (!cfg || !cfg.apiKey || !cfg.from) return { sent: false, reason: 'not-configured' };
  const { url, init } = resendRequest(cfg, m);
  try {
    const res = await doFetch(url, init);
    const body = (await res.json().catch(() => null)) as { id?: string } | null;
    if (!res.ok || typeof body?.id !== 'string')
      return { sent: false, reason: 'rejected', status: res.status };
    return { sent: true };
  } catch {
    return { sent: false, reason: 'network' };
  }
}
