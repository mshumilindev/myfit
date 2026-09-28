/**
 * "I danced for 2 hours today", "пробіг 5 км зранку", "плавал час" — a
 * STATEMENT about something done outside the gym. It is not a question about
 * running or dancing (those are topics of their own), so it gets its own
 * answer: acknowledge it with its length, say how it counts for load and
 * recovery, and offer to log it (Activities feed the fatigue model).
 *
 * Also here: complaints at Atlas ("why aren't you commenting on that?",
 * "ти мене не слухаєш") — they are about the conversation, not a topic.
 */
import { foldRe, normalize } from './nlu';
import { parseWeekdays } from './when';
import type { AskCtx, AtlasAction, Tr } from './intentKit';

const DAY = 86_400_000;

export interface ActivityReport {
  /** Key in the activities catalog (ACTIVITY_TYPES). */
  kind: string;
  /** How to call it: [en, uk]. */
  label: [string, string];
  minutes: number | null;
  km: number | null;
  /** 0 = today, 1 = yesterday… */
  daysAgo: number;
  /** "…and you didn't even comment on it" in the same message. */
  complaint: boolean;
}

/** Activity words → catalog key and a name. Checked in order (a sport before "run"). */
const KINDS: [RegExp, string, [string, string]][] = [
  // Specific sports first — the broader families below would catch them.
  [
    /(^| )(table tennis|ping ?pong|настільн\S* теніс\S*|настольн\S* теннис\S*)( |$)/u,
    'tabletennis',
    ['Table tennis', 'Настільний теніс'],
  ],
  [/(^| )(padel|падел\S*)( |$)/u, 'padel', ['Padel', 'Падел']],
  [/(^| )(badminton|бадмінтон\S*|бадминтон\S*)( |$)/u, 'badminton', ['Badminton', 'Бадмінтон']],
  [
    /(^| )(boxing|boxed|box|kickbox\S*|бокс\S*|боксув\S*|боксир\S*|кікбокс\S*)( |$)/u,
    'boxing',
    ['Boxing', 'Бокс'],
  ],
  [/(^| )(snowboard\S*|сноуборд\S*)( |$)/u, 'snowboard', ['Snowboarding', 'Сноуборд']],
  [/(^| )(hockey|хокей\S*|хоккей\S*)( |$)/u, 'hockey', ['Hockey', 'Хокей']],
  [/(^| )(golf\S*|гольф\S*)( |$)/u, 'golf', ['Golf', 'Гольф']],
  [
    /(^| )(jump ?rope|skipping rope|rope skipping|скакалк\S*|скакалц\S*)( |$)/u,
    'jumprope',
    ['Jump rope', 'Скакалка'],
  ],
  [
    /(^| )(elliptical|cross ?trainer|орбітрек\S*|орбитрек\S*|еліпс\S*|эллипс\S*)( |$)/u,
    'elliptical',
    ['Elliptical', 'Орбітрек'],
  ],
  [
    /(^| )(stairmaster|stair master|stair climber|stairs|сходах|сходи|ступеньк\S*|лестниц\S*)( |$)/u,
    'stairs',
    ['Stair climbing', 'Сходи'],
  ],
  [
    /(^| )(hike|hiked|hiking|trek\S*|похід|поход|походi|в гори|у гори|в горы|по горах)( |$)/u,
    'hike',
    ['Hiking', 'Похід'],
  ],
  [/(^| )(danc\S*|zumba|танц\S*|tantsi\S*|tants\S*)/u, 'dance', ['Dancing', 'Танці']],
  [/(^| )(pilates|пілатес\S*|пилатес\S*)/u, 'pilates', ['Pilates', 'Пілатес']],
  [/(^| )(yoga|йог\S*|йоз\S*|joga)/u, 'yoga', ['Yoga', 'Йога']],
  [
    /(^| )(stretch\S*|mobility work|розтяжк\S*|розтягув\S*|растяжк\S*)/u,
    'mobility',
    ['Stretching', 'Розтяжка'],
  ],
  [/(^| )(massage|масаж\S*|массаж\S*)/u, 'massage', ['Massage', 'Масаж']],
  [/(^| )(sauna|steam room|banya|саун\S*|лазн\S*|бан(я|і|ю|е))( |$)/u, 'sauna', ['Sauna', 'Сауна']],
  [
    /(^| )(ice bath|cold plunge|cold shower|крижан\S* ванн\S*|моржу\S*|холодн\S* душ\S*|ледян\S* ванн\S*)/u,
    'cold',
    ['Cold exposure', 'Холод'],
  ],
  [/(^| )(hiit|tabata|табата|crossfit|кросфіт\S*|кроссфит\S*)( |$)/u, 'hiit', ['HIIT', 'HIIT']],
  [/(^| )(football|soccer|футбол\S*)/u, 'football', ['Football', 'Футбол']],
  [/(^| )(basketball|баскетбол\S*)/u, 'basketball', ['Basketball', 'Баскетбол']],
  [
    /(^| )(tennis|padel|squash|badminton|теніс\S*|теннис\S*|бадмінтон\S*)/u,
    'tennis',
    ['Tennis', 'Теніс'],
  ],
  [/(^| )(volleyball|волейбол\S*)/u, 'volleyball', ['Volleyball', 'Волейбол']],
  [
    /(^| )(boxing|boxed|box|kickbox\S*|sparr\S*|bjj|jiu jitsu|mma|wrestl\S*|бокс\S*|єдиноборств\S*|спаринг\S*)( |$)/u,
    'martial',
    ['Combat training', 'Єдиноборства'],
  ],
  [
    /(^| )(boulder\S*|climbing gym|climbing wall|indoor climb\S*|скеледром\S*|скалодром\S*|боулдер\S*)/u,
    'climbgym',
    ['Climbing gym', 'Скеледром'],
  ],
  [
    /(^| )(climb\S*|скелелаз\S*|скалолаз\S*|на скел\S*)/u,
    'climbing',
    ['Rock climbing', 'Скелелазіння'],
  ],
  [/(^| )(ski|skis|skied|skiing|snowboard\S*|лиж\S*|сноуборд\S*)( |$)/u, 'ski', ['Skiing', 'Лижі']],
  [/(^| )(surf\S*|серф\S*)/u, 'cardio', ['Surfing', 'Серфінг']],
  [/(^| )(skat\S*|hockey|ковзан\S*|хокей\S*)/u, 'cardio', ['Skating', 'Ковзани']],
  [
    /(^| )(swim\S*|swam|plav\S*|плав\S*|проплив\S*|проплыл\S*|басейн\S*|бассейн\S*)/u,
    'swim',
    ['Swimming', 'Плавання'],
  ],
  [
    /(^| )(cycl\S*|bike\S*|biked|biking|bicycle|spin class|spinning|велосипед\S*|велик\S*|вело|велотрен\S*|veli?k\S*)/u,
    'cycle',
    ['Cycling', 'Велосипед'],
  ],
  [/(^| )(rowed|rowing|erg|гребл\S*|веслув\S*)( |$)/u, 'row', ['Rowing', 'Веслування']],
  [
    /(^| )(ran|run|runs|running|jog\S*|\d+k(?! steps)|half marathon|marathon|біг|бігав\S*|бігал\S*|бігом|пробіг\S*|побіга\S*|пробіжк\S*|бегал\S*|бегом|пробежал\S*|пробежк\S*|побегал\S*|марафон\S*|probi\S*|bihav\S*|begal\S*)( |$)/u,
    'run',
    ['Running', 'Біг'],
  ],
  [
    /(^| )(walk\S*|hike|hiked|hiking|trek\S*|гуля\S*|прогулян\S*|прогулк\S*|пройш\S* \d+|в гори|у гори|в горы|похід|поход|\d+k steps|\d+ ?000 steps|кроків|шагов)( |$)/u,
    'walk',
    ['Walking', 'Ходьба'],
  ],
  [
    /(^| )(treadmill|elliptical|stairmaster|stair master|доріжц\S*|доріжк\S*|орбітрек\S*|дорожк\S*|кардіо|кардио|cardio)( |$)/u,
    'cardio',
    ['Cardio', 'Кардіо'],
  ],
];

