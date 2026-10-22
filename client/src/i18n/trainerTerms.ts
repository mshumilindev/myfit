import { useT, type LocaleId } from './index';

/**
 * Words of the Trainer Terms + DPA part of the legal gate (SPO-289, SPO-295): shown in drawer 1 to a trainer, manager or admin
 * who has not accepted them (alone, or together with the Terms / Privacy Policy for a new account).
 * English, Ukrainian and Polish; Lithuanian and Estonian read the English text like the other legal strings
 * (`legalGate.ts`). uk/pl are machine drafts that need a native read (`legal/pending.ts`). The key points are a SUMMARY,
 * never the contract: the full documents decide (`summaryNote`).
 */
export interface TrainerTermsStrings {
  title: string;
  lead: string;
  draftBadge: string;
  docTrainerTerms: string;
  docDpa: string;
  pointsHeader: string;
  points: readonly string[];
  summaryNote: string;
  /** The one agree box when only the Trainer Terms + DPA are asked. */
  agree: string;
  /** The one agree box when the Terms of Use, the Privacy Policy, the Trainer Terms and the DPA are asked together. */
  agreeAll: string;
}

const en: TrainerTermsStrings = {
  title: 'Trainer Terms and data processing',
  lead: 'To use Spotter as a trainer or manager, read and accept the Trainer Terms and the DPA. You decide what you record about your clients; Spotter is the tool.',
  draftBadge: 'Draft: not yet reviewed by a lawyer',
  docTrainerTerms: 'Trainer Terms',
  docDpa: 'Data Processing Agreement (DPA)',
  pointsHeader: 'In short',
  points: [
    'You decide what to record about a client and why; for your private notes you are likely an independent controller.',
    'For client data you enter, Spotter acts as your processor under the DPA.',
    'You see a client’s data only in the categories they shared, and they can stop at any time.',
    'Managers and team members see only what you delegate.',
    'If a client leaves, they keep their own history; you handle your own records.',
  ],
  summaryNote: 'This is a summary, not the contract. The two documents decide.',
  agree: 'I have read and accept the Trainer Terms and the DPA.',
  agreeAll:
    'I agree to the Terms of Use, the Trainer Terms and the DPA, and acknowledge the Privacy Policy.',
};

const uk: TrainerTermsStrings = {
  title: 'Умови для тренерів і обробка даних',
  lead: 'Щоб користуватися Spotter як тренер чи менеджер, прочитайте й прийміть Умови для тренерів та DPA. Ви самі вирішуєте, що записувати про клієнтів; Spotter лише інструмент.',
  draftBadge: 'Чернетка: ще не перевірена юристом',
  docTrainerTerms: 'Умови для тренерів',
  docDpa: 'Угода про обробку даних (DPA)',
  pointsHeader: 'Коротко',
  points: [
    'Ви вирішуєте, що записувати про клієнта і навіщо; для своїх приватних нотаток ви, імовірно, окремий контролер.',
    'Для даних клієнтів, які ви вносите, Spotter діє як ваш процесор за DPA.',
    'Ви бачите дані клієнта лише в категоріях, якими він поділився, і він може припинити будь-коли.',
    'Менеджери й члени команди бачать лише те, що ви делегуєте.',
    'Якщо клієнт іде, він зберігає власну історію; ви самі відповідаєте за свої записи.',
  ],
  summaryNote: 'Це стислий виклад, а не договір. Вирішальні два документи.',
  agree: 'Я прочитав(ла) і приймаю Умови для тренерів та DPA.',
  agreeAll:
    'Я погоджуюся з Умовами використання, Умовами для тренерів та DPA і підтверджую ознайомлення з Політикою конфіденційності.',
};

const pl: TrainerTermsStrings = {
  title: 'Warunki dla trenerów i przetwarzanie danych',
  lead: 'Aby korzystać ze Spotter jako trener lub menedżer, przeczytaj i zaakceptuj Warunki dla trenerów oraz DPA. To Ty decydujesz, co zapisujesz o klientach; Spotter jest tylko narzędziem.',
  draftBadge: 'Wersja robocza: jeszcze niesprawdzona przez prawnika',
  docTrainerTerms: 'Warunki dla trenerów',
  docDpa: 'Umowa powierzenia przetwarzania danych (DPA)',
  pointsHeader: 'W skrócie',
  points: [
    'Ty decydujesz, co zapisać o kliencie i po co; w przypadku prywatnych notatek jesteś prawdopodobnie odrębnym administratorem.',
    'Dla danych klientów, które wprowadzasz, Spotter działa jako Twój podmiot przetwarzający na podstawie DPA.',
    'Dane klienta widzisz tylko w kategoriach, którymi się podzielił, i może przestać w każdej chwili.',
    'Menedżerowie i członkowie zespołu widzą tylko to, co im powierzysz.',
    'Gdy klient odchodzi, zachowuje własną historię; swoimi zapisami zajmujesz się Ty.',
  ],
  summaryNote: 'To streszczenie, nie umowa. Rozstrzygają dwa dokumenty.',
  agree: 'Przeczytałem(-am) i akceptuję Warunki dla trenerów oraz DPA.',
  agreeAll:
    'Akceptuję Warunki korzystania, Warunki dla trenerów i DPA oraz potwierdzam zapoznanie się z Polityką prywatności.',
};

export const TRAINER_TERMS_LOCALES: Partial<Record<LocaleId, TrainerTermsStrings>> = { en, uk, pl };

export const trainerTermsTexts = (locale: LocaleId): TrainerTermsStrings =>
  TRAINER_TERMS_LOCALES[locale] ?? en;

export function useTrainerTermsT(): TrainerTermsStrings {
  return trainerTermsTexts(useT().locale);
}
