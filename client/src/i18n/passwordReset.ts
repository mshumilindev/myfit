import { useT, type LocaleId } from './index';

/**
 * Words of the forgot-password flow (SPO-225): the link on the sign-in form, the request, "check your inbox", the new
 * password, the dead link and "password changed". Five locales. uk/pl/lt/et are machine translations that need a native
 * read before launch (lt/et are mandatory).
 */
export interface PasswordResetStrings {
  forgotLink: string;
  requestTitle: string;
  requestLead: string;
  emailPlaceholder: string;
  sendLink: string;
  sending: string;
  backToSignIn: string;
  sentTitle: string;
  sentLead: string;
  sendAgain: string;
  sendAgainIn: (s: number) => string;
  newTitle: string;
  newLead: string;
  newPassword: string;
  repeatPassword: string;
  passwordHint: string;
  mismatch: string;
  save: string;
  saving: string;
  deadTitle: string;
  deadLead: string;
  deadNote: string;
  getNewLink: string;
  doneTitle: string;
  doneLead: string;
  doneNote: string;
  signIn: string;
  errors: { invalid: string; tooMany: string; offline: string; generic: string };
}

const en: PasswordResetStrings = {
  forgotLink: 'Forgot your password?',
  requestTitle: 'Reset your password',
  requestLead: 'Enter the email you linked to your account. We will send a link that works once.',
  emailPlaceholder: 'Email',
  sendLink: 'Send the link',
  sending: 'Sending…',
  backToSignIn: 'Back to sign in',
  sentTitle: 'Check your inbox',
  sentLead:
    'If this email is linked to an account, a reset link is on its way. It works once and expires in 1 hour.',
  sendAgain: 'Send again',
  sendAgainIn: (s) => `Send again in ${s} s`,
  newTitle: 'Choose a new password',
  newLead: 'Your training data stays as it is. You will be signed out on your other devices.',
  newPassword: 'New password',
  repeatPassword: 'Repeat the new password',
  passwordHint: '6 to 72 characters.',
  mismatch: 'The passwords do not match.',
  save: 'Save password',
  saving: 'Saving…',
  deadTitle: 'This link no longer works',
  deadLead: 'Reset links work once and expire after 1 hour.',
  deadNote: 'The link was already used or has expired.',
  getNewLink: 'Get a new link',
  doneTitle: 'Password changed',
  doneLead: 'Use the new password to sign in. Other devices were signed out.',
  doneNote: 'Your data is untouched.',
  signIn: 'Sign in',
  errors: {
    invalid: 'Enter a valid email address.',
    tooMany: 'Too many attempts. Try again in 15 minutes.',
    offline: 'No connection. Try again when you are online.',
    generic: 'Something went wrong. Try again.',
  },
};

const uk: PasswordResetStrings = {
  forgotLink: 'Забули пароль?',
  requestTitle: 'Скидання пароля',
  requestLead:
    'Введіть пошту, яку ви привʼязали до акаунта. Ми надішлемо посилання, що працює один раз.',
  emailPlaceholder: 'Електронна пошта',
  sendLink: 'Надіслати посилання',
  sending: 'Надсилаємо…',
  backToSignIn: 'Назад до входу',
  sentTitle: 'Перевірте пошту',
  sentLead:
    'Якщо ця адреса привʼязана до акаунта, посилання для скидання вже в дорозі. Воно працює один раз і діє 1 годину.',
  sendAgain: 'Надіслати ще раз',
  sendAgainIn: (s) => `Надіслати ще раз через ${s} с`,
  newTitle: 'Новий пароль',
  newLead: 'Ваші дані тренувань лишаються як є. На інших пристроях ви вийдете з акаунта.',
  newPassword: 'Новий пароль',
  repeatPassword: 'Повторіть новий пароль',
  passwordHint: 'Від 6 до 72 символів.',
  mismatch: 'Паролі не збігаються.',
  save: 'Зберегти пароль',
  saving: 'Зберігаємо…',
  deadTitle: 'Це посилання більше не діє',
  deadLead: 'Посилання для скидання працюють один раз і діють 1 годину.',
  deadNote: 'Посилання вже використано або воно прострочене.',
  getNewLink: 'Отримати нове посилання',
  doneTitle: 'Пароль змінено',
  doneLead: 'Увійдіть із новим паролем. На інших пристроях вас вилогінено.',
  doneNote: 'Ваші дані не змінились.',
  signIn: 'Увійти',
  errors: {
    invalid: 'Введіть правильну адресу пошти.',
    tooMany: 'Забагато спроб. Спробуйте за 15 хвилин.',
    offline: 'Немає зʼєднання. Спробуйте, коли будете онлайн.',
    generic: 'Щось пішло не так. Спробуйте ще раз.',
  },
};

