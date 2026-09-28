/** Units, number words and time expressions for all six languages (diacritics folded for Latin). */
import type { Lang, Unit } from '../types';

/** unit → words, per language. Latin words are diacritic-folded. */
const UNITS: Record<Lang, string> = {
  en: `kg:kg kgs kilo kilos kilogram kilograms|lb:lb lbs pound pounds|rep:rep reps repetition repetitions
|set:set sets|min:min mins minute minutes|h:h hr hrs hour hours|sec:s sec secs second seconds
|km:km kms kilometer kilometers kilometre kilometres|m:meter meters metre metres|mi:mi mile miles
|day:day days|week:week weeks wk wks|month:month months|year:year years yr yrs|%:% percent
|kcal:kcal cal cals calorie calories|g:g gram grams gr|l:liter liters litre litres|step:step steps
|time:time times|session:workout workouts session sessions|bpm:bpm`,
  uk: `kg:кг кіло кіла кілограм кілограми кілограмів кило kg|lb:фунт фунти фунтів|rep:повтор повтори повторів повторення повторень|set:підхід підходи підходів підхода серія серії серій сет сети сетів|min:хв хвилина хвилини хвилин хвилину мін min
|h:год година години годин годину h|sec:сек секунд секунди секунда секунду|km:км кілометр кілометри кілометрів кілометра км km
|m:метр метри метрів метра|mi:миля милі миль|day:день дні днів дня доба доби діб|week:тиждень тижні тижнів тижня|month:місяць місяці місяців місяця
|year:рік роки років року|%:% відсоток відсотки відсотків|kcal:ккал калорія калорії калорій кал kcal|g:г грам грами грамів|l:л літр літри літрів
|step:крок кроки кроків|time:раз рази разів разу|session:тренування тренувань|bpm:уд ударів удари удара bpm`,
  ru: `kg:кг кило килограмм килограмма килограммов kg|lb:фунт фунта фунтов|rep:повтор повтора повторов повторение повторения повторений
|set:подход подхода подходов подходы серия серии серий сет сета сетов|min:мин минута минуты минут минуту|h:час часа часов ч|sec:сек секунд секунды
|km:км километр километра километров km|m:метр метра метров|day:день дня дней сутки|week:неделя недели недель неделю|month:месяц месяца месяцев
|year:год года лет|%:% процент процента процентов|kcal:ккал калория калории калорий|g:г грамм грамма граммов|l:л литр литра литров
|step:шаг шага шагов|time:раз раза|session:тренировка тренировки тренировок|bpm:уд ударов удара bpm`,
  pl: `kg:kg kilo kilogram kilogramy kilogramow kilogramach|lb:funt funty funtow lb|rep:powtorzenie powtorzenia powtorzen|set:seria serie serii set|min:min minuta minuty minut minute
|h:h godzina godziny godzin godzine|sec:s sek sekund sekundy|km:km kilometr kilometry kilometrow|m:metr metry metrow|day:dzien dni dnia dniach|week:tydzien tygodnie tygodni tygodnia tygodniach tygodniami
|month:miesiac miesiace miesiecy miesiacach|year:rok lata lat latach|%:% procent|kcal:kcal kalorii kalorie|g:g gram gramow|l:l litr litry|step:krok kroki krokow|time:raz razy|session:trening treningi treningow|bpm:bpm`,
  lt: `kg:kg kilogramai kilogramu|lb:svarai svaru|rep:pakartojimas pakartojimai pakartojimu|set:serija serijos seriju serijas|min:min minute minutes minuciu minutes
|h:h val valanda valandos valandu valandas|sec:s sek sekunde sekundziu|km:km kilometrai kilometru|m:metrai metru|day:diena dienos dienu dienas diena|week:savaite savaites savaiciu savaites savaitems savaitei savaitę savaite
|month:menuo menesiai menesiu menesius|year:metai metu metus|%:% procentai procentu|kcal:kcal kalorijos kaloriju|g:g gramai gramu|l:l litrai litru|step:zingsniai zingsniu|time:kartas kartai kartu kartus|session:treniruote treniruotes treniruociu|bpm:bpm`,
  et: `kg:kg kilo kilogrammi|lb:naela|rep:kordus kordust kordused|set:seeria seeriat seeriad|min:min minut minutit minutiks minutiga minutiliselt|h:h tund tundi tunni tunnid tunniga
|sec:s sek sekundit|km:km kilomeetrit|m:meetrit|day:paev paeva paevad|week:nadal nadalat nadalad|month:kuu kuud|year:aasta aastat aastad|%:% protsenti
|kcal:kcal kalorit kalorid|g:g grammi|l:l liitrit|step:samm sammu sammud|time:korda korral|session:trenn trenni treeningut|bpm:bpm`,
};