/**
 * Polish, Lithuanian and Estonian activity words (folded as messages are:
 * ą→a, ė→e, õ→o; ł, ä, ö, ü stay). Checked after the ones above.
 */
const KINDS_X: [RegExp, string, [string, string]][] = [
  [
    /(^| )(tenis stolow\S*|tenis stołow\S*|stalo teni\S*|lauatennis\S*)( |$)/u,
    'tabletennis',
    ['Table tennis', 'Настільний теніс'],
  ],
  [/(^| )(badminton\S*|sulgpall\S*)( |$)/u, 'badminton', ['Badminton', 'Бадмінтон']],
  [/(^| )(boks\S*|poksi\S*|bokso\S*)( |$)/u, 'boxing', ['Boxing', 'Бокс']],
  [/(^| )(hokej\S*|ledo ritul\S*|jaahoki\S*|jäähoki\S*)( |$)/u, 'hockey', ['Hockey', 'Хокей']],
  [
    /(^| )(snowboard\S*|snieglent\S*|lumelaua\S*|lumelaud\S*)( |$)/u,
    'snowboard',
    ['Snowboarding', 'Сноуборд'],
  ],
  [/(^| )(golf\S*)( |$)/u, 'golf', ['Golf', 'Гольф']],
  [
    /(^| )(skakank\S*|sokdyn\S*|šokdyn\S*|hupits\S*|hüpits\S*)( |$)/u,
    'jumprope',
    ['Jump rope', 'Скакалка'],
  ],
  [/(^| )(orbitrek\S*|elipsin\S*|ellips\S*)( |$)/u, 'elliptical', ['Elliptical', 'Орбітрек']],
  [
    /(^| )(wędrówk\S*|wedrowk\S*|w gory|w góry|zygi\S*|žygi\S*|matka\S*|matkasin)( |$)/u,
    'hike',
    ['Hiking', 'Похід'],
  ],
  [
    /(^| )(tanc\S*|taniec|tańc\S*|sokau|sokiau|sokom\S*|sokiai|tantsisin)( |$)/u,
    'dance',
    ['Dancing', 'Танці'],
  ],
  [/(^| )(jooga\S*|jogi|joge|jogos|jogą|joga)( |$)/u, 'yoga', ['Yoga', 'Йога']],
  [/(^| )(pilates\S*)( |$)/u, 'pilates', ['Pilates', 'Пілатес']],
  [
    /(^| )(rozciąg\S*|rozciag\S*|tempim\S*|venitus\S*|venitasin)( |$)/u,
    'mobility',
    ['Stretching', 'Розтяжка'],
  ],
  [/(^| )(masaz\S*|masaż\S*|massaaz\S*|massaaž\S*)( |$)/u, 'massage', ['Massage', 'Масаж']],
  [/(^| )(saun\S*|pirt\S*)( |$)/u, 'sauna', ['Sauna', 'Сауна']],
  [/(^| )(piłk\S*|pilk\S*|futbol\S*|jalgpall\S*)( |$)/u, 'football', ['Football', 'Футбол']],
  [
    /(^| )(koszyk\S*|kosza|krepsin\S*|krepšin\S*|korvpall\S*)( |$)/u,
    'basketball',
    ['Basketball', 'Баскетбол'],
  ],
  [/(^| )(tenis\S*|tennis\S*|padel\S*)( |$)/u, 'tennis', ['Tennis', 'Теніс']],
  [/(^| )(siatk\S*|tinklin\S*|vorkpall\S*)( |$)/u, 'volleyball', ['Volleyball', 'Волейбол']],
  [/(^| )(boks\S*|poksi\S*)( |$)/u, 'martial', ['Combat training', 'Єдиноборства']],
  [
    /(^| )(scian\S*|ścian\S*|sienel\S*|ronimissein\S*|boulder\S*)( |$)/u,
    'climbgym',
    ['Climbing gym', 'Скеледром'],
  ],
  [
    /(^| )(wspin\S*|laipio\S*|laipiojau|ronisin|ronida\S*)( |$)/u,
    'climbing',
    ['Rock climbing', 'Скелелазіння'],
  ],
  [/(^| )(nart\S*|slid\S*|suusata\S*|suusk\S*|suusatasin)( |$)/u, 'ski', ['Skiing', 'Лижі']],
  [
    /(^| )(pływ\S*|plyw\S*|przepłyn\S*|basen\S*|plauk\S*|baseine|baseinas|baseiną|uju\S*|bassein\S*)( |$)/u,
    'swim',
    ['Swimming', 'Плавання'],
  ],
  [
    /(^| )(rower\S*|dvirat\S*|dvirač\S*|dvirac\S*|numyn\S*|minau|miniau|ratta\S*|jalgratta\S*|rattaga)( |$)/u,
    'cycle',
    ['Cycling', 'Велосипед'],
  ],
  [
    /(^| )(wiosł\S*|wiosl\S*|irklav\S*|irklavau|soudsin|sõudsin)( |$)/u,
    'row',
    ['Rowing', 'Веслування'],
  ],
  [
    /(^| )(biega\S*|biegł\S*|biegl\S*|przebieg\S*|pobieg\S*|bieg|begau|begiau|nubegau|nubegiau|begiojau|begiojom\S*|jooks\S*|\d+ ?km bieg\S*)( |$)/u,
    'run',
    ['Running', 'Біг'],
  ],
  [
    /(^| )(spacer\S*|chodził\S*|chodzil\S*|vaiksc\S*|vaikšč\S*|pasivaiksc\S*|ejau|kond\S*|kõnd\S*|jaluta\S*|matka\S*|kroków|krokow|zingsni\S*|žingsni\S*|sammu\S*)( |$)/u,
    'walk',
    ['Walking', 'Ходьба'],
  ],
  [
    /(^| )(bieżni\S*|biezni\S*|orbitrek\S*|jooksulint\S*|kardio)( |$)/u,
    'cardio',
    ['Cardio', 'Кардіо'],
  ],
].map(([re, k, l]) => [foldRe(re as RegExp), k as string, l as [string, string]]);

