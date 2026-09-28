/**
 * What a message says, read through its grammar (grammar/): which part of it
 * asks the question, whether it reports, plans, asks, commands or complains,
 * who it is about, and what it takes for granted.
 *
 * Routing uses it in three ways (intents.ts):
 *  - the FOCUS — the part of the message the question lives in, when that is
 *    a strict part of it: the clause after "but" when the part before is
 *    context ("I know how to bench, but how do I fix my squat"), the kept side
 *    of a negated alternative ("I don't want to lose weight, I want muscle"),
 *    a clause that dismisses a subject ("forget cardio, …", "про дієту не
 *    питаю, …"), a question embedded under "asks / wants to know", the
 *    condition when the main clause is only "what should I do?", and no
 *    pleasantries ("hey. quick one. …");
 *  - gates for rule answers — a report is a past-tense statement by the user,
 *    not a question, a plan, a condition or a command ("30 min cardio after
 *    lifting, good or bad?" is no activity report);
 *  - features for the confidence model (confidence.ts).
 *
 * One analysis per message, remembered; ~0.5 ms.
 */
import { analyze, focus as grammarFocus } from './grammar';
import { fold, foldRe } from './nlu';
import type { Analysis, Clause, Focus, Lang, Sentence, Token } from './grammar';

export interface Understanding {
  lang: Lang;
  /** Sentences and clauses in the message. */
  sentences: number;
  clauses: number;
  /** Some sentence asks (a question, or a request put as one). */
  question: boolean;
  /** Some sentence is a command ("swap squats for leg press"). */
  command: boolean;
  /** The user tells what they did: a past-tense statement, first person. */
  report: boolean;
  /** A plan: future tense in the user's own clause ("I will run tomorrow"). */
  plan: boolean;
  /** Said to Atlas about Atlas ("you ignored me", "you didn't answer"). */
  complaint: boolean;
  /** The main subject is somebody else ("my girlfriend asks…", "my dad is 65"). */
  other: boolean;
  /** A condition frames the message ("if my knee hurts, …"). */
  conditional: boolean;
  /** The main clause of the asking sentence is negated. */
  negated: boolean;
  /**
   * A condition that opens the message, by kind: 'neg' "unless / якщо не /
   * chyba że / nebent / kui just", 'hyp' "in case / на випадок якщо / na
   * wypadek gdyby / jei kartais / juhuks kui", 'while' "as long as / поки / o
   * ile / kol / seni kuni", 'even' "even if / навіть якщо / nawet jeśli / net
   * jei / isegi kui", 'if' the plain "if / once / whenever / якщо / коли…".
   */
  cond: { kind: 'neg' | 'hyp' | 'while' | 'even' | 'if'; text: string; main: string } | null;
  /** A worry, not a report: "I'm afraid of getting stuck under the bar". */
  fear: boolean;
  /** Asked under a condition about what would happen — not about the log. */
  hypothetical: boolean;
  /** Separate asking clauses ("how long to rest, and what's tomorrow?" = 2). */
  asks: number;
  /** The user wants to grow ("I just want to get big", "chcę masę") — not afraid of it. */
  wantsGrowth: boolean;
  /** Pain is only mentioned to deny it ("nothing hurts", "nic mnie nie boli"). */
  painNegated: boolean;
  /** The asking clause (with its subordinates) of the last question, else null. */
  qText: string | null;
  /** The question asks about the user's own past ("did I…", "what did I do…"). */
  pastAsk: boolean;
  /** The question asks for advice ("should I…", "which split is best"). */
  advice: boolean;
  /** "Why do you (always) suggest squats?" — asks Atlas to justify its pick. */
  whyAtlas: boolean;
  /** The part to route on when it is a strict part of the message, else null. */
  focus: string | null;
  /** Which rule chose the focus. */
  focusWhy?:
    | 'pleasantry'
    | 'contrast'
    | 'alternative'
    | 'dismiss'
    | 'embedded'
    | 'condition'
    | 'anaphora'
    | 'request';
  /** Share of the message's words the focus keeps (1 without a focus). */
  focusShare: number;
  /** Grammar's own routing summary (what is asked about, time refs, quantities…). */
  f: Focus;
}

const memo = new Map<string, Understanding>();

/** For measuring what the grammar adds (eval ablation): off = a reading that knows nothing. */
let off = false;
export function __grammarOff(v: boolean): void {
  off = v;
  memo.clear();
}

/** The grammar reading of a message (remembered for the last few messages). */
export function understand(text: string): Understanding {
  const hit = memo.get(text);
  if (hit) return hit;
  const u = off ? blank() : read(text);
  memo.set(text, u);
  if (memo.size > 64) memo.delete(memo.keys().next().value as string);
  return u;
}

// ---- word lists (lemmas and folded forms; all six languages) --------------------

/** A sentence that is only a greeting / thanks / "quick one". */
const PLEASANTRY =
  /^(hey|hi|hello|yo|ok|okay|ok so|so|well|right|thanks|thank you|thx|cheers|bro|man|dude|coach|quick one|quick q|quick question|question|one more|short question|one more thing|also|привіт|привет|хай|ок|окей|ну|отже|коротше|короче|дякую|спасибі|спасибо|питання|коротке питання|швидке питання|вопрос|короткий вопрос|быстрый вопрос|ще одне|ещё одно|еще одно|бро|тренер|cześć|czesc|hej|siema|dzięki|dzieki|pytanie|jeszcze jedno|labas|sveikas|ačiū|aciu|klausimas|dar vienas|tere|tsau|aitäh|aitah|küsimus|kusimus|veel üks)$/u;

/** Coordinators that set the following part against the preceding one. */
const CONTRAST =
  /^(but|though|however|yet|але|проте|однак|зате|а|но|однако|ale|lecz|jednak|a|bet|tačiau|taciau|o|aga|kuid|ent)$/u;

/** Words that say the part before a contrast is fine / known / done. */
const SETTLED =
  /^(fine|ok|okay|good|well|great|solid|already|know|knows|нормально|норм|добре|добре|гаразд|вже|вмію|знаю|хорошо|уже|умею|dobrze|ok|już|juz|umiem|wiem|gerai|jau|moku|žinau|zinau|hästi|hasti|korras|juba|oskan|tean)$/u;