const unitMaps: Partial<Record<Lang, Map<string, Unit>>> = {};

export function unitOf(lang: Lang, w: string): Unit | undefined {
  let m = unitMaps[lang];
  if (!m) {
    m = new Map();
    for (const part of UNITS[lang].split('|')) {
      const [u, ws] = part.split(':');
      for (const x of ws.split(/\s+/)) if (x) m.set(x, u.trim() as Unit);
    }
    unitMaps[lang] = m;
  }
  return m.get(w);
}

const NUMS: Record<Lang, string> = {
  en: `zero:0 one:1 two:2 three:3 four:4 five:5 six:6 seven:7 eight:8 nine:9 ten:10 eleven:11 twelve:12
thirteen:13 fourteen:14 fifteen:15 sixteen:16 seventeen:17 eighteen:18 nineteen:19 twenty:20 thirty:30 forty:40
fifty:50 sixty:60 seventy:70 eighty:80 ninety:90 hundred:100 half:0.5 dozen:12`,
  uk: `нуль:0 один:1 одна:1 одне:1 одну:1 одного:1 два:2 дві:2 двох:2 три:3 трьох:3 чотири:4 чотирьох:4 п'ять:5 п'яти:5
шість:6 шести:6 сім:7 семи:7 вісім:8 восьми:8 дев'ять:9 десять:10 десяти:10 одинадцять:11 дванадцять:12 п'ятнадцять:15
двадцять:20 тридцять:30 сорок:40 п'ятдесят:50 шістдесят:60 сто:100 двісті:200 півтора:1.5 півтори:1.5 пів:0.5
двом:2 двома:2 трьом:3 трьома:3 одному:1 одній:1 одним:1 одна:1 тринадцять:13 чотирнадцять:14 шістнадцять:16
сімнадцять:17 вісімнадцять:18 дев'ятнадцять:19 двадцяти:20 тридцяти:30 сорока:40 п'ятдесяти:50 сімдесят:70
вісімдесят:80 дев'яносто:90 ста:100 триста:300 чотириста:400 п'ятсот:500 шести:6 десятьох:10`,
  ru: `ноль:0 один:1 одна:1 одно:1 одну:1 два:2 две:2 три:3 четыре:4 пять:5 шесть:6 семь:7 восемь:8 девять:9 десять:10
пятнадцать:15 двадцать:20 тридцать:30 сорок:40 пятьдесят:50 шестьдесят:60 сто:100 полтора:1.5 полторы:1.5 пол:0.5
двух:2 трех:3 трёх:3 четырех:4 пяти:5 двум:2 одиннадцать:11 двенадцать:12 семьдесят:70 восемьдесят:80
девяносто:90 двести:200 триста:300 двадцати:20 тридцати:30`,
  pl: `zero:0 jeden:1 jedna:1 jedno:1 dwa:2 dwie:2 trzy:3 cztery:4 piec:5 szesc:6 siedem:7 osiem:8 dziewiec:9 dziesiec:10
pietnascie:15 dwadziescia:20 trzydziesci:30 czterdziesci:40 piecdziesiat:50 sto:100 poltora:1.5 pol:0.5
dwoch:2 dwoma:2 dwu:2 trzech:3 trzema:3 czterech:4 pieciu:5 szesciu:6 siedmiu:7 osmiu:8 dziewieciu:9
dziesieciu:10 jedenascie:11 dwanascie:12 trzynascie:13 czternascie:14 szesnascie:16 siedemnascie:17
osiemnascie:18 dziewietnascie:19 szescdziesiat:60 siedemdziesiat:70 osiemdziesiat:80 dziewiecdziesiat:90
dwiescie:200 trzysta:300 jednej:1 jednego:1 jedna:1`,
  lt: `nulis:0 vienas:1 viena:1 du:2 dvi:2 trys:3 keturi:4 keturias:4 penki:5 penkias:5 sesi:6 sesias:6 septyni:7
astuoni:8 devyni:9 desimt:10 penkiolika:15 dvidesimt:20 trisdesimt:30 simtas:100 pusantro:1.5 pusantros:1.5 puse:0.5
dvejus:2 dveji:2 dveju:2 dviem:2 dvieju:2 trejus:3 treji:3 triju:3 trims:3 tris:3 keturis:4 keturiu:4
keturiems:4 ketverius:4 penkis:5 penkiu:5 penkerius:5 sesis:6 septynis:7 astuonis:8 devynis:9 vienuolika:11
dvylika:12 trylika:13 keturiolika:14 sesiolika:16 septyniolika:17 astuoniolika:18 devyniolika:19
keturiasdesimt:40 penkiasdesimt:50 sesiasdesimt:60 vienerius:1 viena:1`,
  et: `null:0 uks:1 kaks:2 kolm:3 neli:4 viis:5 kuus:6 seitse:7 kaheksa:8 uheksa:9 kumme:10 viisteist:15
kakskummend:20 kolmkummend:30 sada:100 poolteist:1.5 pool:0.5
uhe:1 kahe:2 kolme:3 nelja:4 viie:5 kuue:6 seitsme:7 kumne:10 uksteist:11 kaksteist:12 kolmteist:13
neliteist:14 kuusteist:16 nelikummend:40 viiskummend:50 kuuskummend:60`,
};