/** Past tense, first person, in Polish (-łem/-łam), Lithuanian (-iau/-au) and Estonian (-sin). */
const PAST_X =
  /(^| )(\p{L}{2,}(łem|łam|liśmy|łyśmy|lem|lam)|\p{L}{2,}(iau|avau|ejau|egau|ėjau|ėgau)|\p{L}{2,}(sin|sime)|tegin|kaisin|käisin|olin|buvau|byłem|byłam|bylem|bylam)( |$)/u;
const AMOUNT_X = foldRe(
  /(\d+(?:[.,]\d+)?\s?(godz\S*|valand\S*|val|tund\S*|tundi|minut\S*|minuč\S*|minuc\S*)( |$))|(^| )(godzinę|godzine|dwie godziny|trzy godziny|pół godziny|pol godziny|półtorej godziny|valandą|valanda|dvi valandas|pusvalandį|pusvalandi|tund|tund aega|tunni|kaks tundi|pool tundi|poolteist tundi)( |$)/u,
);
const WHEN_X = foldRe(
  /(^| )(dziś|dzis|dzisiaj|wczoraj|rano|wieczorem|w weekend|šiandien|siandien|vakar|ryte|vakare|savaitgalį|tana|täna|eile|hommikul|õhtul|ohtul|nädalavahetusel)( |$)/u,
);
const YESTERDAY_X = /(^| )(wczoraj|vakar|eile)( |$)/u;