const pl: PasswordResetStrings = {
  forgotLink: 'Nie pamiętasz hasła?',
  requestTitle: 'Reset hasła',
  requestLead: 'Wpisz e-mail powiązany z kontem. Wyślemy link, który działa jednorazowo.',
  emailPlaceholder: 'E-mail',
  sendLink: 'Wyślij link',
  sending: 'Wysyłamy…',
  backToSignIn: 'Wróć do logowania',
  sentTitle: 'Sprawdź skrzynkę',
  sentLead:
    'Jeśli ten adres jest powiązany z kontem, link do resetu jest w drodze. Działa jednorazowo i wygasa po 1 godzinie.',
  sendAgain: 'Wyślij ponownie',
  sendAgainIn: (s) => `Wyślij ponownie za ${s} s`,
  newTitle: 'Wybierz nowe hasło',
  newLead:
    'Twoje dane treningowe pozostają bez zmian. Zostaniesz wylogowany na innych urządzeniach.',
  newPassword: 'Nowe hasło',
  repeatPassword: 'Powtórz nowe hasło',
  passwordHint: 'Od 6 do 72 znaków.',
  mismatch: 'Hasła nie są takie same.',
  save: 'Zapisz hasło',
  saving: 'Zapisujemy…',
  deadTitle: 'Ten link już nie działa',
  deadLead: 'Linki do resetu działają jednorazowo i wygasają po 1 godzinie.',
  deadNote: 'Link został już użyty lub wygasł.',
  getNewLink: 'Pobierz nowy link',
  doneTitle: 'Hasło zmienione',
  doneLead: 'Zaloguj się nowym hasłem. Na innych urządzeniach wylogowano.',
  doneNote: 'Twoje dane nie zostały zmienione.',
  signIn: 'Zaloguj się',
  errors: {
    invalid: 'Wpisz poprawny adres e-mail.',
    tooMany: 'Za dużo prób. Spróbuj za 15 minut.',
    offline: 'Brak połączenia. Spróbuj, gdy będziesz online.',
    generic: 'Coś poszło nie tak. Spróbuj ponownie.',
  },
};

const lt: PasswordResetStrings = {
  forgotLink: 'Pamiršote slaptažodį?',
  requestTitle: 'Slaptažodžio atkūrimas',
  requestLead:
    'Įveskite el. paštą, susietą su paskyra. Atsiųsime nuorodą, kuri veikia vieną kartą.',
  emailPlaceholder: 'El. paštas',
  sendLink: 'Siųsti nuorodą',
  sending: 'Siunčiama…',
  backToSignIn: 'Atgal į prisijungimą',
  sentTitle: 'Patikrinkite paštą',
  sentLead:
    'Jei šis adresas susietas su paskyra, atkūrimo nuoroda jau pakeliui. Ji veikia vieną kartą ir galioja 1 valandą.',
  sendAgain: 'Siųsti dar kartą',
  sendAgainIn: (s) => `Siųsti dar kartą po ${s} s`,
  newTitle: 'Pasirinkite naują slaptažodį',
  newLead: 'Jūsų treniruočių duomenys lieka nepakitę. Kituose įrenginiuose būsite atjungti.',
  newPassword: 'Naujas slaptažodis',
  repeatPassword: 'Pakartokite naują slaptažodį',
  passwordHint: 'Nuo 6 iki 72 simbolių.',
  mismatch: 'Slaptažodžiai nesutampa.',
  save: 'Išsaugoti slaptažodį',
  saving: 'Saugoma…',
  deadTitle: 'Ši nuoroda nebeveikia',
  deadLead: 'Atkūrimo nuorodos veikia vieną kartą ir galioja 1 valandą.',
  deadNote: 'Nuoroda jau panaudota arba nebegalioja.',
  getNewLink: 'Gauti naują nuorodą',
  doneTitle: 'Slaptažodis pakeistas',
  doneLead: 'Prisijunkite nauju slaptažodžiu. Kituose įrenginiuose atjungta.',
  doneNote: 'Jūsų duomenys nepakito.',
  signIn: 'Prisijungti',
  errors: {
    invalid: 'Įveskite tinkamą el. pašto adresą.',
    tooMany: 'Per daug bandymų. Bandykite po 15 minučių.',
    offline: 'Nėra ryšio. Bandykite, kai būsite prisijungę.',
    generic: 'Kažkas nepavyko. Bandykite dar kartą.',
  },
};

const et: PasswordResetStrings = {
  forgotLink: 'Unustasid parooli?',
  requestTitle: 'Parooli lähtestamine',
  requestLead: 'Sisesta kontoga seotud e-post. Saadame lingi, mis töötab ühe korra.',
  emailPlaceholder: 'E-post',
  sendLink: 'Saada link',
  sending: 'Saadan…',
  backToSignIn: 'Tagasi sisselogimise juurde',
  sentTitle: 'Vaata postkasti',
  sentLead:
    'Kui see aadress on kontoga seotud, on lähtestamislink teel. See töötab ühe korra ja kehtib 1 tund.',
  sendAgain: 'Saada uuesti',
  sendAgainIn: (s) => `Saada uuesti ${s} s pärast`,
  newTitle: 'Vali uus parool',
  newLead: 'Sinu treeningandmed jäävad samaks. Teistes seadmetes logitakse sind välja.',
  newPassword: 'Uus parool',
  repeatPassword: 'Korda uut parooli',
  passwordHint: '6 kuni 72 märki.',
  mismatch: 'Paroolid ei kattu.',
  save: 'Salvesta parool',
  saving: 'Salvestan…',
  deadTitle: 'See link ei tööta enam',
  deadLead: 'Lähtestamislingid töötavad ühe korra ja kehtivad 1 tund.',
  deadNote: 'Link on juba kasutatud või aegunud.',
  getNewLink: 'Hangi uus link',
  doneTitle: 'Parool muudetud',
  doneLead: 'Logi sisse uue parooliga. Teistes seadmetes logiti välja.',
  doneNote: 'Sinu andmed on muutmata.',
  signIn: 'Logi sisse',
  errors: {
    invalid: 'Sisesta kehtiv e-posti aadress.',
    tooMany: 'Liiga palju katseid. Proovi 15 minuti pärast.',
    offline: 'Ühendust pole. Proovi, kui oled võrgus.',
    generic: 'Midagi läks valesti. Proovi uuesti.',
  },
};

export const PASSWORD_RESET_LOCALES: Record<LocaleId, PasswordResetStrings> = {
  en,
  uk,
  pl,
  lt,
  et,
};

export const passwordResetTexts = (locale: LocaleId): PasswordResetStrings =>
  PASSWORD_RESET_LOCALES[locale] ?? en;

export function useResetT(): PasswordResetStrings {
  return passwordResetTexts(useT().locale);
}
