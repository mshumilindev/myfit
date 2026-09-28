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
    ile razy=how many|ile=how much|jak długo=how long|jak często=how often|dlaczego=why|czemu=why|kiedy=when|co=what|jak=how|czy=is|
    odpoczyn*=rest|odpoczyw*=rest|przerw*=rest|
    ciężar*=weight|ciezar*=weight|waga=weight|wagę=weight|kg=kg|następn*=next|nastepn*=next|dzisiaj=today|dziś=today|dzis=today|jutro=tomorrow|wczoraj=yesterday|tydzień=week|tygodni*=week|miesiąc*=month|miesiac*=month|
    trening*=workout|ćwicz*=train|cwicz*=train|siłowni*=gym|silowni*=gym|
    wyciskanie na ławce=bench press|wyciskani*=press|ławk*=bench|przysiad*=squat|martwy ciąg=deadlift|martwego ciągu=deadlift|ciąg*=deadlift|podciąg*=pullups|pompk*=pushups|wiosłowani*=row|uginani*=curl|wykrok*=lunges|
    klatk*=chest|plec*=back|plecy=back|nogi=legs|nóg=legs|ramion*=shoulders|bark*=shoulders|biceps*=biceps|triceps*=triceps|brzuch*=abs|pośladk*=glutes|łydk*=calves|
    boli=hurts|ból*=pain|bol*=pain|kontuzj*=injury|kolan*=knee|łok*=elbow|nadgarst*=wrist|
    białk*=protein|bialk*=protein|kalori*=calories|kreatyn*=creatine|sen=sleep|spać=sleep|spac=sleep|spanie=sleep|śpię=sleep|woda=water|wod*=water|
    rozgrzewk*=warmup|rekord*=record|najlepsz*=best|postęp*=progress|postep*=progress|plan*=plan|
    schudnąć=lose fat|schudnac=lose fat|masa=mass|masę=mass|siła=strength|zmęczon*=tired|zmeczon*=tired|motywacj*=motivation|powtórz*=reps|powtorz*=reps|seri*=sets|
    zamień=swap|zamien=swap|zamiast=instead|przenieś=move|przenies=move|zacznij=start|
    idzie=going|idą=going|ida=going|potrzeb*=need|nie=not|nic=nothing|bez=without|mój=my|moj=my|moja=my|moje=my|mi=me|mnie=me|ja=i|ty=you|
    zakwas*=sore|ból mięśni=sore|bol miesni=sore|mięś*=muscle|miesn*=muscle|masa mięśniowa=muscle mass|
    tłuszcz*=fat|tluszcz*=fat|chud*=lose fat|redukcj*=cut|deficyt*=deficit|nadwyżk*=surplus|nadwyzk*=surplus|
    węglowodan*=carbs|weglowodan*=carbs|błonnik*=fiber|blonnik*=fiber|cukier=sugar|cukr*=sugar|piwo=beer|alkohol*=alcohol|kaw*=coffee|
    śniadani*=breakfast|sniadani*=breakfast|posił*=meal|posil*=meal|jedzeni*=food|jeść=eat|jesc=eat|zjeść=eat|zjesc=eat|pić=drink|pic=drink|
    snu=sleep|śpię=sleep|spie=sleep|spać=sleep|spac=sleep|drzemk*=nap|chor*=sick|przezięb*=cold|przezieb*=cold|katar*=cold|gorączk*=fever|
    rozciąg*=stretch|rozciag*=stretch|mobilnoś*=mobility|mobilnos*=mobility|rolowani*=foam rolling|
    kolejnoś*=order|kolejnos*=order|split*=split|dni=days|dzień=day|dzien=day|razy=times|godzin*=hours|minut*=minutes|
    początkując*=beginner|poczatkujac*=beginner|wrócić=come back|wrocic=come back|powrót=comeback|powrot=comeback|przerw*=break|
    zastąpić=replace|zastapic=replace|zamiennik*=alternative|czym=with what|ćwiczeni*=exercise|cwiczeni*=exercise|
    rekord*=record|max*=max|ciężk*=heavy|ciezk*=heavy|lekk*=light|
    brzuch*=abs|pośladk*=glutes|posladk*=glutes|łydk*=calves|lydk*=calves|przedramion*=forearms|ręce=arms|rece=arms|ręk*=arms|rek*=arms|
    buty=shoes|butów=shoes|rękawiczk*=gloves|rekawiczk*=gloves|pas=belt|paski=straps|
    stres*=stress|nuda=boring|nudz*=bored of|znudzi*=bored of|motywuj*=motivate|zmęcz*=tired|zmecz*=tired|
    tętn*=heart rate|tetn*=heart rate|kroki=steps|kroków=steps|krokow=steps|bieg*=running|biega*=running|pływ*=swimming|plyw*=swimming|
    wiek=age|lat=years|ciąż*=pregnant|ciaz*=pregnant|okres*=period|miesiączk*=period|
    pokaż=show|pokaz=show|porównaj=compare|porownaj=compare|dlaczego=why|zrób=make|zrob=make|ułóż=make|uloz=make|
    aplikacj*=app|apce=app|apka=app|apki=app|zapisać=log|zapisac=log|usunąć=delete|usunac=delete|zmienić=change|zmienic=change|
    boję się=afraid|boje sie=afraid|obawiam*=afraid|strach*=fear|utkn*=get stuck|sztang*=bar|ławc*=bench|lawc*=bench|
    dzięki=thanks|dzieki=thanks|dziękuję=thank you|dziekuje=thank you|mecz*=match|wygra*=won|piłk*=football|pilk*=football|
    wieczor*=evening|wieczór=evening|rano=morning|poran*=morning|popraw*=improve|stracę=lose|strace=lose|strac*=lose|rzucę=quit|rzuce=quit|
    ciągle=keep|ciagle=keep|to samo=the same|w kółko=over and over|w kolko=over and over|
    kto=who|za pomoc=for the help|pomoc*=help|
    od stycznia=since january|od lutego=since february|od marca=since march|od kwietnia=since april|od maja=since may|od czerwca=since june|
    od lipca=since july|od sierpnia=since august|od września=since september|od wrzesnia=since september|od października=since october|od pazdziernika=since october|od listopada=since november|od grudnia=since december|
    uciekaj*=cave in|do środka=inward|do srodka=inward|
  `,
  lt: `
    kiek kartų=how many|kiek=how much|kaip ilgai=how long|kaip dažnai=how often|kodėl=why|kada=when|ką=what|kas=what|kaip=how|ar=is|
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
    reikia=need|ne=not|niekas=nothing|niekur=nowhere|be=without|mano=my|man=me|aš=i|as=i|tu=you|
    raumen*=muscle|riebal*=fat|numest*=lose fat|lieknė*=lose fat|deficit*=deficit|pertekli*=surplus|
    angliavandeni*=carbs|skaidul*=fiber|cukr*=sugar|alus=beer|alaus=beer|alkohol*=alcohol|kav*=coffee|
    pusryč*=breakfast|valgy*=eat|valgi*=food|gert*=drink|gerti=drink|
    miego=sleep|mieg*=sleep|miegot*=sleep|pogul*=nap|serg*=sick|peršal*=cold|persal*=cold|slog*=cold|karščiav*=fever|
    tempim*=stretch|tempt*=stretch|judrum*=mobility|volas=foam roller|
    tvark*=order|skirstym*=split|dien*=days|kart*=times|valand*=hours|minuč*=minutes|minuc*=minutes|
    pradedant*=beginner|grįžt*=come back|grizt*=come back|pertrauk*=break|
    pakeisti=replace|kuo=with what|pratim*=exercise|
    sunk*=heavy|lengv*=light|presas=abs|pilvo presas=abs|sėdmen*=glutes|sedmen*=glutes|blauzd*=calves|dilbi*=forearms|rank*=arms|
    bat*=shoes|pirštin*=gloves|pirstin*=gloves|diržas=belt|dirzas=belt|dirželi*=straps|dirzeli*=straps|
    stres*=stress|nuobod*=boring|nusibodo=bored of|pabodo=bored of|motyvuok=motivate|pavarg*=tired|
    pulso=heart rate|pulsas=heart rate|žingsni*=steps|zingsni*=steps|bėgim*=running|begim*=running|bėgiot*=running|begiot*=running|plaukim*=swimming|
    amži*=age|metų=years|metu=years|nėšč*=pregnant|nesc*=pregnant|menstruacij*=period|
    parodyk=show|palygink=compare|kodėl=why|kodel=why|sudaryk=make|padaryk=make|
    programėl*=app|programel*=app|įrašyt*=log|irasyt*=log|ištrint*=delete|istrint*=delete|pakeist*=change|
    sekasi=going|
    bijau=afraid|bijo*=afraid|baisu=afraid|užstrig*=get stuck|uzstrig*=get stuck|strig*=get stuck|štang*=bar|stang*=bar|
    ačiū=thanks|aciu=thanks|dėkoju=thank you|dekoju=thank you|rungtyn*=match|laimėj*=won|laimej*=won|krepšin*=basketball|krepsin*=basketball|futbol*=football|
    vakare=evening|vakarin*=evening|rytą=morning|ryte=morning|rytin*=morning|pager*=improve|sirg*=sick|dvirat*=cycling|turiu=have|energij*=energy|
    vis tą patį=the same again|tą patį=the same|ta pati=the same|
    neturiu jėgų=no energy|neturiu jegu=no energy|neturiu energijos=no energy|dvirač*=cycling|dvirac*=cycling|
    nuo sausio=since january|nuo vasario=since february|nuo kovo=since march|nuo balandžio=since april|nuo balandzio=since april|nuo gegužės=since may|nuo geguzes=since may|
    nuo birželio=since june|nuo birzelio=since june|nuo liepos=since july|nuo rugpjūčio=since august|nuo rugpjucio=since august|nuo rugsėjo=since september|nuo rugsejo=since september|
    nuo spalio=since october|nuo lapkričio=since november|nuo lapkricio=since november|nuo gruodžio=since december|nuo gruodzio=since december|
    ką dariau=what did i do|ka dariau=what did i do|dariau=did|pakel*=lift|daugiau=more|
  `,
  et: `
    mitu korda=how many|mitu=how many|kui palju=how much|kui kaua=how long|kui tihti=how often|miks=why|millal=when|mida=what|mis=what|kuidas=how|kas=is|
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
    laheb=going|läheb=going|areneb=progress|edeneb=progress|vaja=need|ei=not|pole=not|midagi=anything|ilma=without|minu=my|mu=my|mulle=me|mind=me|ma=i|mina=i|sa=you|sina=you|
    lihas*=muscle|rasv*=fat|kaalust alla=lose fat|kaalu langeta*=lose fat|defitsiit*=deficit|ülejää*=surplus|ulejaa*=surplus|
    süsivesik*=carbs|susivesik*=carbs|kiudain*=fiber|suhkur*=sugar|õlu=beer|olu=beer|alkohol*=alcohol|kohv*=coffee|
    hommikusöö*=breakfast|hommikusoo*=breakfast|sööma=eat|süüa=eat|suua=eat|söök*=food|juua=drink|joon=drink|
    magada=sleep|magan=sleep|lõunauin*=nap|lounauin*=nap|haige*=sick|külmetus*=cold|kulmetus*=cold|nohu*=cold|palavik*=fever|
    venita*=stretch|liikuvus*=mobility|rullimi*=foam rolling|
    järjekor*=order|jarjekor*=order|jaotus*=split|päev*=days|paev*=days|korda=times|tund*=hours|minut*=minutes|
    algaja*=beginner|tagasi=back|paus*=break|
    asendada=replace|millega=with what|harjutus*=exercise|
    raske*=heavy|kerge*=light|kõhulihas*=abs|kohulihas*=abs|tuhar*=glutes|sääremar*=calves|saaremar*=calves|käsivar*=forearms|käed=arms|kaed=arms|käsi=arms|
    jalanõu*=shoes|kinda*=gloves|vöö=belt|voo=belt|rihm*=straps|
    stress*=stress|igav*=boring|motiveeri=motivate|väsinud=tired|vasinud=tired|
    pulss*=heart rate|pulsi*=heart rate|samm*=steps|jooks*=running|ujumi*=swimming|
    vanus*=age|aastane=years old|rase*=pregnant|menstrua*=period|
    näita=show|naita=show|võrdle=compare|vordle=compare|miks=why|tee=make|koosta=make|
    äpp*=app|app*=app|äpi*=app|salvesta*=log|kustuta*=delete|muuda=change|muuta=change|
    kardan=afraid|kardu*=afraid|hirm*=fear|pelga*=afraid|kinni=stuck|kang*=bar|
    aitäh=thanks|aitah=thanks|tänan=thank you|tanan=thank you|mäng*=game|võit*=won|voit*=won|korvpall*=basketball|jalgpall*=football|
    õhtu*=evening|ohtu*=evening|hommiku*=morning|paran*=improve|parem*=better|halvem*=worse|viimasel ajal=lately|
    kogu aeg=all the time|sama=the same|
    pole jõudu=no energy|pole jaksu=no energy|jaksu=energy|
    jaanuarist=since january|veebruarist=since february|märtsist=since march|martsist=since march|aprillist=since april|maist=since may|juunist=since june|
    juulist=since july|augustist=since august|septembrist=since september|oktoobrist=since october|novembrist=since november|detsembrist=since december|
    soojend*=warmup|tehnik*=technique|kontroll*=check|unusta*=forgot|kirja panna=log|kirja=log|eilse*=yesterday|kiiresti=fast|kaota*=lose|
    jalapress*=leg press|superseeri*=superset|varva*=toes|
  `,
  ru: `
    сколько=how much|как долго=how long|как часто=how often|почему=why|зачем=why|когда=when|что=what|как=how|стоит ли=should|нужно ли=should|
    отдых*=rest|отдыха*=rest|перерыв*=rest|
    вес=weight|веса=weight|вес*=weight|кг=kg|следующ*=next|сегодня=today|завтра=tomorrow|вчера=yesterday|недел*=week|месяц*=month|
    тренировк*=workout|трениров*=train|занят*=train|зал*=gym|качалк*=gym|
    жим лежа=bench press|жим*=press|присед*=squat|становая=deadlift|станов*=deadlift|подтягив*=pullups|отжима*=pushups|тяга=row|тяг*=row|сгибани*=curl|выпад*=lunges|
    груд*=chest|спин*=back|ног*=legs|плеч*=shoulders|бицепс*=biceps|трицепс*=triceps|пресс*=abs|ягодиц*=glutes|икр*=calves|
    болит=hurts|боль=pain|боли=pain|болью=pain|болей=pain|больно=hurts|болят=hurts|больше=more|травм*=injury|колен*=knee|локот*=elbow|локт*=elbow|запяст*=wrist|
    белок=protein|белка=protein|белк*=protein|калори*=calories|креатин*=creatine|сон=sleep|сна=sleep|спать=sleep|вод*=water|
    разминк*=warmup|заминк*=cooldown|рекорд*=record|лучш*=best|прогресс*=progress|план*=plan|программ*=plan|
    похудеть=lose fat|похуден*=lose fat|масс*=mass|сил*=strength|устал*=tired|мотивац*=motivation|повтор*=reps|подход*=sets|
    замени=swap|поменяй=swap|вместо=instead|перенеси=move|начни=start|
    после=after|перед=before|кушать=eat|покушать=eat|поесть=eat|съесть=eat|есть=eat|еда=food|еды=food|не выспался=slept badly|выспал*=slept|спал=slept|
    теряю*=lose|теряет*=lose|потеря*=lose|мышц*=muscle|бросить=quit|брошу=quit|болею=sick|болеешь=sick|заболел*=sick|простыл*=cold|простуд*=cold|
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