/** Said as done: a past-tense verb, first person (en / uk / ru, and Latin-typed). */
const PAST =
  /(^| )(i |we |just |also |then |and )?(ran|jogged|danced|swam|cycled|biked|rode|rowed|walked|hiked|trekked|climbed|bouldered|played|surfed|skied|skated|boxed|sparred|stretched|went|did|had|got back|spent|was at|was in|was on|were at|were in|finished|completed|tried|took|attended|burned|burnt)( |$)/u;
const PAST_CYR_VERBS =
  /(^| )(був|була|були|був на|ходив\S*|ходила|ходили|сходив\S*|сходила|їздив\S*|їздила|проїхав\S*|проїхала|зробив|зробила|займав\S*|займал\S*|грав|грала|грали|катав\S*|покатав\S*|пішов|пішла|пройшов|пройшла|потанцю\S*|поплав\S*|побіга\S*|пробіг|пробігла|проплив|пропливла|был|была|были|ходил\S*|сходил\S*|сделал\S*|катал\S*|играл\S*|пошел|пошла|прошел|прошла|пробежал\S*|проплыл\S*|потанцев\S*)( |$)/u;
/** Any Ukrainian / Russian past-tense verb ("доїхав", "каталась") — with an activity word it's a report. */
const CYR_PAST_ANY =
  /(^| )(?!(було|була|були|був|сила|мала|мали|мало|ціла|цілий|весела|біла)( |$))[а-яіїєґ]{3,}(ав|ив|ів|ув|яв|ала|ила|іла|яла|ула|али|или|іли|яли|ули|ався|ався|илась|алась|ались|ился|ался|ылся|ыл|ал|ил|ел)( |$)/u;
/** "…a day", "…a week" — how much one should do, not what was done. */
const NORM =
  /(^| )(a|per|each|every) (day|week)|(^| )(на|в|за) (день|тиждень|неделю)( |$)|(^| )(щодня|каждый день|every day|daily)( |$)/u;
/** How long / how far — a statement about a session. */
const AMOUNT =
  /(\d+(?:[.,]\d+)?\s?(h|hr|hrs|hour|hours|min|mins|minute|minutes|km|k|m|mi|mile|miles|год|годин\S*|хв|хвилин\S*|км|кілометр\S*|метр\S*|м|час|часа|часов|минут\S*|мин)( |$))|(^| )(an hour|half an hour|all day|all night|all evening|all weekend|hour and a half|годину|годинку|годинки|півгодини|пів години|півтори години|весь вечір|цілий день|всі вихідні|весь день|всю ніч|целый день|весь вечер|час|полчаса|полтора часа|hodynu|hodyny|hodyn|chas)( |$)/u;
