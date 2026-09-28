/**
 * Language detection: script, language-specific letters, and function-word
 * evidence. Latin text is scored for English, Polish, Lithuanian, Estonian and
 * Latin transliteration of Ukrainian / Russian.
 */
import { fold, type RawTok } from './tokenize';
import type { Lang } from './types';
import { wset } from './core';
import { knownWord } from './lang/slav';
import { plKnows } from './lang/pl';
import { ltKnows } from './lang/lt';
import { etKnows } from './lang/et';
import { EN_ADJ, EN_NOUNS, EN_VERBS } from './lex/en';

let EN_W: Set<string> | null = null;
const enWords = (): Set<string> =>
  (EN_W ??= new Set([
    ...wset(EN_VERBS),
    ...wset(EN_NOUNS),
    ...wset(EN_ADJ),
    ...wset('too much very really my your says said wife'),
  ]));

const UK_LET = /[іїєґ]/;
const RU_LET = /[ыэъё]/;
/** Letters only Polish has (ą and ę are Lithuanian too). */
const PL_LET = /[łńśźżć]/;
const LT_LET = /[ėįųūč]/;
const ET_LET = /[õäöü]/;

const W: Record<string, Set<string>> = {
  uk: wset(
    'я ти він вона ми ви вони мені мене тобі тебе що шо як це чи не і й та але бо якщо коли треба можна сьогодні вчора завтра дуже чому скільки де хто який яка які мій моя моє мої після тому щоб ще вже теж також буду був була було хочу можу маю зробив робити тренування болить ноги коліно зал підходів разів',
  ),
  ru: wset(
    'я ты он она мы вы они мне меня тебе что как это ли не и но потому если когда надо нужно можно сегодня вчера завтра очень почему сколько где кто какой мой моя мои после чтобы еще уже тоже буду был была было хочу могу сделал делать тренировка болит ноги колено зал подходов раз',
  ),
  en: wset(
    'i you he she we they me my your it is are was were am be do does did have has had can could should would will what how why when where which who the a an and or but if because to of in on at for with not dont didnt im my this that today yesterday tomorrow workout gym squat bench legs please',
  ),
  pl: wset(
    'ja ty on ona my wy oni mi mnie ci cie co jak czy nie i ale bo jesli kiedy dzisiaj dzis wczoraj jutro bardzo dlaczego ile gdzie kto ktory moj moja moje po zeby jest sa byl byla bylo chce moge zrobilem robic trening boli nogi kolano silownia serii na w z do sie mam jestem',
  ),
  lt: wset(
    'as tu jis ji mes jus jie man mane tau ka kas kaip ar ne ir bet nes jei kada siandien vakar rytoj labai kodel kiek kur kuris mano po kad yra buvo noriu galiu padariau daryti treniruote skauda kojas keli sporto sale seriju su i is per',
  ),
  et: wset(
    'ma mina sa sina tema me meie te teie nad mul mulle sul mida mis kuidas kas ei ja aga sest kui millal tana eile homme vaga miks mitu palju kus kes minu mu parast et on oli olen tahan saan tegin teha trenn trenni valutab jalad polv joususaal seeriat kordust hommikul ohtul pärast parast enne ainult juba veel ikka tund tundi aega kaua',
  ),
  ukt: wset(
    'ya ty vin vona my vy vony meni mene tobi tebe shcho scho sho yak tse chy ne i ta ale bo yakshcho koly treba mozhna sogodni sohodni vchora zavtra duzhe chomu skilky de khto yakyi moia moie moi pislia shchob shche vzhe tezh budu buv bula khochu hochu mozhu maiu mayu zrobyv robyty trenuvannia bolyt nogy nohy kolino zal pidhodiv raziv dai daj',
  ),
  rut: wset(
    'ya ty on ona my vy oni mne menya tebe chto shto kak eto li ne i no potomu esli kogda nado nuzhno mozhno segodnya vchera zavtra ochen pochemu skolko gde kto moi moya posle chtoby eshche uzhe tozhe budu byl byla hochu mogu sdelal delat trenirovka bolit nogi koleno zal podhodov',
  ),
};

export interface Detected {
  lang: Lang;
  translit?: boolean;
}

