/** Words and patterns the router uses to read a message (see intents.ts). */

/** "Stuck / dropped / not growing" — a lift that isn't moving. */
/** Topics where films, songs, football or the weather are fair game. */
export const OFF_FRIENDLY = new Set([
  'other_sport',
  'travel',
  'are_you_ai',
  'joke',
  'cheat_meal',
  'app_language',
  'fun_fact',
  'rival_ai',
  'sing_poem',
  'k_heat',
  'k_holidays',
]);
export const PAIN_TOPICS = new Set([
  'app_injury_log',
  'return_injury',
  'pain_types',
  'injury_status',
  'tendon',
  'painkillers',
  'ice_heat',
  'doms',
  'train_sore',
]);
export const LIFTED_RE =
  /(how much|скільки|сколько|total|усього|всього).*((^|\s)(did i|have i|i've|i have|i)\s+(lifted|moved|lift)(\s|$)|(^|\s)(я\s+)?(підняв|підняла|підняли|піднято|поднял\S*|перетягав\S*)(\s|$))/u;
export const STALL_RE =
  /(стоїть|стоять|застря\S*|впа\S*|просі\S*|просід\S*|не росте|не ростуть|не йде|плато|слабш\S*|стоит|упал\S*|не растет|stuck|stall\S*|plateau\S*|drop\S*|went down|not (going|moving|growing|improving)|weaker|regress\S*)/u;
/** Words that ask Atlas to DO something. */
export const REQUEST_RE =
  /(^|\s)(заміни|поміняй|перенеси|постав|встанови|прибери|додай|видали|почни|запиши|зроби|вимкни|увімкни|давай|замени|поменяй|перенеси|поставь|убери|добавь|начни|запиши|сделай|swap|replace|move|set|remove|add|start|log|make|turn|switch|please|can you|could you|будь ласка|пожалуйста)(\s|$)/u;
export const SPLIT_RE = /\?+\s*|\s+(?:and also|also|а ще|і ще|плюс)\s+/i;
export const BUMP_RE =
  /(^|\s)(додай|додам|добав|добавь|накинь|накину|повісь|add|put on|bump|increase by)\s+(\d+(?:[.,]\d+)?)\s*(кг|kg|кіло|kilos?)?(\s|$)/u;
export const AVOID_RE =
  /(^|\s)(не хочу (більше )?(робити )?|ненавиджу|терпіти не можу|бісить|hate|can.?t stand|don.?t want to do|ненавижу|не хочу больше)/u;
export const CONNECTOR_RE = /^\s*((а|і|й|та|ще|також|и|еще|and|also|plus|then)\s+)+/iu;
/** Everyday Polish / Lithuanian / Estonian words (typed without diacritics too). */
export const OTHER_LATIN = new Set(
  'jak ile czy moj moje moja mam sie jest dla trening treningu cwiczenie cwiczenia dzisiaj ktory ktore kiedy jaki jaka mnie mi robic zrobic kiek kaip ar mano man yra ka kada kodel treniruote treniruotes pratimas pratimai siandien kui kuidas mis minu mul kas palju trenn trenni harjutus tana miks millal'.split(
    ' ',
  ),
);
/** Words that mark a message as English, not transliterated Ukrainian. */
export const EN_COMMON = new Set(
  'i my me you the a an to of in on for is are was do does did how what why when which who more go and or it this that with should can will much many long often best'.split(
    ' ',
  ),
);
export const NO_PAIN_CLAUSE =
  /(?<=^|\s)((в|у) мене |i have |my |у меня )?((нічого|ніщо|ніде|nothing|ничего|нигде)\s+(не\s+)?(болить|болять|болит|hurts?)|\S+\s+(не болить|не болять|не болит|does not hurt|doesn.?t hurt|is fine now)|(не болить|не болит)\s+\S+)(?=\s|$|[,.;—-])\s*[,.;—-]?\s*/iu;
/** "а?", "ну", "і що", "?" — keep talking about the same thing. */
export const CONTINUER_RE =
  /^\s*(\?+|а\s*\?*|ну\s*\?*|і\s*\?+|і що\s*\?*|і\s*далі\s*\?*|ну і\s*\?*|хм+\s*\?*|м+\s*\?*|та й\s*\?*|и\s*\?+|и что\s*\?*|so\s*\?*|and\s*\?+|and then\s*\?*|hm+\s*\?*|huh\s*\?*|well\s*\?*|\.\.\.)\s*$/iu;
export const NO_RE =
  /^\s*(ні|нє|неа|no|nope|nah|нет|не треба|не хочу|не потрібно|не надо)\s*[.!)]*\s*$/iu;
/** "ok", "так", "ясно" — heard; the topic's next steps as chips. */
export const ACK_RE =
  /^\s*(ok|okay|k|kk|fine|got it|sure|cool|yes|yeah|yep|ок|окей|ага|угу|так|да|добре|гаразд|зрозумів|зрозуміла|ясно|зрозуміло|понял|поняла|ясно|хорошо|ладно|норм|клас|супер)\s*[.!)]*\s*$/iu;
export const ACK_LINE: Record<number, [string[], string[]]> = {
  1: [
    ['Cool, bro. Where next?', 'Nice. What else?'],
    ['Ок, бро. Куди далі?', 'Кайф. Що ще глянемо?'],
  ],
  3: [
    ['Good. Next?', 'Noted. What else?'],
    ['Добре. Далі?', 'Прийнято. Що ще?'],
  ],
  5: [
    ['Wow, a word. Next question or go lift.', 'Riveting. Next?'],
    ['Ого, слово. Питай далі або йди тягай.', 'Захопливо. Далі?'],
  ],
};
/** Questions about your own numbers — pointless before the first workout. */
export const DATA_CHIP =
  /(my progress|my week|my best|my record|мій прогрес|мій тиждень|мій рекорд|мої рекорди|як я прогресую|how am i progressing|how have i progressed)/iu;
export const MY_DATA = new Set([
  'how_am_i_doing',
  'progress_lift',
  'best',
  'e1rm',
  'log_query',
  'range_lift',
  'range_muscle',
  'range_count',
  'tonnage',
  'stall',
  'week_summary',
  'compare_lifts',
]);
