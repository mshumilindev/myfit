import { useT, type LocaleId } from './index';
import type { EmailErrorKind } from '../accounts/emailApi';

/**
 * Words of the email sign-in (SPO-283/423/224): the Email field in the profile form and the email gate. Five locales.
 * uk/pl/lt/et are machine translations that need a native read before launch (lt/et are mandatory).
 */
export interface EmailAuthStrings {
  fieldLabel: string;
  fieldPlaceholder: string;
  /** hint under the field per state */
  hintNone: string;
  hintPending: (email: string) => string;
  hintVerified: string;
  statusPending: string;
  statusVerified: string;
  save: string;
  change: string;
  cancel: string;
  resend: string;
  resendSent: string;
  checkNow: string;
  stillPending: string;
  passwordLabel: string;
  passwordHint: string;
  errors: Record<EmailErrorKind, string>;
  /** gate */
  gateAddTitle: string;
  gateAddLead: string;
  gateAddAction: string;
  gateCheckTitle: (email: string) => string;
  gateCheckLead: string;
  gateConfirmed: string;
  gateChange: string;
  gateOfflineTitle: string;
  gateOffline: string;
  gateSignOut: string;
  gateNoMailbox: string;
}

const en: EmailAuthStrings = {
  fieldLabel: 'Email',
  fieldPlaceholder: 'name@example.com',
  hintNone: 'Add an email to sign in with it and to recover your account.',
  hintPending: (email) => `We sent a link to ${email}. Open it to confirm.`,
  hintVerified: 'Confirmed. You can sign in with this email.',
  statusPending: 'Not confirmed',
  statusVerified: 'Confirmed',
  save: 'Save email',
  change: 'Change',
  cancel: 'Cancel',
  resend: 'Send the link again',
  resendSent: 'Link sent. Check your inbox and spam.',
  checkNow: 'I confirmed it',
  stillPending: 'Not confirmed yet. Open the link in the email first.',
  passwordLabel: 'Current password',
  passwordHint: 'Needed to change how you sign in.',
  errors: {
    offline: 'No connection. Try again when you are online.',
    invalid: 'Enter a valid email address.',
    taken: 'This email cannot be used. Try another one.',
    password: 'The password is wrong.',
    tooMany: 'Too many attempts. Try again later.',
    signedOut: 'Please sign in again.',
    generic: 'Something went wrong. Please try again.',
  },
  gateAddTitle: 'Add your email',
  gateAddLead:
    'To keep using Spotter, link an email and confirm it with the link we send. Your data stays as it is.',
  gateAddAction: 'Send the link',
  gateCheckTitle: (email) => `Check ${email}`,
  gateCheckLead: 'Open the link in the email we sent, then come back here.',
  gateConfirmed: 'Email confirmed',
  gateChange: 'Use another email',
  gateOfflineTitle: 'Connect to continue',
  gateOffline: 'We need a connection once to check your email. Your data is safe on this device.',
  gateSignOut: 'Sign out',
  gateNoMailbox: 'No access to this mailbox? Write to support and we will help.',
};

const uk: EmailAuthStrings = {
  fieldLabel: 'Email',
  fieldPlaceholder: 'name@example.com',
  hintNone: 'Додайте email, щоб входити з ним і відновлювати акаунт.',
  hintPending: (email) => `Ми надіслали посилання на ${email}. Відкрийте його, щоб підтвердити.`,
  hintVerified: 'Підтверджено. Можна входити з цим email.',
  statusPending: 'Не підтверджено',
  statusVerified: 'Підтверджено',
  save: 'Зберегти email',
  change: 'Змінити',
  cancel: 'Скасувати',
  resend: 'Надіслати посилання ще раз',
  resendSent: 'Посилання надіслано. Перевірте пошту й папку «Спам».',
  checkNow: 'Я підтвердив(ла)',
  stillPending: 'Ще не підтверджено. Спершу відкрийте посилання з листа.',
  passwordLabel: 'Поточний пароль',
  passwordHint: 'Потрібен, щоб змінити спосіб входу.',
  errors: {
    offline: 'Немає зʼєднання. Спробуйте, коли будете онлайн.',
    invalid: 'Введіть дійсну адресу email.',
    taken: 'Цей email не можна використати. Спробуйте інший.',
    password: 'Невірний пароль.',
    tooMany: 'Забагато спроб. Спробуйте пізніше.',
    signedOut: 'Увійдіть знову.',
    generic: 'Щось пішло не так. Спробуйте ще раз.',
  },
  gateAddTitle: 'Додайте свій email',
  gateAddLead:
    'Щоб користуватися Spotter далі, привʼяжіть email і підтвердьте його посиланням, яке ми надішлемо. Ваші дані лишаються як є.',
  gateAddAction: 'Надіслати посилання',
  gateCheckTitle: (email) => `Перевірте ${email}`,
  gateCheckLead: 'Відкрийте посилання в листі, який ми надіслали, і поверніться сюди.',
  gateConfirmed: 'Email підтверджено',
  gateChange: 'Використати інший email',
  gateOfflineTitle: 'Підключіться, щоб продовжити',
  gateOffline:
    'Один раз потрібне зʼєднання, щоб перевірити email. Ваші дані в безпеці на цьому пристрої.',
  gateSignOut: 'Вийти',
  gateNoMailbox: 'Немає доступу до цієї пошти? Напишіть у підтримку, ми допоможемо.',
};

