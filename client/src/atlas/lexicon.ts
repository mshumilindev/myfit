/**
 * Understanding Polish, Lithuanian, Estonian and Russian without separate
 * keyword sets: a small training vocabulary maps their words onto the English
 * ones the answer base already knows ("ile odpoczywać" → "how much rest").
 * Answers still come in the app's language.
 */
import { normalize } from './nlu';

// "stem*" matches any ending; plain words match exactly. Multi-word first.
const RAW: Record<'pl' | 'lt' | 'et' | 'ru', string> = {
  pl: `
    ile razy=how many|ile=how much|jak długo=how long|jak często=how often|dlaczego=why|czemu=why|kiedy=when|co=what|jak=how|czy=should|
    odpoczyn*=rest|odpoczyw*=rest|przerw*=rest|
    ciężar*=weight|ciezar*=weight|waga=weight|wagę=weight|kg=kg|następn*=next|nastepn*=next|dzisiaj=today|dziś=today|dzis=today|jutro=tomorrow|wczoraj=yesterday|tydzień=week|tygodni*=week|miesiąc*=month|miesiac*=month|
    trening*=workout|ćwicz*=train|cwicz*=train|siłowni*=gym|silowni*=gym|
    wyciskanie na ławce=bench press|wyciskani*=press|ławk*=bench|przysiad*=squat|martwy ciąg=deadlift|martwego ciągu=deadlift|ciąg*=deadlift|podciąg*=pullups|pompk*=pushups|wiosłowani*=row|uginani*=curl|wykrok*=lunges|
    klatk*=chest|plec*=back|plecy=back|nogi=legs|nóg=legs|ramion*=shoulders|bark*=shoulders|biceps*=biceps|triceps*=triceps|brzuch*=abs|pośladk*=glutes|łydk*=calves|
    boli=hurts|ból*=pain|bol*=pain|kontuzj*=injury|kolan*=knee|łok*=elbow|nadgarst*=wrist|
    białk*=protein|bialk*=protein|kalori*=calories|kreatyn*=creatine|sen=sleep|spa*=sleep|woda=water|wod*=water|
    rozgrzewk*=warmup|rekord*=record|najlepsz*=best|postęp*=progress|postep*=progress|plan*=plan|
    schudnąć=lose fat|schudnac=lose fat|masa=mass|masę=mass|siła=strength|zmęczon*=tired|zmeczon*=tired|motywacj*=motivation|powtórz*=reps|powtorz*=reps|seri*=sets|
    zamień=swap|zamien=swap|zamiast=instead|przenieś=move|przenies=move|zacznij=start|
  `,
  lt: `
    kiek kartų=how many|kiek=how much|kaip ilgai=how long|kaip dažnai=how often|kodėl=why|kada=when|ką=what|kas=what|kaip=how|ar=should|
    poils*=rest|ilset*=rest|ilsė*=rest|pertrauk*=rest|
    svor*=weight|kg=kg|kit*=next|šiandien=today|siandien=today|rytoj=tomorrow|vakar=yesterday|savait*=week|mėnes*=month|
    treniruot*=workout|sportuo*=train|sporto salė*=gym|sal*=gym|
    spaudimas gulint=bench press|spaudim*=press|pritūpim*=squat|pritupim*=squat|mirties trauk*=deadlift|trauk*=deadlift|prisitrauk*=pullups|atsispaudim*=pushups|lenkim*=curl|įtūpst*=lunges|
    krūtin*=chest|krutin*=chest|nugar*=back|koj*=legs|pečių=shoulders|peči*=shoulders|biceps*=biceps|triceps*=triceps|pilv*=abs|sėdmen*=glutes|blauzd*=calves|
    skauda=hurts|skausm*=pain|traum*=injury|kel*=knee|alkūn*=elbow|rieš*=wrist|
    baltym*=protein|kalorij*=calories|kreatin*=creatine|mieg*=sleep|vanden*=water|
    apšil*=warmup|aps il*=warmup|rekord*=record|geriausi*=best|progres*=progress|plan*=plan|
    numesti=lose fat|mas*=mass|jėg*=strength|pavarg*=tired|motyvacij*=motivation|pakartojim*=reps|serij*=sets|priėjim*=sets|
    pakeisk=swap|vietoj=instead|perkelk=move|pradėk=start|
  `,
  et: `
    mitu korda=how many|mitu=how many|kui palju=how much|kui kaua=how long|kui tihti=how often|miks=why|millal=when|mida=what|mis=what|kuidas=how|kas=should|
    puhk*=rest|puha*=rest|paus*=rest|
    raskus*=weight|kaal*=weight|kg=kg|järgmi*=next|jargmi*=next|täna=today|tana=today|homme=tomorrow|eile=yesterday|nädal*=week|nadal*=week|kuu=month|kuus=month|
    trenn*=workout|treening*=workout|treeni*=train|jõusaal*=gym|jousaal*=gym|
    lamades surumine=bench press|surumi*=press|kükk*=squat|kukk*=squat|jõutõmme=deadlift|joutomme=deadlift|lõuatõmb*=pullups|kätekõverd*=pushups|biitsepsikõverd*=curl|väljaast*=lunges|
    rind*=chest|selg*=back|jalg*=legs|jalad=legs|õla*=shoulders|ola*=shoulders|biitseps*=biceps|triitseps*=triceps|kõht*=abs|tuhar*=glutes|sääre*=calves|
    valutab=hurts|valu*=pain|vigastus*=injury|põlv*=knee|polv*=knee|küünar*=elbow|rand*=wrist|
    valk*=protein|kalor*=calories|kreatiin*=creatine|uni=sleep|und=sleep|magami*=sleep|vesi=water|vett=water|
    soojendus*=warmup|rekord*=record|parim*=best|areng*=progress|progress*=progress|kava*=plan|plaan*=plan|
    kaalust alla=lose fat|lihasmass*=mass|jõud*=strength|väsinud=tired|vasinud=tired|motivats*=motivation|kordus*=reps|seeria*=sets|
    vaheta=swap|asemel=instead|liiguta=move|alusta=start|
  `,
  ru: `
    сколько=how much|как долго=how long|как часто=how often|почему=why|зачем=why|когда=when|что=what|как=how|стоит ли=should|нужно ли=should|
    отдых*=rest|отдыха*=rest|перерыв*=rest|
    вес=weight|веса=weight|вес*=weight|кг=kg|следующ*=next|сегодня=today|завтра=tomorrow|вчера=yesterday|недел*=week|месяц*=month|
    тренировк*=workout|трениров*=train|занят*=train|зал*=gym|качалк*=gym|
    жим лежа=bench press|жим*=press|присед*=squat|становая=deadlift|станов*=deadlift|подтягив*=pullups|отжима*=pushups|тяга=row|тяг*=row|сгибани*=curl|выпад*=lunges|
    груд*=chest|спин*=back|ног*=legs|плеч*=shoulders|бицепс*=biceps|трицепс*=triceps|пресс*=abs|ягодиц*=glutes|икр*=calves|
    болит=hurts|боль*=pain|травм*=injury|колен*=knee|локот*=elbow|локт*=elbow|запяст*=wrist|
    белок=protein|белка=protein|белк*=protein|калори*=calories|креатин*=creatine|сон=sleep|сна=sleep|спать=sleep|вод*=water|
    разминк*=warmup|заминк*=cooldown|рекорд*=record|лучш*=best|прогресс*=progress|план*=plan|программ*=plan|
    похудеть=lose fat|похуден*=lose fat|масс*=mass|сил*=strength|устал*=tired|мотивац*=motivation|повтор*=reps|подход*=sets|
    замени=swap|поменяй=swap|вместо=instead|перенеси=move|начни=start|
  `,
};