const numMaps: Partial<Record<Lang, Map<string, number>>> = {};

export function numWord(lang: Lang, w: string): number | undefined {
  let m = numMaps[lang];
  if (!m) {
    m = new Map();
    for (const x of NUMS[lang].split(/\s+/)) {
      const [k, v] = x.split(':');
      if (k) m.set(k, Number(v));
    }
    numMaps[lang] = m;
  }
  return m.get(w);
}

/** "twice", "тричі": numeral adverbs → N times. */
export const TIMES_ADV: Record<string, number> = {
  once: 1,
  twice: 2,
  thrice: 3,
  двічі: 2,
  тричі: 3,
  дважды: 2,
  трижды: 3,
  dwukrotnie: 2,
  trzykrotnie: 3,
  kartą: 1,
};

/** Multi-word thousand multipliers. */
export const THOUSAND = new Set([
  'тисяча',
  'тисячі',
  'тисяч',
  'тысяча',
  'тысячи',
  'тысяч',
  'thousand',
  'tysiecy',
  'tysiace',
  'tukstanciai',
  'tukstanciu',
  'tuhat',
]);

/**
 * Time expressions: "words=canonical" (words space-separated, '*' = prefix).
 * Matched as multi-word expressions on diacritic-folded norms.
 */
export const TIME: Record<Lang, string> = {
  en: `today=today|tonight=tonight|yesterday=yesterday|yesterday's=yesterday|tomorrow=tomorrow|tomorrow's=tomorrow|today's=today
|now=now|right now=now|rn=now|this morning=this_morning|this evening=this_evening|last night=last_night|this week=this_week
|last week=last_week|next week=next_week|this month=this_month|last month=last_month|next month=next_month
|this year=this_year|last year=last_year|next year=next_year|this weekend=weekend|weekend=weekend|tonight=tonight
|the day before yesterday=day_before_yesterday|monday=mon|tuesday=tue|wednesday=wed|thursday=thu|friday=fri
|saturday=sat|sunday=sun`,
  uk: `сьогодні=today|сьогодня=today|сьогоднішн*=today|зараз=now|щас=now|вчора=yesterday|учора=yesterday|вчорашн*=yesterday
|завтра=tomorrow|завтрашн*=tomorrow|позавчора=day_before_yesterday|післязавтра=day_after_tomorrow
|цього тижня=this_week|на цьому тижні=this_week|на цей тиждень=this_week|цей тиждень=this_week
|минулого тижня=last_week|минулий тиждень=last_week|на минулому тижні=last_week|за минулий тиждень=last_week
|наступного тижня=next_week|наступний тиждень=next_week|на наступному тижні=next_week|на наступний тиждень=next_week
|минулої ночі=last_night|цієї ночі=last_night|сьогодні вночі=tonight|цього місяця=this_month|минулого місяця=last_month|минулий місяць=last_month|наступного місяця=next_month
|торік=last_year|минулого року=last_year|цього року=this_year|наступного року=next_year|на вихідних=weekend|вихідні=weekend
|понеділ*=mon|вівтор*=tue|середу=wed|середа=wed|четвер*=thu|п'ятниц*=fri|субот*=sat|неділ*=sun`,
  ru: `сегодня=today|сегодняшн*=today|сейчас=now|щас=now|вчера=yesterday|вчерашн*=yesterday|завтра=tomorrow|позавчера=day_before_yesterday
|послезавтра=day_after_tomorrow|на этой неделе=this_week|на эту неделю=this_week|на прошлой неделе=last_week|на следующей неделе=next_week
|прошлой ночью=last_night|этой ночью=last_night|в этом месяце=this_month|в прошлом месяце=last_month|в прошлом году=last_year|на выходных=weekend
|понедельник*=mon|вторник*=tue|среду=wed|среда=wed|четверг*=thu|пятниц*=fri|суббот*=sat|воскресень*=sun`,
  pl: `dzis=today|dzisiaj=today|teraz=now|wczoraj=yesterday|jutro=tomorrow|przedwczoraj=day_before_yesterday|pojutrze=day_after_tomorrow
|w tym tygodniu=this_week|na ten tydzien=this_week|w zeszlym tygodniu=last_week|w ubieglym tygodniu=last_week|w przyszlym tygodniu=next_week
|w zeszlym miesiacu=last_month|wczorajsz*=yesterday|dzisiejsz*=today|jutrzejsz*=tomorrow|tej nocy=last_night|w nocy=last_night|zeszlej nocy=last_night|w weekend=weekend|poniedzial*=mon|wtor*=tue|srod*=wed|czwart*=thu|piat*=fri|sobot*=sat|niedziel*=sun`,
  lt: `siandien=today|dabar=now|vakar=yesterday|rytoj=tomorrow|uzvakar=day_before_yesterday|poryt=day_after_tomorrow
|sia savaite=this_week|siai savaitei=this_week|sios savaites=this_week|praejusia savaite=last_week|kita savaite=next_week
|praejusi menesi=last_month|vakaryks*=yesterday|siandienin*=today|savaitgal*=weekend|pirmadien*=mon|antradien*=tue|treciadien*=wed|ketvirtadien*=thu
|penktadien*=fri|sestadien*=sat|sekmadien*=sun`,
  et: `tana=today|nuud=now|eile=yesterday|homme=tomorrow|uleeile=day_before_yesterday|ulehomme=day_after_tomorrow
|sel nadalal=this_week|sellel nadalal=this_week|selle nadala=this_week|eelmisel nadalal=last_week|eelmine nadal=last_week
|jargmisel nadalal=next_week|eelmisel kuul=last_month|eilne=yesterday|eilse*=yesterday|tanane=today|tanase*=today|nadalavahetus*=weekend|esmaspaev*=mon|teisipaev*=tue|kolmapaev*=wed
|neljapaev*=thu|reede*=fri|laupaev*=sat|puhapaev*=sun`,
};