/** When: today, yesterday, this morning, on Saturday… */
const WHEN =
  /(^| )(today|tonight|this morning|this evening|yesterday|last night|this weekend|on (monday|tuesday|wednesday|thursday|friday|saturday|sunday)|сьогодні|сегодня|сёдня|седня|сьодні|вчора|учора|вчера|зранку|вранці|ввечері|утром|вечером|в суботу|в неділю|у суботу|у неділю|на вихідних|sohodni|vchora|segodnya|vchera)( |$)/u;
/** Asked, not told: "can I run and lift?", "how many steps a day?". */
const QUESTION_HEAD =
  /^(how|what|what s|whats|when|which|should|can|could|is|are|am|does|do|will|would|why|where|who|any|хто|кто|скільки|як|коли|чи|що|шо|який|яка|які|яке|чому|навіщо|де|можна|треба|варто|сколько|как|когда|что|какой|какая|можно|нужно|стоит|почему|зачем|где|skilky|yak|chy|skolko|kak|jak|ile|czy|kiedy|co|dlaczego|czemu|kaip|kiek|ar|kada|ka|ką|kodel|kodėl|kuidas|mitu|kas|millal|mida|miks|palju)( |$)/u;
/** "did I / did you…" is a question, "did 45 min of yoga" is not. */
const DID_Q = /(^| )(did|do|does) (i|you|we|my)( |$)/u;
/** About the app: "how do I log a run", "як записати пробіжку в додатку". */
const APP_Q =
  /(in|on|to|into) (the )?(app|spotter)|(^| )(app|додат\S*|застосун\S*|приложени\S*|aplikacj\S*|apce|apka|apki|programel\S*|programėl\S*|apis|appis|äpis|äpp\S*|appi\S*)( |$)|how (do|can|to|should) (i )?(add|log|record|track|put|save)|where (do i|to|can i|should i) (add|log|record|put|see|track)|(як|де|куди) (мені )?(записати|додати|внести|записувати|зберегти)|(как|где) (записать|добавить)/u;
/** A gym session, not an activity ("ran out of time", "did chest"). */
const NOT_ACTIVITY =
  /(^| )(ran out|run out|run through|walk me|walk through|walking lunges?|farmers? walk|jog my memory)( |$)/u;

/** Complaints about the conversation itself. */
const COMPLAINT = new RegExp(
  [
    // en
    'why (not|aren t|arent|didn t|didnt|don t|dont|won t|wont|haven t|havent|are you not|did you not|do you not|no|you no)( \\S+){0,3} (comment\\S*|say\\S*|mention\\S*|react\\S*|respond\\S*|answer\\S*|notic\\S*|acknowledg\\S*|repl\\S*|talk\\S*|listen\\S*)',
    'you (didn t|didnt|did not|never|don t|dont|won t|wont|haven t|havent) (even )?(comment\\S*|say|said|mention\\S*|react\\S*|respond\\S*|answer\\S*|notic\\S*|acknowledg\\S*|repl\\S*|listen\\S*|hear\\S*|read\\S*|get it|understand)',
    'you (just |completely |totally )?ignor\\S*',
    'ignored (it|that|me|my|what)',
    'not what i (asked|said|meant|wrote)',
    'i (asked|was asking|was talking) about',
    'i (told|said to) you',
    'i didn t say|i didnt say|i never said',
    'you keep (saying|repeating)',
    '(isn t|isnt|not|wasn t|wasnt) (very |really |at all )?helpful|no help at all|doesn t help|doesnt help',
    'you never listen|are you even listening|do you even read',
    // the same reply again, in every language
    'you (keep|always|just keep) (giving|give|saying|say|repeating|telling|answering|sending)( \\S+){0,3} (same|the same)',
    '(same|identical) (answer|reply|thing) (again|every time|over and over)',
    'ти( \\S+){0,3} (одне (й|і) те саме|одно и то же)|ти (знову |весь час |постійно |завжди )?повторюєшся',
    '(ciagle|w kolko|znowu)( \\S+){0,2} (to samo|powtarzasz)|powtarzasz sie',
    '(^| )vis (ta pati|kartoji)|kartojiesi',
    '(kogu aeg|ikka|jälle) (sama|kordad)|kordad ennast',
    'ты( \\S+){0,3} (одно и то же|повторяешься)',
    'doesn t make sense|doesnt make sense|makes no sense|why did you (say|write|call|think|decide)',
    // uk
    'чому ти (це |мене |мені )?(не|ні) (коментуєш|відповідаєш|реагуєш|помітив|помічаєш|сказав|чуєш|слухаєш|прокоментував|відповів)',
    'ти (мене |навіть |взагалі |знову )*(не|ні) (прокоментував|коментуєш|відповів|відповідаєш|помітив|відреагував|слухаєш|чуєш|розумієш|читаєш)',
    'ти (мене )?ігноруєш|ігноруєш мене|проігнорував',
    'я ж (казав|казала|писав|писала)|я (тобі )?(казав|казала|писав|писала) (що|про)',
    'я (питав|питала) про|не (те|про те) (питав|питала)',
    'це не допомогло|не допомагає|ти не допоміг',
    'чому ти пишеш',
    // pl / lt / et (folded)
    '(^| )(ty )?(mnie )?nie (rozumiesz|sluchasz|słuchasz|odpowiadasz|odpowiedziales|odpowiedziałes|czytasz|slyszysz)',
    'ignorujesz|zignorowales|zignorowałes',
    '(^| )tu (manes |mane )?(nesupranti|neklausai|neatsakei|neatsakai|neskaitai|ignoruoji)',
    '(^| )(nesupranti|neklausai) (manes|mane)',
    '(^| )sa ei (saa|kuula|vasta|vastanud|loe)( \\S+){0,3}',
    'sa ignoreerid|ignoreerisid',
    // ru
    'почему (ты )?(это )?не (комментируешь|отвечаешь|реагируешь|ответил)',
    'ты (меня )?(не слушаешь|не понимаешь|не ответил|игнорируешь)',
    'я же (говорил|писал|сказал)',
  ].join('|'),
  'u',
);

