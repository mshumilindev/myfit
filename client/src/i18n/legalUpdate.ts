import { useT, type LocaleId } from './index';
import type { ChangeBullet, UpdateDoc } from '../legal/changelog';

/**
 * Words of the policy / terms update notice (SPO-295 N8): the dismissible banner for an editorial change and the blocking
 * confirm sheet for a material one. English, Ukrainian and Polish; Lithuanian and Estonian read the English text like the
 * legal documents do. uk/pl are machine translations that need a native read before launch (`legal/pending.ts`).
 * The "what is new" texts are keyed by `ChangeBullet` (the typed changelog, `legal/changelog.ts`).
 */
export interface UpdateBullet {
  title: string;
  sub: string;
}

export interface LegalUpdateStrings {
  /** Names of the documents, in running text. */
  docName: Record<UpdateDoc | 'both', string>;
  bannerKicker: string;
  bannerTitle: (name: string) => string;
  bannerBody: (date: string) => string;
  bannerRead: string;
  bannerDismiss: string;
  sheetTitle: (name: string) => string;
  sheetLead: (date: string) => string;
  newHeader: string;
  openBoth: string;
  openOne: string;
  agree: (name: string) => string;
  accept: string;
  bullets: Record<ChangeBullet, UpdateBullet>;
}

const en: LegalUpdateStrings = {
  docName: {
    terms: 'Terms of Use',
    policy: 'Privacy Policy',
    both: 'Terms of Use and Privacy Policy',
  },
  bannerKicker: 'Update',
  bannerTitle: (name) => `We updated our ${name}`,
  bannerBody: (date) =>
    `Version ${date}. Wording only: what Spotter does with your data has not changed.`,
  bannerRead: 'Read it',
  bannerDismiss: 'Dismiss',
  sheetTitle: (name) => `We updated our ${name}`,
  sheetLead: (date) =>
    `Version ${date}. This change adds something new, so we ask you to read it and confirm.`,
  newHeader: 'What is new',
  openBoth: 'Open both documents and read them to unlock the box below.',
  openOne: 'Open the document and read it to unlock the box below.',
  agree: (name) => `I have read the updated ${name} and agree.`,
  accept: 'I have read it, continue',
  bullets: {
    recipient: {
      title: 'New recipient',
      sub: 'A service is added to the list of who receives data.',
    },
    purpose: {
      title: 'New purpose',
      sub: 'Data is used for something it was not used for before.',
    },
    category: {
      title: 'New kind of data',
      sub: 'A kind of data is added to what Spotter handles.',
    },
    retention: { title: 'Retention', sub: 'How long some data is kept has changed.' },
    transfer: { title: 'Transfers', sub: 'Where some data is sent or stored has changed.' },
    terms: { title: 'Terms of Use', sub: 'The rules for using Spotter have changed.' },
  },
};

const uk: LegalUpdateStrings = {
  docName: {
    terms: 'Умови використання',
    policy: 'Політика конфіденційності',
    both: 'Умови використання та Політика конфіденційності',
  },
  bannerKicker: 'Оновлення',
  bannerTitle: (name) => `Ми оновили: ${name}`,
  bannerBody: (date) =>
    `Версія ${date}. Лише формулювання: що Spotter робить з вашими даними, не змінилося.`,
  bannerRead: 'Прочитати',
  bannerDismiss: 'Закрити',
  sheetTitle: (name) => `Ми оновили: ${name}`,
  sheetLead: (date) =>
    `Версія ${date}. Ця зміна додає щось нове, тому просимо прочитати її й підтвердити.`,
  newHeader: 'Що нового',
  openBoth: 'Відкрийте обидва документи й прочитайте їх, щоб розблокувати поле нижче.',
  openOne: 'Відкрийте документ і прочитайте його, щоб розблокувати поле нижче.',
  agree: (name) => `Я прочитав(ла) оновлені: ${name}, і погоджуюсь.`,
  accept: 'Я прочитав(ла), продовжити',
  bullets: {
    recipient: { title: 'Новий одержувач', sub: 'До списку одержувачів даних додано сервіс.' },
    purpose: {
      title: 'Нова мета',
      sub: 'Дані використовуються для того, для чого раніше не використовувалися.',
    },
    category: {
      title: 'Новий вид даних',
      sub: 'До даних, з якими працює Spotter, додано новий вид.',
    },
    retention: { title: 'Зберігання', sub: 'Змінився строк зберігання деяких даних.' },
    transfer: {
      title: 'Передавання',
      sub: 'Змінилося, куди надсилаються або де зберігаються деякі дані.',
    },
    terms: { title: 'Умови використання', sub: 'Змінилися правила користування Spotter.' },
  },
};

const pl: LegalUpdateStrings = {
  docName: {
    terms: 'Regulamin',
    policy: 'Polityka prywatności',
    both: 'Regulamin i Polityka prywatności',
  },
  bannerKicker: 'Aktualizacja',
  bannerTitle: (name) => `Zaktualizowaliśmy: ${name}`,
  bannerBody: (date) =>
    `Wersja ${date}. Tylko sformułowania: to, co Spotter robi z Twoimi danymi, się nie zmieniło.`,
  bannerRead: 'Przeczytaj',
  bannerDismiss: 'Zamknij',
  sheetTitle: (name) => `Zaktualizowaliśmy: ${name}`,
  sheetLead: (date) =>
    `Wersja ${date}. Ta zmiana wprowadza coś nowego, dlatego prosimy o przeczytanie i potwierdzenie.`,
  newHeader: 'Co nowego',
  openBoth: 'Otwórz oba dokumenty i przeczytaj je, aby odblokować pole poniżej.',
  openOne: 'Otwórz dokument i przeczytaj go, aby odblokować pole poniżej.',
  agree: (name) => `Przeczytałem(-am) zaktualizowane: ${name} i zgadzam się.`,
  accept: 'Przeczytałem(-am), kontynuuj',
  bullets: {
    recipient: { title: 'Nowy odbiorca', sub: 'Do listy odbiorców danych dodano usługę.' },
    purpose: { title: 'Nowy cel', sub: 'Dane są używane do czegoś, do czego wcześniej nie były.' },
    category: {
      title: 'Nowy rodzaj danych',
      sub: 'Do danych, którymi zajmuje się Spotter, dodano nowy rodzaj.',
    },
    retention: {
      title: 'Przechowywanie',
      sub: 'Zmienił się czas przechowywania niektórych danych.',
    },
    transfer: {
      title: 'Przekazywanie',
      sub: 'Zmieniło się, dokąd są wysyłane lub gdzie są przechowywane niektóre dane.',
    },
    terms: { title: 'Regulamin', sub: 'Zmieniły się zasady korzystania ze Spotter.' },
  },
};

export const LEGAL_UPDATE_LOCALES: Partial<Record<LocaleId, LegalUpdateStrings>> = { en, uk, pl };

export const legalUpdateTexts = (locale: LocaleId): LegalUpdateStrings =>
  LEGAL_UPDATE_LOCALES[locale] ?? en;

export function useUpdateT(): LegalUpdateStrings {
  return legalUpdateTexts(useT().locale);
}
