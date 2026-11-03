/**
 * Chat shorthand and aside curses, cleaned off a question before Atlas reads it (split out of nlu.ts: file-size ratchet).
 */

/** Chat shorthand → the plain word ("tmrw" → "tomorrow", "скока" → "скільки", "треня" → "тренування"). */
const SLANG: Record<string, string> = {
  tmrw: 'tomorrow',
  tmr: 'tomorrow',
  tmrow: 'tomorrow',
  tmrrw: 'tomorrow',
  '2moro': 'tomorrow',
  '2morrow': 'tomorrow',
  tomoz: 'tomorrow',
  '2day': 'today',
  tday: 'today',
  tdy: 'today',
  '2nite': 'tonight',
  tonite: 'tonight',
  rn: 'right now',
  wat: 'what',
  wut: 'what',
  wht: 'what',
  shud: 'should',
  shld: 'should',
  cud: 'could',
  wud: 'would',
  pls: 'please',
  plz: 'please',
  thx: 'thanks',
  thnx: 'thanks',
  tnx: 'thanks',
  cuz: 'because',
  coz: 'because',
  nxt: 'next',
  wk: 'week',
  wkout: 'workout',
  wrkout: 'workout',
  b4: 'before',
  gonna: 'going to',
  wanna: 'want to',
  lemme: 'let me',
  dunno: 'dont know',
  idk: 'i dont know',
  треня: 'тренування',
  треню: 'тренування',
  трені: 'тренуванні',
  трене: 'тренуванні',
  трєня: 'тренування',
  тренить: 'тренувати',
  сьодні: 'сьогодні',
  сьодня: 'сьогодні',
  сєдня: 'сьогодні',
  седня: 'сьогодні',
  сёдня: 'сьогодні',
  скока: 'скільки',
  скіки: 'скільки',
  скіко: 'скільки',
  шо: 'що',
  чо: 'що',
  чё: 'що',
  че: 'що',
  щас: 'зараз',
  ща: 'зараз',
  ваще: 'взагалі',
  спс: 'дякую',
  дякс: 'дякую',
  качалка: 'зал',
  качалку: 'зал',
  качалці: 'залі',
  качалке: 'зале',
  след: 'следующей',
};

/** Words said TO someone that carry no topic ("bro what do I hit today"). */
const VOCATIVE =
  /(^|[\s,.!?])(bro|bruh|brah|dude|fam|бро|братан|братанчик|чувак|чуваче)(?=[\s,.!?]|$)(?![\s,]+(split|спліт|сплит))/giu;

/**
 * SPO-35 P5: swearing is not an insult. "what the fuck is my bench max" is a question with a curse in it; only a curse
 * aimed at Atlas or the app is an insult. Recognition only — the tone of the reply stays with SPO-124.
 */
const CURSE =
  /(^|[\s,.!?])(the (fuck|hell)|(holy |fucking |fuckin |freaking |bloody )?(fuck|shit|damn|crap|hell)|fucking|fuckin|блін|бляха|бля|нахрен|нахер|нахуй|пиздець|хрін|чорт|їбан\p{L}*|довбан\p{L}*|kurwa|kurde|cholera|chuj|pierdol\p{L}*)(?=[\s,.!?]|$)/giu;
const AIMED =
  /\b(you|your|u|ur|app|spotter|atlas|bot)\b|(^|\s)(ти|тобі|твій|твоя|додаток|ty|jesteś|aplikacja)(\s|$)/iu;
const ASKS =
  /\?|\b(what|how|when|which|why|show|am i|should|can i|did i|do i)\b|(^|\s)(що|як|коли|яка|який|яке|скільки|чи|покажи|ile|jak|kiedy|co|pokaż)(\s|$)/iu;

/** The message without a curse that is not aimed at the bot, when a real question remains. */
function withoutAsideCurse(t: string): string {
  if (AIMED.test(t) || !ASKS.test(t)) return t;
  const rest = t
    .replace(CURSE, '$1')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.!?]+/, '')
    .trim();
  return rest.split(' ').length >= 3 ? rest : t;
}

/** Shorthand spelled out, "bro" dropped, the rest of the message untouched. */
export function expandSlang(text: string): string {
  const t = withoutAsideCurse(text).replace(/[\p{L}\p{N}]+/gu, (w) => SLANG[w.toLowerCase()] ?? w);
  const bare = t.replace(VOCATIVE, '$1').replace(/\s+/g, ' ').trim();
  return /[\p{L}\p{N}]/u.test(bare) ? bare : t;
}