export function isComplaint(question: string): boolean {
  return COMPLAINT.test(normalize(question).replace(/’/g, ' '));
}

/** "2 hours", "90 min", "півтори години", "час" → minutes. */
function minutesOf(p: string): number | null {
  const h =
    /(\d+(?:[.,]\d+)?)\s?(h|hr|hrs|hour|hours|год|годин\S*|час|часа|часов|hodyn\S*)( |$)/u.exec(p);
  const m = /(\d+(?:[.,]\d+)?)\s?(min|mins|minute|minutes|хв|хвилин\S*|минут\S*|мин)( |$)/u.exec(p);
  let total = 0;
  if (h) total += Number(h[1].replace(',', '.')) * 60;
  if (m) total += Number(m[1].replace(',', '.'));
  if (total > 0) return Math.round(total);
  const hx = /(\d+(?:[.,]\d+)?)\s?(godz\S*|valand\S*|val|tund\S*|tundi)( |$)/u.exec(p);
  const mx = /(\d+(?:[.,]\d+)?)\s?(minut\S*|minuc\S*)( |$)/u.exec(p);
  if (hx || mx) {
    const t =
      (hx ? Number(hx[1].replace(',', '.')) * 60 : 0) + (mx ? Number(mx[1].replace(',', '.')) : 0);
    if (t > 0) return Math.round(t);
  }
  if (/(^| )(dwie godziny|dvi valandas|kaks tundi)( |$)/u.test(p)) return 120;
  if (/(^| )(poltorej godziny|pusantros valandos|poolteist tundi)( |$)/u.test(p)) return 90;
  if (/(^| )(pol godziny|pusvalandi|pool tundi)( |$)/u.test(p)) return 30;
  if (/(^| )(godzine|valanda|tund|tund aega|tunni)( |$)/u.test(p)) return 60;
  if (/(^| )(hour and a half|півтори години|полтора часа)( |$)/u.test(p)) return 90;
  if (/(^| )(half an hour|півгодини|пів години|полчаса)( |$)/u.test(p)) return 30;
  if (/(^| )(two hours|дві години|два часа|dvi hodyny)( |$)/u.test(p)) return 120;
  if (/(^| )(three hours|три години|три часа)( |$)/u.test(p)) return 180;
  if (/(^| )(an hour|one hour|a full hour|годину|годинку|годинки|час|hodynu|chas)( |$)/u.test(p))
    return 60;
  return null;
}