/** Verbs of asking / knowing that embed the real question ("she asks how much…"). */
const ASK_VERB =
  /^(ask|wonder|know|tell|explain|want|say|питати|спитати|цікавитися|знати|сказати|пояснити|хотіти|спрашивать|спросить|знать|сказать|объяснить|хотеть|pytać|zapytać|wiedzieć|powiedzieć|wyjaśnić|chcieć|klausti|paklausti|žinoti|pasakyti|paaiškinti|norėti|küsima|teadma|ütlema|selgitama|tahtma)$/u;

/** Predicates that wave a subject away ("forget cardio", "не цікавить", "don't care"). */
const DISMISS =
  /^(forget|care|ask|interest|mind|забути|забувати|цікавити|цікавий|питати|забыть|интересовать|интересный|спрашивать|zapomnieć|interesować|pytać|pamiršti|domėti|klausti|unustama|huvitama|küsima)$/u;

/** Question words that open an embedded question ("…asks HOW MUCH protein…"). */
const WH_START =
  /^(how|what|which|why|when|where|who|скільки|як|що|шо|який|яка|які|чому|коли|де|сколько|как|что|какой|почему|когда|где|ile|jak|co|jaki|jaka|dlaczego|kiedy|gdzie|kiek|kaip|ką|ka|koks|kokia|kodėl|kodel|kada|kur|kui|kuidas|mida|mis|milline|miks|millal|kus)$/u;

/** A main clause that only asks "what now?" — its condition carries the topic. */
const GENERIC_DO = /^(do|робити|зробити|делать|сделать|robić|zrobić|daryti|padaryti|tegema|teha)$/u;

/** A yes/no about training at all ("should I skip the gym", "пропускати зал?"). */
const GENERIC_TRAIN =
  /^(skip|train|go|lift|work|workout|miss|keep|continue|exercise|пропускати|пропустити|тренуватися|тренуватись|тренувати|йти|піти|ходити|качатися|займатися|пропускать|тренироваться|идти|ходить|заниматься|trenować|iść|chodzić|ćwiczyć|opuścić|sportuoti|treniruotis|eiti|praleisti|treenima|minema|käima|jätma)$/u;
/** Words that only say "training" — no topic of their own. */
const TRAIN_WORD =
  /^(gym|workout|training|train|session|lift|lifting|exercise|зал|тренування|трен|тренировка|зала|siłownia|silownia|trening|sale|sporto|treniruotė|jõusaal|trenn|treening)$/u;

/** Atlas justifying its pick: "why do you suggest / give me / put…". */
const SUGGEST =
  /^(suggest|recommend|give|put|make|pick|choose|add|want|keep|tell|include|пропонувати|радити|давати|ставити|обирати|вибирати|додавати|хотіти|казати|предлагать|советовать|давать|ставить|выбирать|добавлять|proponować|polecać|dawać|dodawać|wybierać|siūlyti|duoti|rinktis|pridėti|pakuma|soovitama|andma|panema|valima|lisama)$/u;

/** Asking for advice: evaluative words in the question. */
const EVAL =
  /^(best|better|worth|good|bad|ok|okay|fine|safe|enough|normal|найкращий|кращий|краще|варто|добре|погано|нормально|безпечно|достатньо|лучше|лучший|стоит|хорошо|плохо|najlepszy|lepszy|lepiej|warto|dobrze|źle|bezpieczny|geriausias|geriau|verta|gerai|blogai|parim|parem|tasub|hea|halb)$/u;

/** "…, good or bad" / "добре чи погано" — a verbless choice that asks. */
const ASK_TAIL =
  /(good or bad|yes or no|worth it|ok or not|okay or not|добре чи погано|так чи ні|варто чи ні|норм чи ні|хорошо или плохо|да или нет|dobrze czy źle|dobrze czy zle|tak czy nie|warto czy nie|gerai ar blogai|taip ar ne|verta ar ne|hea või halb|hea voi halb|jah või ei|jah voi ei)\s*[?!.]*$/iu;

/** Stems of "suggest / recommend / give" when the verb is not in the lexicon. */
const SUGGEST_STEM =
  /^(suggest|recommend|пропону|радиш|радите|рекоменд|даєш|ставиш|вибираєш|предлага|совету|рекоменду|proponuj|polecasz|polecisz|dajesz|siūl|siul|rekomend|soovit|pakud|annad)/u;

/** Pain predicates (lemmas and folded stems). */
const PAIN =
  /^(hurt|ache|pain|sore|боліти|болить|болять|болеть|болит|boleć|bolec|boli|bolą|bola|skaudėti|skaudeti|skauda|skausti|valutama|valutab|valutavad|valu)$/u;
/** "no longer" — a denied pain that used to be there (a recovery, not a context). */
const NO_LONGER =
  /^(anymore|longer|вже|уже|більше|больше|już|juz|więcej|wiecej|jau|nebe|nebeskauda|enam|rohkem|juba)$/u;

