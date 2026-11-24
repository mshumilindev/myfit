/**
 * What a topic that only MENTIONS an add-on says while that add-on is off: the same topic, told without the add-on's part.
 * (Topics that are about the add-on by name are hidden instead: `addonTopics.ts`.)
 */
export interface PlainAnswer {
  addon: string;
  answer: [string, string];
}

export const PLAIN_ANSWERS: Readonly<Record<string, PlainAnswer>> = {
  app_gyms: {
    addon: 'equipment',
    answer: [
      'Gyms tab → find your gym (search or “Nearby”) → “Add this gym”.',
      'Вкладка «Зали» → знайди свій (пошук або «Поблизу») → «Додати цей зал».',
    ],
  },
  app_warmup_set: {
    addon: 'set-types',
    answer: [
      "Tap the set → “Set type” → “Warm-up”. Warm-ups don't count toward your working sets.",
      'Тапни підхід → «Тип підходу» → «Розминка». Розминочні не рахуються в робочі підходи.',
    ],
  },
  app_tour: {
    addon: 'equipment',
    answer: [
      'Spotter in a nutshell: the bottom bar has Today (your plan, your history and me), Overview (progress, records, programs, goals, playbook, exercises), the “+” in the middle (start a session, an auto session, an activity, sleep and health, or log a past workout), Gyms (your gyms) and More (the Apps — Apex, Nutrition, Learn — and your profile). Log your sets as you train and I track every lift from them — ask me anything, or ask me for tips.',
      'Spotter коротко: у нижній панелі — «Сьогодні» (план, історія і я), «Огляд» (прогрес, рекорди, програми, цілі, плейбук, вправи), «+» посередині (почати тренування, авто-тренування, активність, сон і здоров’я або записати минуле), «Зали» (твої зали) і «Ще» («Застосунки» — Apex, «Харчування», «Навчання» — і твій профіль). Записуй підходи під час тренування — і я відстежуватиму кожну вправу; питай мене що завгодно або попроси поради.',
    ],
  },
};