/** "5k", "30 km", "1500m", "3 miles", "half marathon" → km. */
function kmOf(p: string): number | null {
  if (/(^| )half marathon( |$)|напівмарафон|полумарафон/u.test(p)) return 21.1;
  if (/(^| )marathon( |$)|(^| )марафон( |$)/u.test(p)) return 42.2;
  const km = /(\d+(?:[.,]\d+)?)\s?(km|k|км|кілометр\S*|километр\S*)( |$)/u.exec(p);
  if (km && !/steps|кроків|шагов/u.test(p)) return Number(km[1].replace(',', '.'));
  const mi = /(\d+(?:[.,]\d+)?)\s?(mi|mile|miles|мил\S*)( |$)/u.exec(p);
  if (mi) return Math.round(Number(mi[1].replace(',', '.')) * 1.609 * 10) / 10;
  const m = /(\d{3,5})\s?(m|м|метр\S*)( |$)/u.exec(p);
  if (m) return Number(m[1]) / 1000;
  return null;
}

/** How many days back the message puts it (0 = today). */
function daysAgoOf(p: string, now: number): number {
  if (
    /(^| )(yesterday|last night|вчора|учора|вчера|vchora|vchera)( |$)/u.test(p) ||
    YESTERDAY_X.test(p)
  )
    return 1;
  const wd = parseWeekdays(p.split(' '));
  if (wd.length) {
    const today = new Date(now).getDay();
    const back = (today - wd[0] + 7) % 7;
    return back === 0 ? 7 : back;
  }
  return 0;
}

/**
 * A report of an activity done, or null. Needs an activity word AND a sign it
 * happened (a past verb, an amount, a "today / yesterday") — and it must not
 * be a question about the topic or about logging it in the app.
 */
export function activityReport(
  question: string,
  now: number,
  /**
   * The grammar's reading: a past-tense statement by the user ("grałem",
   * "nubėgau", "jooksin"); asked / planned rather than told; only in a condition.
   */
  grammar: { told?: boolean; asked?: boolean; hypothetical?: boolean } = {},
): ActivityReport | null {
  const told = !!grammar.told;
  const p = normalize(question);
  if (!p || APP_Q.test(p) || NOT_ACTIVITY.test(p)) return null;
  const hit = KINDS.find(([re]) => re.test(p)) ?? KINDS_X.find(([re]) => re.test(p));
  if (!hit) return null;
  const complaint = isComplaint(question);
  // The first clause decides: "i went for a run, does it count?" is a report;
  // "can I run after squats?" is a question.
  const first = normalize(question.split(/[,.;!?]/u)[0] ?? '') || p;
  const asked = QUESTION_HEAD.test(first) || DID_Q.test(first);
  const past =
    (PAST.test(p) && !DID_Q.test(p)) ||
    PAST_CYR_VERBS.test(p) ||
    hitPastOnActivity(p) ||
    CYR_PAST_ANY.test(p) ||
    PAST_X.test(p) ||
    told;
  const amount = AMOUNT.test(p) || AMOUNT_X.test(p);
  const when = WHEN.test(p) || WHEN_X.test(p);
  if (asked) return null;
  // "30 min cardio after lifting, good or bad?", "if I skipped a workout, …?" —
  // asked about, not told.
  if (grammar.hypothetical || (grammar.asked && !past)) return null;
  // "10k steps a day enough?" — a norm asked about, not a session told.
  if (!past && (/^[^,.;!?]*\?/u.test(question) || NORM.test(p))) return null;
  if (!past && !amount && !(when && !asked)) return null;
  // "I play football, how should I lift?" — present tense, no amount: a topic question.
  if (
    !past &&
    !amount &&
    /(^| )(i|we|я|ми) (play|do|train|грають|граю|займаюсь|тренуюсь)( |$)/u.test(p)
  )
    return null;
  return {
    kind: hit[1],
    label: hit[2],
    minutes: minutesOf(p),
    km: kmOf(p),
    daysAgo: daysAgoOf(p, now),
    complaint,
  };
}

/** A past-tense form that is itself an activity word ("танцював", "плавала", "бегал", "tantsiuvav"). */
function hitPastOnActivity(p: string): boolean {
  return p.split(' ').some((w) => {
    if (
      !/(ав|ів|ив|ла|ли|вся|лась|лася|лись|лися|ал|ял|ил|ел|uvav|uvala|yvav|ivav|avav|ala|al|av)$/u.test(
        w,
      )
    )
      return false;
    return KINDS.some(([re]) => re.test(w));
  });
}

const fmtNum = (x: number, uk: boolean) => {
  const r = Math.round(x * 10) / 10;
  return uk ? String(r).replace('.', ',') : String(r);
};

/** "2 h", "45 min" / "2 год", "45 хв". */
function durationText(min: number, uk: boolean): string {
  if (min < 60) return uk ? `${min} хв` : `${min} min`;
  return uk ? `${fmtNum(min / 60, true)} год` : `${fmtNum(min / 60, false)} h`;
}