/** Growth words: big, mass, muscle, bulk… */
const GROWTH =
  /^(big|bigger|huge|jacked|swole|mass|muscle|muscles|bulk|size|масу|маса|масса|масы|мязи|м’язи|м'язи|мʼязи|мышцы|великим|большим|masę|masa|masy|mięśnie|miesnie|mięśni|miesni|duży|duzy|większy|wiekszy|masės|mases|masę|raumenų|raumenu|raumenis|didesnis|massi|mass|lihaseid|lihasmassi|suuremaks|suureks)$/u;

/** "Tell / show / explain (me)…" — a frame around the real question. */
const TELL =
  /^(tell|show|explain|say|give|скажи|сказати|скажіть|покажи|показати|поясни|пояснити|розкажи|розказати|дай|скажи|покажи|объясни|расскажи|powiedz|powiedzieć|pokaż|pokaz|pokazać|wyjaśnij|wytłumacz|daj|pasakyk|pasakyti|parodyk|parodyti|paaiškink|duok|ütle|ütelda|öelda|naita|näita|näidata|selgita|anna)$/u;
const ME_OBJ = /^(me|мені|мне|mi|mnie|man|mulle|mul)$/u;

/** Pronouns that point back at the clause before ("does THAT count", "це зараховується"). */
const ANAPHOR = /^(that|it|this|це|то|это|to|tai|see|seda)$/u;

/** "instead of X," / "замість X," — the X is set aside. */
const INSTEAD = /^(instead|замість|вместо|zamiast|vietoj|asemel)$/u;

const PERSON_NOUN =
  /^(girlfriend|boyfriend|wife|husband|friend|dad|father|mom|mum|mother|son|daughter|brother|sister|coach|trainer|client|partner|colleague|дівчина|хлопець|дружина|чоловік|друг|подруга|тато|батько|мама|син|донька|дочка|брат|сестра|тренер|клієнт|колега|девушка|парень|жена|муж|отец|мать|сын|дочь|клиент|dziewczyna|chłopak|żona|mąż|przyjaciel|kolega|tata|ojciec|mama|matka|syn|córka|brat|siostra|trener|klient|mergina|vaikinas|žmona|vyras|draugas|tėtis|tėvas|mama|sūnus|dukra|brolis|sesuo|treneris|klientas|tüdruksõber|poiss|naine|mees|sõber|isa|ema|poeg|tütar|vend|õde|treener|klient)$/u;

const PAST_TIME = /^(yesterday|last_|day_before|this_morning|earlier)/;
const FUTURE_TIME = /^(tomorrow|next_|tonight|later|day_after)/;

// ---- helpers ---------------------------------------------------------------------

const words = (ts: Token[]): Token[] => ts.filter((t) => t.pos !== 'PUNCT' && t.pos !== 'X');

/** A word that carries meaning (a noun, a content verb, an adjective), not a pronoun. */
const NOT_CONTENT =
  /^(довго|долго|чого|чего|так|long|so|that|this|it|це|то|это|to|tai|see|seda|there|here|тут|там)$/u;

function contentful(ts: Token[]): boolean {
  return ts.some(
    (t) =>
      (t.pos === 'NOUN' && !NOT_CONTENT.test(t.norm)) ||
      t.pos === 'NUM' ||
      (t.pos === 'VERB' &&
        !/^(be|have|do|get|go|know|think|mean|бути|мати|робити|быть|иметь|делать|być|mieć|robić|būti|turėti|daryti|olema|omama|tegema)$/u.test(
          t.lemma,
        )),
  );
}

/** Character span of some clauses in the original text. */
function spanOf(text: string, cls: Clause[]): string {
  const ts = cls.flatMap((c) => c.tokens).filter((t) => t.pos !== 'PUNCT' || /[?]/.test(t.text));
  if (!ts.length) return '';
  const from = Math.min(...ts.map((t) => t.start));
  const to = Math.max(...ts.map((t) => t.start + t.text.length));
  return text
    .slice(from, Math.min(text.length, to))
    .replace(/^[\s,;:.–—-]+|[\s,;:–—-]+$/gu, '')
    .trim();
}

const isAskVerb = (c: Clause): boolean =>
  !!c.predicate && ASK_VERB.test(c.predicate.lemma) && !c.interrogative;

const painClause = (c: Clause): boolean =>
  (!!c.predicate && PAIN.test(c.predicate.lemma)) ||
  c.tokens.some((t) => PAIN.test(t.norm) || PAIN.test(t.lemma) || /^(ne|nebe)skaud/u.test(t.norm));
const deniedPain = (c: Clause): boolean =>
  (c.negated || c.tokens.some((t) => /^(ne|nebe)skaud/u.test(t.norm))) && painClause(c);

function dismissive(c: Clause): boolean {
  const lem = c.predicate?.lemma ?? '';
  const ws = words(c.tokens);
  if (!ws.length) return false;
  // "Nothing hurts, what should I train?" — the denied pain is only context.
  if (deniedPain(c) && !c.tokens.some((t) => NO_LONGER.test(t.norm)) && !c.interrogative)
    return true;
  // "forget cardio" / "кардіо забудь" (a command to set it aside)
  if (/^(forget|забути|забыть|zapomnieć|pamiršti|unustama)$/u.test(lem) && c.mood === 'imperative')
    return true;
  // "I don't care about abs", "про дієту не питаю", "прес мені не цікавий"
  if (c.negated && DISMISS.test(lem)) return true;
  if (c.negated && ws.some((t) => /^(цікав|интерес|interes|domin|huvit)/u.test(t.norm)))
    return true;
  // "not today", "не про сьогодні", "not asking about diet" (no finite verb of its own)
  const first = ws[0]?.norm ?? '';
  if (/^(not|не|nie|ne|ei)$/u.test(first) && ws.length <= 4 && !c.interrogative) return true;
  return false;
}

/** Verbs that only ask for a pick or an opinion ("what to choose", "what do you think"). */
const GENERIC_ASK =
  /^(what|co|ka|ką|mis|mida|що|шо|что|choose|pick|prefer|think|recommend|suggest|advise|say|do|be|wybrać|wybierać|polecić|polecać|radzić|myśleć|sądzić|robić|być|rinktis|pasirinkti|patarti|manyti|daryti|būti|valima|soovitama|arvama|tegema|olema|обрати|вибрати|обирати|порадити|радити|думати|робити|бути|выбрать|посоветовать|думать|делать|быть)$/u;

/**
 * A part with no topic of its own — "co wybrać", "what do you think",
 * "which is better": it finishes the question before it.
 */
export function bareAsk(text: string): boolean {
  const ts = readTokens(text);
  if (!ts.length) return true;
  // Bare = only function words, "choose / think / do", and "better / best".
  return ts.every(bareToken);
}
function bareToken(t: Token): boolean {
  return (
    GENERIC_ASK.test(t.lemma) ||
    GENERIC_ASK.test(t.norm) ||
    EVAL_BARE.test(t.norm) ||
    t.pos === 'PRON' ||
    t.pos === 'DET' ||
    t.pos === 'AUX' ||
    t.pos === 'PART' ||
    t.pos === 'CONJ' ||
    t.pos === 'SCONJ' ||
    t.pos === 'ADP' ||
    t.pos === 'INTJ'
  );
}
const EVAL_BARE =
  /^(better|best|good|lepszy|lepsze|lepiej|najlepszy|geresnis|geriau|geriausia|parem|parim|кращий|краще|лучше|ok|okay|lol)$/u;

/** Words a follow-up leans on without naming anything ("which ONE", "why do you think SO"). */
const FOLLOW_FILLER =
  /^(one|so|then|really|exactly|even|me|for|just|that|this|it|think|say|mean|сказав|думаєш|вважаєш|так|саме|ну|то|тоді|думаешь|считаешь|именно|тогда|tak|więc|wiec|myślisz|sądzisz|taip|manai|nu|siis|arvad|arvate)$/u;

/**
 * A follow-up that names nothing of its own — "which one is better for me",
 * "why do you think so", "how so" — it asks about the topic before it.
 */
export function bareFollow(text: string): boolean {
  const ts = readTokens(text);
  if (!ts.length) return false;
  return ts.every(
    (t) =>
      FOLLOW_FILLER.test(t.norm) ||
      bareToken(t) ||
      /^(why|how|which|чому|чого|як|який|яка|яке|почему|какой|dlaczego|czemu|jak|który|która|kodėl|kaip|kuris|kuri|miks|kuidas|kumb)$/u.test(
        t.norm,
      ),
  );
}

/**
 * Third-person pronouns that point back at the thing the last message was
 * about ("is IT safe", "а ВІН не шкідливий", "czy TO bezpieczne", "kas SEE"),
 * per language — "to" is Polish, not the English infinitive.
 */
const BACK_PRON: Record<Lang, RegExp> = {
  en: /^(it|its|them|they|these|those|that|this)$/u,
  uk: /^(це|цього|цьому|цим|його|її|їх|їм|ним|ними|ній|нього|неї|нею|він|вона|воно|вони)$/u,
  ru: /^(это|этого|этому|этим|его|ее|её|их|им|ним|ними|ней|него|нее|неё|нем|он|она|оно|они)$/u,
  pl: /^(to|tego|temu|tym|go|jego|jej|je|ich|nim|niej|niego|nią|nia|on|ona|ono|oni|one)$/u,
  lt: /^(tai|tą|ta|jį|ji|ją|jis|jie|jos|juos|jo|jam|jų|jais)$/u,
  et: /^(see|seda|selle|sellest|sellega|need|neid|nende|teda|tema|ta)$/u,
};

/** Verbs that carry no topic of their own in "how do I DO…", "should I TAKE…". */
const LIGHT_VERB =
  /^(do|does|doing|did|take|taking|use|using|get|make|try|start|fix|improve|be|have|робити|зробити|пити|брати|приймати|використовувати|почати|делать|сделать|пить|брать|принимать|robić|zrobić|brać|pić|stosować|daryti|gerti|vartoti|imti|tegema|võtma|jooma|kasutama)$/u;

/**
 * What the last message was about, as words that can stand in for a pronoun:
 * "should i take creatine" → "creatine", "що таке суперсет" → "суперсет",
 * "how to do face pulls" → "face pulls". Null when it names nothing.
 */
export function antecedent(text: string): string | null {
  const ts = readTokens(text);
  const keep = ts.filter(
    (t, i) =>
      t.pos === 'NOUN' ||
      t.pos === 'NUM' ||
      (t.pos === 'ADJ' && ts.slice(i + 1).some((u) => u.pos === 'NOUN' || u.pos === 'VERB')) ||
      // A lift name the tagger read as a verb ("face PULLS", "romanian DEADLIFT").
      (t.pos === 'VERB' &&
        !LIGHT_VERB.test(t.norm) &&
        !LIGHT_VERB.test(t.lemma) &&
        i > 0 &&
        (ts[i - 1].pos === 'NOUN' || ts[i - 1].pos === 'ADJ')),
  );
  const nouns = keep.filter((t) => !NOT_CONTENT.test(t.norm));
  if (nouns.length) return nouns.map((t) => t.text).join(' ');
  // "am I overtraining" — no noun: the one content verb is the subject matter.
  const verb = ts.find(
    (t) => t.pos === 'VERB' && !LIGHT_VERB.test(t.norm) && !LIGHT_VERB.test(t.lemma),
  );
  return verb ? verb.text : null;
}

/**
 * The message with its first back-pointing pronoun replaced by the thing it
 * points at: "when should i take it" + "creatine" → "when should i take
 * creatine". Null when the message has no such pronoun.
 */
export function resolveAnaphor(text: string, ante: string): string | null {
  const lang = understand(text).lang;
  const re = BACK_PRON[lang];
  if (!re) return null;
  let done = false;
  const out = text.split(/(\s+)/u).map((w) => {
    if (done) return w;
    const m = /^([^\p{L}\p{N}]*)([\p{L}\p{N}’'ʼ]+)([^\p{L}\p{N}]*)$/u.exec(w);
    if (!m || !re.test(m[2].toLowerCase())) return w;
    done = true;
    return `${m[1]}${ante}${m[3]}`;
  });
  return done ? out.join('') : null;
}

const tokMemo = new Map<string, Token[]>();
function readTokens(text: string): Token[] {
  let v = tokMemo.get(text);
  if (!v) {
    try {
      v = words(analyze(text).sentences.flatMap((s) => s.tokens));
    } catch {
      v = [];
    }
    tokMemo.set(text, v);
    if (tokMemo.size > 64) tokMemo.delete(tokMemo.keys().next().value as string);
  }
  return v;
}

function blank(): Understanding {
  return {
    lang: 'en',
    sentences: 1,
    clauses: 1,
    question: false,
    command: false,
    report: false,
    plan: false,
    complaint: false,
    other: false,
    conditional: false,
    negated: false,
    asks: 0,
    wantsGrowth: false,
    painNegated: false,
    cond: null,
    fear: false,
    hypothetical: false,
    qText: null,
    pastAsk: false,
    advice: false,
    whyAtlas: false,
    focus: null,
    focusShare: 1,
    f: {
      askedAbout: [],
      isReportAboutSelf: false,
      isComplaint: false,
      isRequestForHelp: false,
      isQuestion: false,
      timeRefs: [],
      quantities: [],
      conditionals: [],
      negated: false,
    },
  };
}

// ---- the reading -------------------------------------------------------------------

function read(text: string): Understanding {
  let a: Analysis;
  try {
    a = analyze(text);
  } catch {
    a = { lang: 'en', sentences: [] };
  }
  const f = grammarFocus(a);
  const all = a.sentences.flatMap((s) => s.clauses.map((c) => ({ s, c })));
  const question = a.sentences.some((s) => s.type === 'question') || ASK_TAIL.test(text.trim());
  const command = a.sentences.some((s) => s.type === 'command');
  const userClause = (c: Clause) =>
    c.subjectIsUser || (!c.subject && c.person === 1 && !c.subjectIsAtlas);
  // "I danced for 2 hours today, why no comment?" — the telling clause reports,
  // whatever the sentence goes on to ask.
  const report = all.some(
    ({ s, c }) =>
      userClause(c) &&
      c.tense === 'past' &&
      !c.interrogative &&
      c.mood !== 'imperative' &&
      c.role !== 'subordinate' &&
      s.type !== 'command',
  );
  const plan = all.some(
    ({ c }) =>
      userClause(c) &&
      !c.interrogative &&
      (c.tense === 'future' ||
        c.tokens.some((t) =>
          /^(going|збираюсь|збираюся|собираюсь|zamierzam|ketinu|kavatsen)$/u.test(t.norm),
        )),
  );
  const mainOf = (s: Sentence): Clause | undefined => s.clauses[s.questionClause ?? s.mainClause];
  const lastQ = [...a.sentences].reverse().find((s) => s.type === 'question') ?? a.sentences[0];
  const mc = lastQ ? mainOf(lastQ) : undefined;
  const subjTok = mc?.subject
    ? lastQ?.tokens[mc.subject.tokens[mc.subject.tokens.length - 1]]
    : undefined;
  const firstMain = a.sentences[0]?.clauses[a.sentences[0].mainClause];
  const firstSubj = firstMain?.subject
    ? a.sentences[0].tokens[firstMain.subject.tokens[firstMain.subject.tokens.length - 1]]
    : undefined;
  const other =
    !!(subjTok && PERSON_NOUN.test(subjTok.lemma)) ||
    !!(firstSubj && PERSON_NOUN.test(firstSubj.lemma) && !firstMain?.subjectIsUser);
  const out: Understanding = {
    lang: a.lang,
    sentences: a.sentences.length,
    clauses: all.length,
    question,
    command,
    report,
    plan,
    complaint:
      f.isComplaint &&
      !command &&
      all.some(
        ({ s: st, c }) =>
          c.subjectIsAtlas &&
          c.mood !== 'imperative' &&
          (st.type !== 'question' ||
            c.tokens.some((t) =>
              /(ignor|forg[eo]t|ігнор|забу|игнор|забы|zapomn|pamir|unusta)/u.test(t.lemma),
            )),
      ),
    other,
    conditional: f.conditionals.length > 0,
    negated: !!mc?.negated,
    asks: all.filter(({ c }) => c.interrogative && c.role !== 'subordinate').length,
    wantsGrowth: all.some(
      ({ c }) =>
        !c.negated &&
        (c.modality === 'want' ||
          /^(want|хотіти|хотеть|chcieć|norėti|tahtma)$/u.test(c.predicate?.lemma ?? '')) &&
        c.tokens.some((t) => GROWTH.test(t.norm)),
    ),
    painNegated:
      all.some(({ c }) => deniedPain(c)) && !all.some(({ c }) => painClause(c) && !deniedPain(c)),
    cond: null,
    fear: false,
    hypothetical: false,
    qText: null,
    pastAsk: false,
    advice: false,
    whyAtlas: false,
    focus: null,
    focusShare: 1,
    f,
  };
  const qs = [...a.sentences].reverse().find((x) => x.type === 'question');
  if (qs) {
    // "am I losing weight or what?" — the tag asks nothing of its own.
    const tagged = qs.clauses[qs.questionClause ?? qs.mainClause];
    const qc =
      tagged && !tagged.predicate && words(tagged.tokens).length <= 2
        ? (qs.clauses.find((c) => c.interrogative && !!c.predicate) ?? tagged)
        : tagged;
    if (qc) {
      const deps = qs.clauses.filter(
        (c, k) => k > (qs.questionClause ?? qs.mainClause) && c.role === 'subordinate',
      );
      out.qText = spanOf(text, [qc, ...deps]) || null;
      // "Did I…", "have I been…", "am I losing weight?" — about what the log shows.
      out.pastAsk =
        userClause(qc) &&
        qc.interrogative &&
        !qc.modality &&
        (qc.tense === 'past' || qc.aspect === 'progressive' || qc.aspect === 'perfect');
      out.advice =
        (!!qc.modality && qc.modality !== 'want' && !qc.subjectIsAtlas) ||
        /^(need|треба|потрібно|потребувати|нужно|надо|potrzebować|musieć|reikėti|reikia|vajama|pidama)$/u.test(
          qc.predicate?.lemma ?? '',
        ) ||
        qc.tokens.some((t) => EVAL.test(t.norm) || EVAL.test(t.lemma));
      out.whyAtlas =
        (qs.whWord === 'why' || qc.whWord === 'why') &&
        qc.subjectIsAtlas &&
        !qc.negated &&
        ((!!qc.predicate && SUGGEST.test(qc.predicate.lemma)) ||
          qc.tokens.some((t) => SUGGEST_STEM.test(t.norm)));
    }
  }
  // Conditions by their connector, in every language (the parser knows "if").
  const cond = conditionOf(text);
  if (cond) {
    out.cond = cond;
    out.conditional = true;
  }
  out.fear = FEAR.test(fold(text.toLowerCase()));
  out.hypothetical = out.conditional && !report;
  const pick = (cond && condFocus(cond, text)) || chooseFocus(text, a);
  if (pick) {
    const total = words(a.sentences.flatMap((s) => s.tokens)).length || 1;
    const kept = pick.text.split(/\s+/u).filter(Boolean).length;
    if (pick.text && kept < total && (kept >= 2 || pick.why === 'condition')) {
      out.focus = pick.text;
      out.focusWhy = pick.why;
      out.focusShare = kept / total;
    }
  }
  // Time words say more than tense alone: "tomorrow" plans, "yesterday" reports.
  if (!out.plan && f.timeRefs.some((t) => FUTURE_TIME.test(t)) && !report) out.plan = !question;
  if (!out.report && f.timeRefs.some((t) => PAST_TIME.test(t)) && !question && !command)
    out.report = all.some(({ c }) => userClause(c) && c.tense !== 'future');
  return out;
}

type Pick = { text: string; why: NonNullable<Understanding['focusWhy']> };

/** Connectors that open a condition (folded; longest first within a kind). */
const COND_OPEN: [NonNullable<Understanding['cond']>['kind'], RegExp][] = [
  [
    'neg',
    /^(unless|except if|якщо не|коли не|если не|chyba ze|chyba że|jesli nie|jeśli nie|nebent|jei ne|kui just|kui ei)\s/u,
  ],
  [
    'hyp',
    /^(in case|just in case|if ever|на випадок якщо|на випадок коли|на всякий випадок якщо|якщо раптом|на случай если|если вдруг|na wypadek gdyby\S*|na wypadek jesli|na wypadek jeśli|gdyby\S*|jei kartais|jeigu kartais|juhuks kui|kui peaks)\s/u,
  ],
  [
    'while',
    /^(as long as|provided that|provided|so long as|поки|доки|пока|o ile|dopoki|dopóki|kol|kolei|seni kuni|niikaua kui|kuni)\s/u,
  ],
  [
    'even',
    /^(even if|even though|навіть якщо|хоч би|даже если|nawet jesli|nawet jeśli|nawet gdy|net jei|net jeigu|isegi kui|kasvõi|kasvoi)\s/u,
  ],
  [
    'if',
    /^(if|once|whenever|when|якщо|коли|як тільки|если|когда|как только|jesli|jeśli|jezeli|jeżeli|gdy|kiedy|jak tylko|jei|jeigu|kai|kada|kui|kuna)\s/u,
  ],
];

/** Where a leading condition ends: a comma, else a question word / modal. */
const COND_END =
  /,|\s(should|can|could|will|would|is it|is that|do i|does it|what|how|чи|що|як|можна|треба|czy|co|jak|mogę|moge|ar|ką|ka|kaip|galiu|kas|mida|kuidas|kas ma)\s/u;

function conditionOf(text: string): Understanding['cond'] {
  const t = fold(text.toLowerCase()).trim();
  for (const [kind, re] of COND_OPEN) {
    const m = re.exec(`${t} `);
    if (!m) continue;
    const rest = t.slice(m[0].length);
    const e = COND_END.exec(` ${rest} `);
    if (!e || e.index <= 1) return null;
    // Cut the original text at the same places (folding keeps the length).
    const orig = text.toLowerCase().trim();
    const at = orig.length === t.length ? orig : t;
    const from = m[0].length;
    const cond = at.slice(from, from + e.index - 1).trim();
    const main = at
      .slice(from + e.index - 1)
      .replace(/^[\s,]+/u, '')
      .trim();
    if (!cond || main.split(/\s+/u).length < 2) return null;
    return { kind, text: cond, main };
  }
  return null;
}

/** A main clause that only asks "should I train / skip / what now?". */
const BARE_MAIN = foldRe(
  /^(should|can|could|will|is it ok to|is it fine to|do i|what|what should|what do|чи|що|можна|треба|czy|co|mogę|moge|ar|ką|ka|galiu|kas|mida|kas ma)?\s*(i|я|ma)?\s*(still|все одно|всё равно|nadal|vis tiek|ikka)?\s*(train|go|skip|lift|workout|go to the gym|do|work out|тренуватись|тренуватися|йти|піти|пропускати|пропустити|робити|тренироваться|идти|пропускать|делать|trenować|ćwiczyć|iść|odpuścić|robić|sportuoti|treniruotis|eiti|praleisti|daryti|treenida|minna|jätta|teha)?(\s*(na|do|w|to|в|у|į|i)?\s*(the gym|the workout|today|зал|тренування|na siłownię|trening\S*|į salę|treniruotę|jõusaali|trenn|trenni|vahele|salę|сьогодні|сегодня|dzisiaj|dziś|šiandien|täna|or not|чи ні|czy nie|ar ne|või mitte))*\s*\??$/u,
);

/** A main clause asking only permission: "can I squat", "ar galiu tūpti". */
const PERMIT = foldRe(
  /^(can i|may i|should i|is it ok to|чи можна|можна|чи можу|чи варто|czy mogę|czy moge|czy można|ar galiu|ar gali|ar verta|kas ma võin|kas võin|kas tohin|kas ma tohin)(\s+\S+){1,2}\s*\??$/u,
);

/**
 * The part a condition leaves to answer: under "unless / in case / as long as"
 * the main question (the condition only limits it); when the main clause is
 * bare ("should I skip?", "gym or not?") the condition itself is the topic.
 */
function condFocus(c: NonNullable<Understanding['cond']>, text: string): Pick | null {
  const main = fold(c.main.trim());
  // "Even if my knee hurts, can I squat?" — the obstacle is the question when
  // the main clause only asks permission to go on.
  const bare = BARE_MAIN.test(main) || (c.kind === 'even' && PERMIT.test(main));
  const out = bare ? c.text : c.kind === 'if' ? null : c.main;
  if (!out || out.length >= fold(text.toLowerCase()).length - 2) return null;
  return { text: out, why: 'condition' };
}

/** Worry, not a report ("afraid of getting stuck", "боюсь застрягти", "bijau"). */
const FEAR = foldRe(
  /(^|[^\p{L}])(afraid|scared|worried|worry|fear|frightened|nervous about|боюсь|боюся|боїться|страшно|лякає|переживаю|боюсь|страшно|boję się|obawiam się|strach|bijau|baisu|nerimauju|kardan|pelgan|hirm|mures)(?=$|[^\p{L}])/u,
);

function chooseFocus(text: string, a: Analysis): Pick | null {
  let why: Pick['why'] | null = null;
  // 1) Pleasantry sentences around the real one.
  let sents = a.sentences;
  if (sents.length >= 2) {
    const kept = sents.filter(
      (s) =>
        !PLEASANTRY.test(
          words(s.tokens)
            .map((t) => t.norm)
            .join(' '),
        ),
    );
    if (kept.length && kept.length < sents.length) {
      sents = kept;
      why = 'pleasantry';
    }
  }
  // The rest works inside the sentence that asks (the last question), or the
  // only one left.
  const qi = (() => {
    for (let k = sents.length - 1; k >= 0; k--) if (sents[k].type === 'question') return k;
    return sents.length === 1 ? 0 : -1;
  })();
  if (qi < 0) return why ? { text: sents.map((s) => s.text).join(' '), why } : null;
  const s = sents[qi];
  const before = sents.slice(0, qi);
  const after = sents.slice(qi + 1);
  const inner = focusInSentence(text, s);
  if (inner) {
    // Earlier sentences stay (context) only when the rule kept the whole sentence.
    return { text: inner.text, why: inner.why };
  }
  if (why) return { text: [...before, s, ...after].map((x) => x.text).join(' '), why };
  return null;
}

/** Words that negate on their own (the verb may also carry it: nenoriu, ei…). */
const NEG_WORD = /^(not|dont|don't|do|never|не|ні|нет|nie|ne|ei|pole)$/u;

/**
 * "nie chcę schudnąć, chcę masę" — when the parser keeps it as one clause:
 * the same verb, denied before the comma and said after it.
 */
function commaAlternative(text: string, s: Sentence): Pick | null {
  const ts = s.tokens;
  const cut = ts.findIndex((t) => t.text === ',');
  if (cut <= 0 || cut >= ts.length - 1) return null;
  const a = words(ts.slice(0, cut));
  const b = words(ts.slice(cut + 1));
  if (a.length < 2 || b.length < 1) return null;
  const neg = (xs: Token[]) =>
    xs.some((t) => NEG_WORD.test(t.norm) || t.feats.neg || /^(ne|nebe)\p{L}{4,}/u.test(t.norm));
  const verbs = (xs: Token[]) =>
    xs.filter((t) => t.pos === 'VERB' || t.pos === 'AUX').map((t) => t.lemma);
  const va = verbs(a);
  const shared = verbs(b).some((l) => va.includes(l));
  if (neg(a) && !neg(b) && shared && contentful(b)) {
    const from = ts[cut + 1].start;
    return { text: text.slice(from).trim(), why: 'alternative' };
  }
  return null;
}

/**
 * "Can you tell me my best squat?", "можеш сказати мій найкращий присід",
 * "pokaż mi mój plan" — the request frame goes; what follows the verb is asked.
 */
/** Words that point back to what was said before them. */
const AGAIN =
  /^(again|too|also|either|знову|теж|також|снова|опять|тоже|znowu|znów|znow|ponownie|też|tez|vėl|vel|irgi|jälle|jalle|uuesti|ka)$/u;

const HABIT =
  /^(keep|keeps|kept|always|constantly|again|still|продовжуєш|постійно|завжди|знову|весь|всё|постоянно|опять|ciągle|ciagle|zawsze|znowu|vis|visada|nuolat|vėl|vel|alati|ikka|jälle|jalle|pidevalt)$/u;

function requestFrame(text: string, s: Sentence): Pick | null {
  const ws = words(s.tokens);
  const k = ws.findIndex((t) => TELL.test(t.norm) || TELL.test(t.lemma));
  if (k < 0 || k > 3) return null;
  // Only a frame when it opens the sentence: "(can you / можеш) tell (me) …".
  const before = ws.slice(0, k);
  if (
    !before.every(
      (t) =>
        t.pos === 'AUX' ||
        t.pos === 'PRON' ||
        t.pos === 'VERB' ||
        t.pos === 'PART' ||
        t.pos === 'ADV',
    )
  )
    return null;
  // "You keep giving me the same answer" tells a habit, it asks for nothing.
  if (before.some((t) => HABIT.test(t.norm) || HABIT.test(t.lemma))) return null;
  let j = k + 1;
  while (j < ws.length && ME_OBJ.test(ws[j].norm)) j++;
  const rest = ws.slice(j);
  if (
    rest.length < 2 ||
    !contentful(rest) ||
    rest.some((t) => t.pos === 'SCONJ' || !!t.dep?.startsWith('mark'))
  )
    return null;
  return { text: text.slice(rest[0].start).trim(), why: 'request' };
}

/** "What's the point of X?" / "який сенс у X" — a why-question about X. */
const POINT_OF =
  /^\s*(what'?s|what is|whats) the (point|use|purpose) of\s+|^\s*(який|яка) (сенс|користь) (у|в|від)\s+|^\s*(jaki|jaki jest) sens\s+|^\s*(kokia|kokia yra) (prasmė|prasme|nauda)\s+|^\s*(mis|mis on) (mõte|mote|kasu)\s+/iu;

function focusInSentence(text: string, s: Sentence): Pick | null {
  const cl = s.clauses;
  const pt = POINT_OF.exec(s.text);
  if (pt && s.text.length - pt[0].length > 3)
    return { text: `why ${s.text.slice(pt[0].length)}`.trim(), why: 'request' };
  const alt = commaAlternative(text, s);
  if (alt) return alt;
  const req = requestFrame(text, s);
  if (req) return req;
  if (cl.length < 2) {
    // "instead of the plan for today, tell me about tomorrow" — one clause, an aside inside.
    const ws = words(s.tokens);
    const k = ws.findIndex((t) => INSTEAD.test(t.norm));
    if (k === 0) {
      const comma = s.tokens.findIndex((t, i) => i > s.tokens.indexOf(ws[k]) && t.text === ',');
      if (comma > 0) {
        const rest = text.slice(s.tokens[comma].start + 1).trim();
        if (rest.split(/\s+/u).length >= 2) return { text: rest, why: 'dismiss' };
      }
    }
    return null;
  }
  // a) Dismissed subjects: drop the clause that waves them away.
  const dis = cl.map(dismissive);
  if (dis.some(Boolean) && dis.some((d) => !d)) {
    const keep = cl.filter((_, k) => !dis[k]);
    if (keep.some((c) => contentful(c.tokens))) return { text: spanOf(text, keep), why: 'dismiss' };
  }
  // b) Contrast: "X, but Y?" — Y is the point when X is settled or Y asks.
  const ci = contrastAt(s);
  if (ci > 0) {
    const pre = cl.slice(0, ci);
    const post = cl.slice(ci);
    const postAsks = post.some((c) => c.interrogative);
    const settled = pre.some((c) =>
      c.tokens.some((t) => SETTLED.test(t.norm) || SETTLED.test(t.lemma)),
    );
    const postContent = contentful(post.flatMap((c) => c.tokens));
    // "…but today can I bench again?" — "again" leans on the first part.
    const leans = post.some((c) => c.tokens.some((t) => AGAIN.test(t.norm)));
    if (postContent && !leans && (postAsks || settled))
      return { text: spanOf(text, post), why: 'contrast' };
  }
  // c) Negated alternative: "I don't want to lose weight, I want muscle".
  for (let k = 0; k + 1 < cl.length; k++) {
    const c1 = cl[k];
    const c2 = cl[k + 1];
    if (!c1.negated || c2.negated || c1.role === 'subordinate') continue;
    const same = !!c1.predicate && !!c2.predicate && c1.predicate.lemma === c2.predicate.lemma;
    const wants =
      !c2.interrogative &&
      (c2.modality === 'want' ||
        /^(want|хотіти|хотеть|chcieć|norėti|tahtma)$/u.test(c2.predicate?.lemma ?? ''));
    const orders = c1.mood === 'imperative' && (c2.mood === 'imperative' || c2.interrogative);
    if (same || wants || orders) {
      const keep = cl.filter((_, j) => j !== k);
      if (contentful(keep.flatMap((c) => c.tokens)))
        return { text: spanOf(text, keep), why: 'alternative' };
    }
  }
  // d) Embedded question: "my girlfriend asks how much protein she needs",
  //    "do you know how to fix knee valgus", "i want to know how long to rest".
  const emb = cl.findIndex(
    (c, k) =>
      k > 0 &&
      c.role === 'subordinate' &&
      c.kind === 'complement' &&
      (!!c.whWord || WH_START.test(words(c.tokens)[0]?.norm ?? '')) &&
      contentful(c.tokens),
  );
  if (
    emb > 0 &&
    cl
      .slice(0, emb)
      .some(
        (c) =>
          isAskVerb(c) ||
          (c.interrogative &&
            /^(know|знати|знать|wiedzieć|žinoti|teadma)$/u.test(c.predicate?.lemma ?? '')),
      )
  ) {
    return { text: spanOf(text, cl.slice(emb)), why: 'embedded' };
  }
  // e) "If I only have 30 minutes, what should I do?", "if I get sick, should I
  //    skip the gym?" — the main clause only asks "what now / train or not?":
  //    the condition is the topic.
  const qc = s.questionClause !== undefined ? cl[s.questionClause] : undefined;
  const bare = (c: Clause) =>
    !contentful(
      c.tokens.filter(
        (t) =>
          t.lemma !== c.predicate?.lemma && !TRAIN_WORD.test(t.norm) && !TRAIN_WORD.test(t.lemma),
      ),
    );
  const genericDo =
    !!qc?.predicate &&
    GENERIC_DO.test(qc.predicate.lemma) &&
    qc.whWord === 'what' &&
    !qc.objects.length &&
    !qc.adverbials.length &&
    bare(qc);
  const genericTrain =
    !!qc?.predicate &&
    GENERIC_TRAIN.test(qc.predicate.lemma) &&
    (!qc.whWord || qc.whWord === 'how') &&
    bare(qc);
  if (qc && (genericDo || genericTrain)) {
    const cond = cl.filter(
      (c) => c.role === 'subordinate' && (c.kind === 'conditional' || c.kind === 'temporal'),
    );
    if (cond.length && contentful(cond.flatMap((c) => c.tokens))) {
      const t = spanOf(text, cond).replace(
        /^(if|when|якщо|коли|если|когда|jeśli|jesli|jeżeli|gdy|kiedy|jei|kai|kui)\s+/iu,
        '',
      );
      return { text: t, why: 'condition' };
    }
  }
  // f) "I'm going to swim tomorrow, does THAT count as cardio?" — the pronoun
  //    stands for the clause before it: put that clause's action in its place
  //    (without its time words — "tomorrow" is the story, not the question).
  const ana = anaphora(text, s);
  if (ana) return ana;
  return null;
}

function anaphora(text: string, s: Sentence): Pick | null {
  const cl = s.clauses;
  const k = s.questionClause;
  if (k === undefined || k < 1) return null;
  const qc = cl[k];
  const qws = words(qc.tokens);
  const pro = qws.find(
    (t, i) => ANAPHOR.test(t.norm) && (i <= 1 || t.dep === 'nsubj' || t.dep === 'obj'),
  );
  if (!pro) return null;
  let ante: Clause | undefined;
  for (let j = k - 1; j >= 0; j--)
    if (!cl[j].interrogative && cl[j].role !== 'subordinate' && cl[j].predicate) {
      ante = cl[j];
      break;
    }
  // "I went for a run, does it count?" — a report asked about stays whole (it is logged).
  if (!ante || ante.tense === 'past') return null;
  const timeIdx = new Set(ante.adverbials.filter((x) => x.sem === 'time').flatMap((x) => x.tokens));
  const at = ante;
  const idxOf = new Map(at.tokens.map((t, i) => [t, at.tokenIdx[i]] as const));
  const act = words(at.tokens).filter(
    (t) =>
      t.pos !== 'PRON' &&
      t.pos !== 'AUX' &&
      t.pos !== 'DET' &&
      t.pos !== 'CONJ' &&
      (t.pos !== 'PART' || NEG_WORD.test(t.norm)) &&
      !timeIdx.has(idxOf.get(t) ?? -1) &&
      !/^(going|збираюсь|збираюся|собираюсь|will|gonna|вже|уже|just)$/u.test(t.norm),
  );
  if (!act.length || !contentful(act)) return null;
  const rest = spanOf(text, cl.slice(k + 1));
  const q = qc.tokens
    .filter((t) => t.pos !== 'PUNCT' || /[?]/.test(t.text))
    .map((t) => (t === pro ? act.map((x) => x.text).join(' ') : t.text))
    .join(' ');
  return { text: `${q}${rest ? ` ${rest}` : ''}`.trim(), why: 'anaphora' };
}

/** Index of the first clause that follows a contrasting "but / але / a / aga…", or -1. */
function contrastAt(s: Sentence): number {
  const cl = s.clauses;
  for (let k = 1; k < cl.length; k++) {
    const c = cl[k];
    const lead = words(c.tokens)[0];
    // "…, but" / "…, а от" left at the end of the clause before.
    const prevTail = words(cl[k - 1].tokens).slice(-2);
    const conn = (c.connector ?? '').toLowerCase();
    const isConj = (t: Token | undefined) =>
      !!t && CONTRAST.test(t.norm) && (t.pos === 'CONJ' || t.pos === 'SCONJ' || t.norm.length > 1);
    if (CONTRAST.test(conn) || isConj(lead) || prevTail.some(isConj)) return k;
  }
  return -1;
}