const pl: EmailAuthStrings = {
  fieldLabel: 'E-mail',
  fieldPlaceholder: 'name@example.com',
  hintNone: 'Dodaj e-mail, aby się nim logować i odzyskać konto.',
  hintPending: (email) => `Wysłaliśmy link na ${email}. Otwórz go, aby potwierdzić.`,
  hintVerified: 'Potwierdzony. Możesz logować się tym e-mailem.',
  statusPending: 'Niepotwierdzony',
  statusVerified: 'Potwierdzony',
  save: 'Zapisz e-mail',
  change: 'Zmień',
  cancel: 'Anuluj',
  resend: 'Wyślij link ponownie',
  resendSent: 'Link wysłany. Sprawdź skrzynkę i spam.',
  checkNow: 'Potwierdziłem(am)',
  stillPending: 'Jeszcze niepotwierdzony. Najpierw otwórz link z wiadomości.',
  passwordLabel: 'Obecne hasło',
  passwordHint: 'Potrzebne, aby zmienić sposób logowania.',
  errors: {
    offline: 'Brak połączenia. Spróbuj, gdy będziesz online.',
    invalid: 'Podaj poprawny adres e-mail.',
    taken: 'Tego e-maila nie można użyć. Spróbuj innego.',
    password: 'Hasło jest nieprawidłowe.',
    tooMany: 'Zbyt wiele prób. Spróbuj później.',
    signedOut: 'Zaloguj się ponownie.',
    generic: 'Coś poszło nie tak. Spróbuj ponownie.',
  },
  gateAddTitle: 'Dodaj swój e-mail',
  gateAddLead:
    'Aby dalej korzystać ze Spotter, powiąż e-mail i potwierdź go linkiem, który wyślemy. Twoje dane zostają bez zmian.',
  gateAddAction: 'Wyślij link',
  gateCheckTitle: (email) => `Sprawdź ${email}`,
  gateCheckLead: 'Otwórz link w wiadomości, którą wysłaliśmy, i wróć tutaj.',
  gateConfirmed: 'E-mail potwierdzony',
  gateChange: 'Użyj innego e-maila',
  gateOfflineTitle: 'Połącz się, aby kontynuować',
  gateOffline:
    'Raz potrzebne jest połączenie, aby sprawdzić e-mail. Twoje dane są bezpieczne na tym urządzeniu.',
  gateSignOut: 'Wyloguj się',
  gateNoMailbox: 'Brak dostępu do tej skrzynki? Napisz do wsparcia, pomożemy.',
};