type Entry = { key: string[]; stem: boolean; out: string };
const DICT: Record<string, Entry[]> = {};
for (const [lang, raw] of Object.entries(RAW)) {
  DICT[lang] = raw
    .split('|')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((pair) => {
      const [k, out] = pair.split('=');
      const stem = k.endsWith('*');
      return { key: normalize(stem ? k.slice(0, -1) : k).split(' '), stem, out };
    })
    // Longer phrases first.
    .sort((a, b) => b.key.length - a.key.length);
}

function translate(words: string[], entries: Entry[]): { text: string; hits: number } {
  const out: string[] = [];
  let hits = 0;
  for (let i = 0; i < words.length;) {
    const e = entries.find((en) =>
      en.key.every((k, j) => {
        const w = words[i + j];
        if (w === undefined) return false;
        const last = j === en.key.length - 1;
        return last && en.stem ? w.startsWith(k) && k.length >= 3 : w === k;
      }),
    );
    if (e) {
      out.push(e.out);
      hits++;
      i += e.key.length;
    } else {
      out.push(words[i]);
      i++;
    }
  }
  return { text: out.join(' '), hits };
}

const RU_ONLY = /[ыэъё]/;
const PL_ONLY = /[ąęłńśźż]/;
const LT_ONLY = /[ėįųūčš]/;
const ET_ONLY = /[õäöü]/;

/**
 * The question mapped into English keywords — or null if it doesn't look
 * like pl / lt / et / ru, or nothing was recognised.
 */
export function toKnownLanguage(question: string): string | null {
  const raw = question.toLowerCase();
  const words = normalize(question).split(' ').filter(Boolean);
  if (!words.length) return null;
  const order: ('pl' | 'lt' | 'et' | 'ru')[] = RU_ONLY.test(raw)
    ? ['ru']
    : PL_ONLY.test(raw)
      ? ['pl']
      : LT_ONLY.test(raw)
        ? ['lt']
        : ET_ONLY.test(raw)
          ? ['et']
          : /\p{Script=Cyrillic}/u.test(raw)
            ? ['ru']
            : ['pl', 'lt', 'et'];
  let best: { text: string; hits: number } | null = null;
  for (const lang of order) {
    const t = translate(words, DICT[lang]);
    if (t.hits && (!best || t.hits > best.hits)) best = t;
  }
  return best && best.hits >= 1 ? best.text : null;
}