/** One word against the single-word entries: a whole word or a stem. */
function wordEntry(w: string, entries: Entry[], minStem = 3): Entry | undefined {
  return entries.find(
    (en) =>
      en.key.length === 1 &&
      (en.stem ? en.key[0].length >= minStem && w.startsWith(en.key[0]) : w === en.key[0]),
  );
}

/**
 * Verb prefixes (Polish za-/prze-/wy-…, Lithuanian su-/pa-/per-…): "zachorował"
 * is "chor-", "susirgau" is "sirg-". Lithuanian "ne-" is the negation itself.
 */
const PREFIX: Record<string, string[]> = {
  pl: ['prze', 'przy', 'roz', 'ode', 'wy', 'za', 'po', 'na', 'od', 'do', 'ze', 'z', 's', 'u'],
  lt: ['per', 'pri', 'nu', 'su', 'pa', 'at', 'ap', 'is', 'iš', 'uz', 'už', 'į', 'i'],
  et: [],
  ru: [],
};

/**
 * A word no entry knows, read by its parts: a verb prefix off (pl, lt), the
 * negation "ne-" (lt), or a compound split into known parts (et
 * "treeningplaani" = "treening" + "plaani"; the head is the last part).
 */
function morph(w: string, lang: string, entries: Entry[]): string | null {
  if (w.length < 5) return null;
  if (lang === 'lt' && w.startsWith('ne') && w.length >= 6) {
    const e = wordEntry(w.slice(2), entries, 4) ?? morphPrefix(w.slice(2), lang, entries);
    if (e) return `not ${e.out}`;
  }
  const p = morphPrefix(w, lang, entries);
  if (p) return p.out;
  if (lang === 'et' && w.length >= 7) {
    for (let k = 3; k <= w.length - 3; k++) {
      const tail = wordEntry(w.slice(k), entries, 4);
      if (!tail) continue;
      const head = wordEntry(w.slice(0, k), entries, 4);
      return head ? `${head.out} ${tail.out}` : tail.out;
    }
  }
  return null;
}

