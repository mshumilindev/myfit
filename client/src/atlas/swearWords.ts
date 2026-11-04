// SPO-124: strong-swearing tables for the chat voice (split out of style.ts).
/** Swearing — red only, and only when it's switched on (SPO-124). Effort only:
 *  never the body, health or slurs. pl/lt/et are marked needs-native-review. */
export const SWEAR_OPEN: Record<string, string[]> = {
  en: [
    'Fuck. ',
    "Oh, for fuck's sake. ",
    'Shit. ',
    'Jesus fucking Christ. ',
    'Bloody hell. ',
    'Well, shit. ',
    'Fucking hell. ',
  ],
  uk: [
    'Блядь. ',
    'Ну нахуй. ',
    'Пиздець. ',
    'Їбать мене в сраку. ',
    'Сука. ',
    'Ой, блін, ні, блядь. ',
    'Хуйня якась. ',
  ],
  pl: [
    'Kurwa. ',
    'No kurwa mać. ',
    'Chuj w to. ',
    'O w mordę, kurwa. ',
    'Pierdolę. ',
    'Ja pierdolę. ',
  ],
  lt: ['Bybis. ', 'Šūdas. ', 'Nu nachui. ', 'Kurva. ', 'Pizdec. ', 'Bliamba. '],
  et: ['Kurat. ', 'Türa. ', 'Vittu. ', 'Persse. ', 'No kurat küll. ', 'Paska värk. '],
};
export const SWEAR_CLOSE: Record<string, string[]> = {
  en: [
    ' Now move your lazy fucking ass.',
    " And quit whining, for fuck's sake.",
    ' Shit, just do it.',
    ' Stop bullshitting yourself and lift.',
    ' Fucking get on with it.',
    ' Excuses are bullshit, the bar is not.',
  ],
  uk: [
    ' А тепер ворушись, лінива срако.',
    ' І не скигли, блядь.',
    ' Хуй з ним, просто зроби це.',
    ' Досить пиздіти, йди підніми.',
    ' Ну йоб твою мать, погнали вже.',
    ' Відмазки — хуйня, штанга — ні.',
  ],
  pl: [
    ' Rusz tę leniwą dupę, kurwa.',
    ' I przestań jęczeć, kurwa mać.',
    ' Pierdolę, po prostu to zrób.',
    ' Wymówki to gówno, sztanga nie.',
    ' Weź się za to, do cholery jasnej.',
  ],
  lt: [
    ' Pajudink savo tingią subinę, kurva.',
    ' Ir nebesiskųsk, bybis.',
    ' Šūdas, tiesiog padaryk.',
    ' Atsikalbinėjimai — šūdas, štanga — ne.',
    ' Nachui, einam jau.',
  ],
  et: [
    ' Liiguta see logelev tagumik, kurat.',
    ' Ja lõpeta virisemine, türa.',
    ' Persse, tee lihtsalt ära.',
    ' Vabandused on paska, kang mitte.',
    ' Vittu, lähme juba.',
  ],
};
export const swearLang = (loc: string): string => (loc in SWEAR_OPEN ? loc : 'en');