export function detect(toks: RawTok[]): Detected {
  const ws = toks.filter((t) => t.kind === 'w').map((t) => t.norm);
  if (!ws.length) return { lang: 'en' };
  const text = ws.join(' ');
  const cyr = (text.match(/[Ѐ-ӿ]/g) ?? []).length;
  const lat = (text.match(/[a-zà-ž]/g) ?? []).length;
  if (cyr >= lat) {
    let uk = 0;
    let ru = 0;
    for (const w of ws) {
      if (UK_LET.test(w) || w.includes("'")) uk += 2;
      if (RU_LET.test(w)) ru += 2;
      if (W.uk.has(w)) uk++;
      if (W.ru.has(w)) ru++;
      if (!UK_LET.test(w) && !RU_LET.test(w) && !W.uk.has(w) && !W.ru.has(w)) {
        const ku = knownWord(w, 'uk');
        const kr = knownWord(w, 'ru');
        if (ku && !kr) uk += 0.5;
        if (kr && !ku) ru += 0.5;
      }
      if (/^(к|с|со|от|из|ли|бы)$/.test(w)) ru += 0.5;
    }
    return { lang: ru > uk ? 'ru' : 'uk' };
  }
  const sc: Record<string, number> = { en: 0, pl: 0, lt: 0, et: 0, ukt: 0, rut: 0 };
  for (const w of ws) {
    if (PL_LET.test(w)) sc.pl += 2;
    if (LT_LET.test(w)) sc.lt += 2;
    if (ET_LET.test(w)) sc.et += 2;
    if (/[ąęšž]/.test(w)) {
      sc.pl += /[ąę]/.test(w) ? 0.5 : 0;
      sc.lt += 0.5;
      sc.et += /[šž]/.test(w) ? 0.5 : 0;
    }
    const f = fold(w);
    for (const k of Object.keys(sc)) if (W[k].has(f)) sc[k] += 1;
    if (f.length > 2) {
      if (plKnows(f)) sc.pl += 0.6;
      if (ltKnows(f)) sc.lt += 0.6;
      if (etKnows(f)) sc.et += 0.6;
    }
    // transliteration letter clusters
    if (/(shch|zh|kh|ch|ts|yi|ia|iu|ie|yy|ey)/.test(f) && !/(th|wh|ck|ph)/.test(f)) {
      sc.ukt += 0.3;
      sc.rut += 0.25;
    }
    if (
      /(yy|yi|yty|ysia|ytys|ivs|nnia|yv|yla|yly|iv|ity|any)$/.test(f) ||
      /^(ya|yak|yaki|chy|shcho|tse|pid|vid|roz|pry)/.test(f)
    )
      sc.ukt += 0.7;
    if (/(rz|sz|cz|ie|dz)/.test(f) || /[łśćżźń]/.test(w)) sc.pl += 0.5;
    if (/(ogo|yy|tsya|tsa|ish|esh)$/.test(f)) sc.rut += 0.3;
    // Russian past -al/-ila/-ili (Ukrainian has -av/-yv/-iv): "zapisal", "sdelala"
    if (f.length > 4 && /[^aeiouy](al|ala|ali|ila|ili|ela|eli)$/.test(f)) sc.rut += 0.6;
    if (/^trenirovk/.test(f)) sc.rut += 0.6;
    // Endings typical of each language (past 1sg, cases), on longer words.
    if (f.length > 4) {
      if (/(sin|sime|nud|tud|mine|misel|miseks|kul|gal|ga|st|lt|le|ks)$/.test(f)) sc.et += 0.35;
      if (/(iau|avau|ėjau|ejau|uose|oje|yje|ams|oms|ių)$/.test(w)) sc.lt += 0.35;
      if (/(łem|łam|łeś|ować|ać|ić|yć|ów|ach|ami|ego|emu)$/.test(w)) sc.pl += 0.35;
    }
    if (/(ing|ed|tion|ly)$/.test(f)) sc.en += 0.3;
    if (/'(s|t|re|m|ve|ll|d)$/.test(w)) sc.en += 1;
    if (enWords().has(f)) sc.en += 0.6;
  }
  let best = 'en';
  for (const k of Object.keys(sc)) if (sc[k] > sc[best]) best = k;
  if (best === 'ukt') return { lang: 'uk', translit: true };
  if (best === 'rut') return { lang: 'ru', translit: true };
  return { lang: best as Lang };
}