function morphPrefix(w: string, lang: string, entries: Entry[]): Entry | null {
  for (const pre of PREFIX[lang] ?? []) {
    if (!w.startsWith(pre) || w.length - pre.length < 4) continue;
    const e = wordEntry(w.slice(pre.length), entries, 4);
    if (e) return e;
  }
  return null;
}

function translate(words: string[], entries: Entry[], lang = ''): { text: string; hits: number } {
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
      // Estonian compounds: "treeningplaani" is "treening" + "plaani" — the
      // stem that matched may be only the first part.
      const w = words[i];
      const rest = lang === 'et' && e.stem && e.key.length === 1 ? w.slice(e.key[0].length) : '';
      // (…with a linking genitive vowel: "jõusaali-kava".)
      const tail =
        (rest.length >= 4 ? wordEntry(rest, entries, 4) : undefined) ??
        (rest.length >= 5 && /^[aeiu]/u.test(rest)
          ? wordEntry(rest.slice(1), entries, 4)
          : undefined);
      out.push(tail ? `${e.out} ${tail.out}` : e.out);
      hits++;
      i += e.key.length;
      continue;
    }
    const m = lang ? morph(words[i], lang, entries) : null;
    if (m) {
      out.push(m);
      hits++;
    } else out.push(words[i]);
    i++;
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
  // Lithuanian first: ą and ę are Lithuanian too, ė į ų ū č š only Lithuanian.
  const order: ('pl' | 'lt' | 'et' | 'ru')[] = RU_ONLY.test(raw)
    ? ['ru']
    : LT_ONLY.test(raw)
      ? ['lt']
      : PL_ONLY.test(raw)
        ? // ą and ę alone are Lithuanian as much as Polish.
          /[łńśźżć]/u.test(raw)
          ? ['pl']
          : ['pl', 'lt']
        : ET_ONLY.test(raw)
          ? ['et']
          : /\p{Script=Cyrillic}/u.test(raw)
            ? ['ru']
            : ['pl', 'lt', 'et'];
  let best: { text: string; hits: number } | null = null;
  for (const lang of order) {
    const t = translate(words, DICT[lang], lang);
    if (t.hits && (!best || t.hits > best.hits)) best = t;
  }
  return best && best.hits >= 1 ? best.text : null;
}
