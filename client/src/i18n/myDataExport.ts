import { useT, type LocaleId } from './index';

/**
 * Words of the data copy (SPO-295 N6; designs Export, ExportReady): choose parts, step-up, progress, ready. English,
 * Ukrainian and Polish; Lithuanian and Estonian read the English text like the account-deletion strings.
 * uk/pl are machine translations that need a native read before launch.
 */
export interface ExportStrings {
  title: string;
  sub: string;
  whatHeader: string;
  whatFoot: string;
  parts: Record<
    'account' | 'training' | 'body' | 'atlas' | 'sharing',
    { label: string; sub: string }
  >;
  prepareHeader: string;
  prepareLabel: string;
  prepareSub: string;
  needOne: string;
  warning: string;
  network: string;
  progressHeader: string;
  waiting: string;
  working: string;
  done: string;
  packing: string;
  cancel: string;
  failed: string;
  readySub: string;
  readyHeader: string;
  readyFile: string;
  prepared: (date: string) => string;
  readyFoot: string;
  gapsHeader: string;
  gapsFoot: string;
  reasons: Record<'server-only' | 'not-loaded' | 'feature-off' | 'held-by-other', string>;
  deviceCopy: string;
  again: string;
  continueDelete: string;
  /** the link in step 1 of the account deletion */
  deleteLink: string;
}

const en: ExportStrings = {
  title: 'Download a copy',
  sub: 'What Spotter can read for you on this device, as files',
  whatHeader: 'What to include',
  whatFoot: 'Leave everything on to get a full copy.',
  parts: {
    account: { label: 'Account, sign-in and consent history', sub: 'JSON and CSV' },
    training: { label: 'Training', sub: 'JSON and CSV' },
    body: { label: 'Health, body, sleep and nutrition', sub: 'JSON and CSV' },
    atlas: { label: 'Atlas chat', sub: 'JSON' },
    sharing: { label: 'Trainer sharing and messages', sub: 'JSON' },
  },
  prepareHeader: 'Prepare',
  prepareLabel: 'Prepare my copy',
  prepareSub: 'A ZIP file built on this device. You confirm your password first.',
  needOne: 'Turn on at least one part.',
  warning:
    'The file is not encrypted and contains health data. Anyone who gets it can read it. Store it carefully.',
  network: 'Your password is checked online. If you are offline, try again when you are connected.',
  progressHeader: 'Preparing your copy',
  waiting: 'Waiting',
  working: 'Working',
  done: 'Done',
  packing: 'Packing the file',
  cancel: 'Cancel',
  failed: 'Could not make the copy. Nothing was saved. Try again.',
  readySub: 'Your copy is ready',
  readyHeader: 'Ready',
  readyFile: 'Download the copy',
  prepared: (d) => `Prepared ${d}`,
  readyFoot: 'Health data in this file is not encrypted. Keep it somewhere safe.',
  gapsHeader: 'Not included here',
  gapsFoot:
    'These could not be read on this device. The file lists each one with the reason (manifest.json).',
  reasons: {
    'server-only': 'Kept on our servers only',
    'not-loaded': 'Not loaded on this device now',
    'feature-off': 'Stored, hidden until you consent',
    'held-by-other': 'Kept by your trainer',
  },
  deviceCopy:
    'Your data on this device was not yet confirmed in step with your account, so the copy may be incomplete.',
  again: 'Make another copy',
  continueDelete: 'Continue to delete my account',
  deleteLink: 'Download a copy first',
};