const lt: EmailAuthStrings = {
  fieldLabel: 'El. paštas',
  fieldPlaceholder: 'name@example.com',
  hintNone: 'Pridėkite el. paštą, kad galėtumėte juo prisijungti ir atkurti paskyrą.',
  hintPending: (email) => `Išsiuntėme nuorodą į ${email}. Atidarykite ją, kad patvirtintumėte.`,
  hintVerified: 'Patvirtinta. Galite prisijungti šiuo el. paštu.',
  statusPending: 'Nepatvirtinta',
  statusVerified: 'Patvirtinta',
  save: 'Išsaugoti el. paštą',
  change: 'Keisti',
  cancel: 'Atšaukti',
  resend: 'Siųsti nuorodą dar kartą',
  resendSent: 'Nuoroda išsiųsta. Patikrinkite gautus laiškus ir šlamštą.',
  checkNow: 'Patvirtinau',
  stillPending: 'Dar nepatvirtinta. Pirmiausia atidarykite nuorodą laiške.',
  passwordLabel: 'Dabartinis slaptažodis',
  passwordHint: 'Reikalingas prisijungimo būdui pakeisti.',
  errors: {
    offline: 'Nėra ryšio. Bandykite, kai būsite prisijungę.',
    invalid: 'Įveskite tinkamą el. pašto adresą.',
    taken: 'Šio el. pašto naudoti negalima. Išbandykite kitą.',
    password: 'Slaptažodis neteisingas.',
    tooMany: 'Per daug bandymų. Bandykite vėliau.',
    signedOut: 'Prisijunkite iš naujo.',
    generic: 'Kažkas nepavyko. Bandykite dar kartą.',
  },
  gateAddTitle: 'Pridėkite savo el. paštą',
  gateAddLead:
    'Norėdami toliau naudotis Spotter, susiekite el. paštą ir patvirtinkite jį nuoroda, kurią atsiųsime. Jūsų duomenys išlieka.',
  gateAddAction: 'Siųsti nuorodą',
  gateCheckTitle: (email) => `Patikrinkite ${email}`,
  gateCheckLead: 'Atidarykite nuorodą mūsų išsiųstame laiške ir grįžkite čia.',
  gateConfirmed: 'El. paštas patvirtintas',
  gateChange: 'Naudoti kitą el. paštą',
  gateOfflineTitle: 'Prisijunkite prie tinklo, kad tęstumėte',
  gateOffline:
    'Vieną kartą reikia ryšio el. paštui patikrinti. Jūsų duomenys saugūs šiame įrenginyje.',
  gateSignOut: 'Atsijungti',
  gateNoMailbox: 'Neturite prieigos prie šios dėžutės? Parašykite palaikymui, padėsime.',
};

const et: EmailAuthStrings = {
  fieldLabel: 'E-post',
  fieldPlaceholder: 'name@example.com',
  hintNone: 'Lisa e-post, et sellega sisse logida ja kontot taastada.',
  hintPending: (email) => `Saatsime lingi aadressile ${email}. Ava see kinnitamiseks.`,
  hintVerified: 'Kinnitatud. Saad selle e-postiga sisse logida.',
  statusPending: 'Kinnitamata',
  statusVerified: 'Kinnitatud',
  save: 'Salvesta e-post',
  change: 'Muuda',
  cancel: 'Tühista',
  resend: 'Saada link uuesti',
  resendSent: 'Link saadetud. Vaata sisse postkasti ja rämpsposti.',
  checkNow: 'Kinnitasin',
  stillPending: 'Veel kinnitamata. Ava esmalt kirjas olev link.',
  passwordLabel: 'Praegune parool',
  passwordHint: 'Vajalik sisselogimisviisi muutmiseks.',
  errors: {
    offline: 'Ühendus puudub. Proovi uuesti, kui oled võrgus.',
    invalid: 'Sisesta kehtiv e-posti aadress.',
    taken: 'Seda e-posti ei saa kasutada. Proovi teist.',
    password: 'Parool on vale.',
    tooMany: 'Liiga palju katseid. Proovi hiljem uuesti.',
    signedOut: 'Logi uuesti sisse.',
    generic: 'Midagi läks valesti. Proovi uuesti.',
  },
  gateAddTitle: 'Lisa oma e-post',
  gateAddLead:
    'Spotteri kasutamiseks lisa e-post ja kinnita see lingiga, mille saadame. Sinu andmed jäävad alles.',
  gateAddAction: 'Saada link',
  gateCheckTitle: (email) => `Vaata ${email}`,
  gateCheckLead: 'Ava saadetud kirjas olev link ja tule siia tagasi.',
  gateConfirmed: 'E-post kinnitatud',
  gateChange: 'Kasuta teist e-posti',
  gateOfflineTitle: 'Ühendu, et jätkata',
  gateOffline:
    'E-posti kontrollimiseks on korra vaja ühendust. Sinu andmed on selles seadmes turvaliselt alles.',
  gateSignOut: 'Logi välja',
  gateNoMailbox: 'Pole sellele postkastile ligipääsu? Kirjuta toele, aitame.',
};

export const EMAIL_AUTH_LOCALES: Record<LocaleId, EmailAuthStrings> = { en, uk, pl, lt, et };

export const emailAuthTexts = (locale: LocaleId): EmailAuthStrings =>
  EMAIL_AUTH_LOCALES[locale] ?? en;

export function useEmailT(): EmailAuthStrings {
  return emailAuthTexts(useT().locale);
}