/** Recovery kinds ease the load; the rest add to it. */
/** Sports that load the upper body and grip more than the legs. */
const UPPER = new Set(['boxing', 'martial', 'climbing', 'climbgym']);
const RECOVERY = new Set(['yoga', 'mobility', 'massage', 'sauna', 'cold']);

/** The answer: acknowledged, what it means for lifting, and "log it?". */
export function activityAnswer(
  r: ActivityReport,
  c: AskCtx,
  L: Tr,
): { text: string; chips: string[]; action?: AtlasAction } {
  const uk = c.locale === 'uk';
  const out: string[] = [];
  if (r.complaint)
    out.push(
      L('Fair — you told me and I talked past it.', 'Справедливо — ти казав, а я проґавив.'),
    );
  out.push(L(`${r.label[0]} — that counts.`, `${r.label[1]} — це зараховується.`));
  // Its own sentence, so pl / lt / et translate it from a handful of templates.
  const time = r.minutes ? durationText(r.minutes, uk) : null;
  const km = r.km ? fmtNum(r.km, uk) : null;
  if (time && km)
    out.push(L(`Time: ${time}, distance: ${km} km.`, `Час: ${time}, відстань: ${km} км.`));
  else if (time) out.push(L(`Time: ${time}.`, `Час: ${time}.`));
  else if (km) out.push(L(`Distance: ${km} km.`, `Відстань: ${km} км.`));
  const long = (r.minutes ?? 0) >= 60 || (r.km ?? 0) >= 10;
  if (RECOVERY.has(r.kind))
    out.push(
      L(
        'That’s recovery work — it eases your load rather than adds to it. Good call.',
        'Це відновлення — воно знімає навантаження, а не додає. Правильно.',
      ),
    );
  else if (UPPER.has(r.kind))
    out.push(
      L(
        'That hits shoulders, arms and grip more than legs. Go lighter on heavy pressing and pulling today; legs are fine.',
        'Це більше плечі, руки й хват, ніж ноги. Важкі жими й тяги сьогодні легше, ноги можна.',
      ),
    );
  else if (r.kind === 'swim')
    out.push(
      L(
        'Mostly back, shoulders and your heart, low impact on the legs — go a bit lighter on heavy pulling today.',
        'Це здебільшого спина, плечі й серце, ноги майже не б’є — важкі тяги сьогодні трохи легше.',
      ),
    );
  else if (long)
    out.push(
      L(
        'That’s real conditioning load, mostly legs and your heart. Treat your legs as trained today: no heavy leg work until tomorrow, upper body is fine.',
        'Це повноцінне кардіонавантаження, переважно ноги й серце. Вважай, що ноги сьогодні вже потренував: важкі ноги — не раніше завтра, верх можна.',
      ),
    );
  else
    out.push(
      L(
        'Light-to-moderate conditioning — it won’t hurt your lifting; just don’t stack heavy legs right on top of it.',
        'Легке чи помірне кардіо — силовим не завадить; просто не став важкі ноги одразу після нього.',
      ),
    );
  const at = c.now - r.daysAgo * DAY - (r.minutes ?? 0) * 60_000;
  const day = Math.floor(at / DAY);
  const logged = (c.s.activities ?? []).some(
    (a) => a.type === r.kind && Math.floor(a.startedAt / DAY) === day,
  );
  const chips = [
    L('Am I recovered?', 'Я відновився?'),
    L('What should I train today?', 'Що тренувати сьогодні?'),
  ];
  if (logged) {
    out.push(
      L(
        'I see it in your log — it’s in your weekly load already.',
        'Бачу це в журналі — воно вже у твоєму тижневому навантаженні.',
      ),
    );
    return { text: out.join(' '), chips };
  }
  if (!r.minutes) {
    out.push(
      L(
        'Log it under Activities with the time, and I’ll count it in your load and recovery.',
        'Запиши це в «Активності» з часом — і я врахую його в навантаженні й відновленні.',
      ),
    );
    return { text: out.join(' '), chips };
  }
  out.push(
    L(
      'Want me to log it? Then it counts in your weekly load and recovery.',
      'Записати? Тоді воно піде у тижневе навантаження й відновлення.',
    ),
  );
  return {
    text: out.join(' '),
    chips,
    action: {
      type: 'activity',
      kind: r.kind,
      minutes: r.minutes,
      km: r.km,
      at: Math.max(0, at),
    },
  };
}