const uk: ExportStrings = {
  title: 'Завантажити копію',
  sub: 'Те, що Spotter може прочитати для вас на цьому пристрої, у файлах',
  whatHeader: 'Що включити',
  whatFoot: 'Залиште все ввімкненим, щоб отримати повну копію.',
  parts: {
    account: { label: 'Акаунт, вхід та історія згод', sub: 'JSON і CSV' },
    training: { label: 'Тренування', sub: 'JSON і CSV' },
    body: { label: 'Здоров’я, тіло, сон і харчування', sub: 'JSON і CSV' },
    atlas: { label: 'Чат з Atlas', sub: 'JSON' },
    sharing: { label: 'Доступ тренера та повідомлення', sub: 'JSON' },
  },
  prepareHeader: 'Підготувати',
  prepareLabel: 'Підготувати мою копію',
  prepareSub: 'ZIP-файл, створений на цьому пристрої. Спершу підтвердьте пароль.',
  needOne: 'Увімкніть хоча б одну частину.',
  warning:
    'Файл не зашифрований і містить дані про здоров’я. Кожен, хто його отримає, зможе його прочитати. Зберігайте обережно.',
  network:
    'Пароль перевіряється онлайн. Якщо ви офлайн, спробуйте ще раз, коли з’явиться з’єднання.',
  progressHeader: 'Готуємо копію',
  waiting: 'Чекає',
  working: 'Триває',
  done: 'Готово',
  packing: 'Пакуємо файл',
  cancel: 'Скасувати',
  failed: 'Не вдалося створити копію. Нічого не збережено. Спробуйте ще раз.',
  readySub: 'Ваша копія готова',
  readyHeader: 'Готово',
  readyFile: 'Завантажити копію',
  prepared: (d) => `Підготовлено ${d}`,
  readyFoot: 'Дані про здоров’я в цьому файлі не зашифровані. Зберігайте його в безпечному місці.',
  gapsHeader: 'Тут не включено',
  gapsFoot:
    'Це не вдалося прочитати на цьому пристрої. Файл містить перелік із причиною для кожного пункту (manifest.json).',
  reasons: {
    'server-only': 'Лише на наших серверах',
    'not-loaded': 'Зараз не завантажено на пристрої',
    'feature-off': 'Збережено, приховано до вашої згоди',
    'held-by-other': 'Зберігає ваш тренер',
  },
  deviceCopy:
    'Ваші дані на цьому пристрої ще не підтверджені як узгоджені з акаунтом, тому копія може бути неповною.',
  again: 'Створити ще одну копію',
  continueDelete: 'Продовжити видалення акаунта',
  deleteLink: 'Спершу завантажити копію',
};

const pl: ExportStrings = {
  title: 'Pobierz kopię',
  sub: 'To, co Spotter może dla Ciebie odczytać na tym urządzeniu, w plikach',
  whatHeader: 'Co uwzględnić',
  whatFoot: 'Zostaw wszystko włączone, aby dostać pełną kopię.',
  parts: {
    account: { label: 'Konto, logowanie i historia zgód', sub: 'JSON i CSV' },
    training: { label: 'Treningi', sub: 'JSON i CSV' },
    body: { label: 'Zdrowie, ciało, sen i odżywianie', sub: 'JSON i CSV' },
    atlas: { label: 'Czat z Atlasem', sub: 'JSON' },
    sharing: { label: 'Udostępnianie trenerowi i wiadomości', sub: 'JSON' },
  },
  prepareHeader: 'Przygotuj',
  prepareLabel: 'Przygotuj moją kopię',
  prepareSub: 'Plik ZIP tworzony na tym urządzeniu. Najpierw potwierdzisz hasło.',
  needOne: 'Włącz co najmniej jedną część.',
  warning:
    'Plik nie jest zaszyfrowany i zawiera dane o zdrowiu. Każdy, kto go zdobędzie, może go odczytać. Przechowuj go ostrożnie.',
  network: 'Hasło jest sprawdzane online. Jeśli jesteś offline, spróbuj ponownie po połączeniu.',
  progressHeader: 'Przygotowujemy kopię',
  waiting: 'Czeka',
  working: 'W toku',
  done: 'Gotowe',
  packing: 'Pakujemy plik',
  cancel: 'Anuluj',
  failed: 'Nie udało się wykonać kopii. Nic nie zapisano. Spróbuj ponownie.',
  readySub: 'Twoja kopia jest gotowa',
  readyHeader: 'Gotowe',
  readyFile: 'Pobierz kopię',
  prepared: (d) => `Przygotowano ${d}`,
  readyFoot: 'Dane o zdrowiu w tym pliku nie są zaszyfrowane. Trzymaj go w bezpiecznym miejscu.',
  gapsHeader: 'Nie uwzględniono tutaj',
  gapsFoot:
    'Tego nie udało się odczytać na tym urządzeniu. Plik wymienia każdą pozycję z powodem (manifest.json).',
  reasons: {
    'server-only': 'Tylko na naszych serwerach',
    'not-loaded': 'Teraz niewczytane na urządzeniu',
    'feature-off': 'Zapisane, ukryte do czasu zgody',
    'held-by-other': 'Przechowuje Twój trener',
  },
  deviceCopy:
    'Dane na tym urządzeniu nie były jeszcze potwierdzone jako zgodne z kontem, więc kopia może być niepełna.',
  again: 'Zrób kolejną kopię',
  continueDelete: 'Przejdź do usunięcia konta',
  deleteLink: 'Najpierw pobierz kopię',
};

const EXPORT_LOCALES: Partial<Record<LocaleId, ExportStrings>> = { en, uk, pl };

const exportTexts = (locale: LocaleId): ExportStrings => EXPORT_LOCALES[locale] ?? en;

export function useExportT(): ExportStrings {
  return exportTexts(useT().locale);
}
