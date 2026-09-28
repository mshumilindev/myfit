/**
 * Round 12: the gaps the five-language exam showed (eval/corpus*.ts) —
 * wishes said as statements ("I just want to get big"), "no longer hurts",
 * time lost to a break, the app itself, and Polish / Lithuanian / Estonian
 * ways of asking the everyday topics. Written as new phrasings, never copies
 * of the exam's messages.
 */
export const KB_R12: Record<string, { ex: string[]; exUk: string[] }> = {
  muscle_gain_rate: {
    ex: [
      'i just want to be bigger',
      'my goal is to put on muscle, not lose weight',
      'i want size, not to get skinny',
      'i want muscle mass',
      'i only care about getting big',
      'chcę przybrać na masie mięśniowej',
      'chcę mieć więcej mięśni, nie chudnąć',
      'noriu priaugti raumenų masės',
      'noriu būti didesnis, ne lieknesnis',
      'tahan lihasmassi juurde saada',
      'tahan suuremaks minna, mitte kaalu kaotada',
    ],
    exUk: [
      'хочу просто набрати м’язи',
      'моя ціль — маса, а не схуднення',
      'хочу стати більшим',
      'хочу мʼязи, а не худнути',
    ],
  },
  bench_alone: {
    ex: [
      'bench pressing when no one is spotting me',
      'can i bench heavy without anyone spotting',
      'no one around to spot my bench, should i still go heavy',
      'is it ok to bench if nobody spots me',
      'bench without a spot, good idea?',
      'nobody to spot me on bench, is it safe',
      'benching heavy with no spotter around',
      'training alone, can i still go heavy on bench press',
      'czy mogę wyciskać ciężko bez asekuracji',
      'ar saugu spausti gulint be draudžiančio',
      'kas võin raskelt pinki suruda ilma julgestajata',
    ],
    exUk: ['жму сам без страховки, це безпечно', 'нема хто підстрахує на жимі'],
  },
  motivation: {
    ex: [
      "i'm just not in the mood to train",
      'zero drive to lift today',
      "can't get myself to go today",
      'nie chce mi się dziś ćwiczyć',
      'šiandien visai nesinori sportuoti',
      'täna ei ole üldse tahtmist trenni teha',
    ],
    exUk: ['зовсім нема настрою тренуватись', 'сьогодні не хочеться в зал взагалі'],
  },
  temper: {
    ex: [
      'be softer with me',
      "you're too harsh, tone it down",
      'bądź łagodniejszy',
      'būk švelnesnis',
      'ole leebem',
    ],
    exUk: ['перестань мене так сварити', 'будь м’якшим зі мною', 'не гноби мене'],
  },
  comeback: {
    ex: [
      'over my cold now, how do i ease back in',
      'recovered from being sick, can i start lifting again',
      'i used to train years ago, how do i start over',
      'lifted a lot in the past, returning now after years',
      'wracam na siłownię po kilku latach przerwy',
      'po chorobie wracam do treningów, od czego zacząć',
      'grįžtu į salę po kelių metų pertraukos',
      'pasveikau, kaip vėl pradėti sportuoti',
      'tulen jõusaali tagasi pärast pikka pausi',
      'olin haige, kuidas trenniga uuesti alustada',
    ],
    exUk: [
      'тиждень пропустив зал, як повертатись',
      'колись качався, тепер з чого почати',
      'кілька років не тренувався, як почати знову',
    ],
  },
  short_on_time: {
    ex: [
      'no time for a full workout today',
      'i have barely any time today',
      'only half an hour at the gym',
      'mam dziś mało czasu na trening',
      'turiu tik pusvalandį treniruotei',
      'mul on täna trenniks vähe aega',
    ],
    exUk: ['часу сьогодні обмаль', 'маю тільки пів години на зал', 'сьогодні ніколи, часу нема'],
  },
  k_paused_reps: {
    ex: ['why pause at the bottom of a bench rep', 'what does a paused bench do for me'],
    exUk: ['навіщо пауза на грудях у жимі'],
  },
  k_chinup_vs_pullup: {
    ex: [
      'chin ups or pull ups, which should i pick',
      'underhand or overhand pull up, which is better',
    ],
    exUk: ['підтягування прямим чи зворотним хватом, що краще'],
  },
  app_tour: {
    ex: [
      'how does this app work overall',
      'what can this app do for me',
      'what does spotter do',
      'give me a quick tour of the app',
    ],
    exUk: ['як загалом працює цей додаток', 'що вміє spotter'],
  },
  travel: {
    ex: [
      "i'll be on a trip next week, how do i keep lifting",
      'going away for work, how to keep my training going',
    ],
    exUk: ['їду у відпустку, як не закинути тренування'],
  },
  warmup: {
    ex: ['i always skip warming up, is that a problem', "i don't really warm up at all, should i"],
    exUk: ['ніколи не розминаюсь перед залом, це погано'],
  },
  return_injury: {
    ex: [
      'the pain is gone, when can i deadlift again',
      "my back doesn't hurt anymore, can i go back to squats",
      'no more pain in my knee, when do i start lunges again',
      'już nie boli, kiedy mogę wrócić do martwego ciągu',
      'jau nebeskauda, kada galiu vėl daryti pritūpimus',
      'enam ei valuta, millal võin jälle kükitada',
    ],
    exUk: ['вже не болить, коли повертатись до присідань', 'біль минув, коли знову можна тягу'],
  },
  bw_trend: {
    ex: [
      'i went up 3 kg this month, is that fat or muscle',
      'my weight jumped from 80 to 83, what does it mean',
    ],
    exUk: ['вага піднялась на 3 кг за місяць, це жир?'],
  },
  home: {
    ex: [
      'the gym is closed today, what can i do at home',
      'gym shut for the holiday, home workout?',
    ],
    exUk: ['зал зачинений, що робити вдома', 'сьогодні зал не працює, тренуватись вдома?'],
  },
  plateau: {
    ex: ['i have been stuck at the same weight on bench for months'],
    exUk: ['вже кілька місяців стою на одній вазі в жимі', 'пів року не росте жим, що змінити'],
  },
  rest_day: {
    ex: ['do i actually need days off', 'are rest days necessary'],
    exUk: ['чи треба дні відпочинку взагалі', 'чи потрібні вихідні від залу'],
  },
  fat_loss: {
    ex: ['for losing fat, cardio or lifting weights', 'which burns more fat, running or weights'],
    exUk: ['що краще щоб схуднути, кардіо чи залізо', 'для спалення жиру біг чи штанга'],
  },
  other_sport: {
    ex: ['i train bjj three times a week, how much lifting should i add'],
    exUk: ['займаюсь боротьбою тричі на тиждень, скільки додати залу'],
  },
  insult: {
    ex: ['you are trash', 'you are useless'],
    exUk: ['ти нікчемний', 'ти сміття'],
  },
  k_measurements: {
    ex: ['which body measurements should i take'],
    exUk: ['які заміри тіла знімати', 'що міряти сантиметром на тілі'],
  },
  technique_lift: {
    ex: ['how do i fix my squat form', 'what is wrong with my squat and how to fix it'],
    exUk: ['як виправити техніку присіду', 'як поправити присід'],
  },
  cardio: {
    ex: ['does swimming count as cardio', 'is a bike ride enough cardio'],
    exUk: ['плавання рахується як кардіо?', 'велосипед це кардіо чи ні'],
  },
  k_no_soreness: {
    ex: ["my muscles don't ache after the gym anymore, still growing?"],
    exUk: ['м’язи вже не болять після тренувань, це нормально?', 'не відчуваю крепатури, я росту?'],
  },
  skip: {
    ex: ['exhausting week, should i still hit the gym today'],
    exUk: ['тиждень був важкий, йти сьогодні на тренування чи пропустити'],
  },
  today: {
    ex: ['heading to the gym in an hour, what is the plan'],
    exUk: ['скоро йду в зал, що сьогодні по плану'],
  },
  sleep: {
    ex: [
      'ile snu potrzeba do budowy mięśni',
      'ile godzin spać żeby rosły mięśnie',
      'kiek reikia miegoti raumenų augimui',
      'kiek valandų miegoti kad augtų raumenys',
      'mitu tundi peaks magama, et lihased kasvaks',
    ],
    exUk: [],
  },
  strength_vs_size: {
    ex: [
      'siła czy masa, na czym się skupić',
      'trenować na siłę czy na masę',
      'jėga ar raumenų masė, ką rinktis',
      'kas treenida jõu või lihasmassi peale',
    ],
    exUk: [],
  },
  alternatives: {
    ex: [
      'czym mogę zastąpić wyciskanie',
      'jakie ćwiczenie zamiast przysiadów',
      'kuo galiu pakeisti pritūpimus',
      'koks pratimas vietoj spaudimo',
      'millega saab pinki asendada',
      'mis harjutus kükkide asemel',
    ],
    exUk: [],
  },
  k_nausea: {
    ex: [
      'robi mi się niedobrze na treningu nóg',
      'mdli mnie po ciężkim treningu',
      'pykina po sunkios treniruotės',
      'treniruotėje darosi bloga',
      'pärast rasket trenni on süda paha',
      'trennis hakkab iiveldama',
    ],
    exUk: [],
  },
  app_edit_workout: {
    ex: [
      'jak poprawić zapisany trening',
      'jak zmienić serię w starym treningu',
      'kaip pataisyti įrašytą treniruotę',
      'kuidas salvestatud trenni parandada',
    ],
    exUk: [],
  },
  app_rest_period: {
    ex: [
      'jak zatrzymać plan na czas wakacji',
      'wyjeżdżam na urlop, jak wstrzymać treningi w aplikacji',
      'kaip sustabdyti planą atostogoms',
      'kuidas kava puhkuse ajaks peatada',
    ],
    exUk: [],
  },
  app_progress_view: {
    ex: [
      'gdzie w aplikacji są moje postępy',
      'gdzie zobaczę rekordy w apce',
      'kur programėlėje matyti progresą',
      'kus äpis on minu areng ja rekordid',
    ],
    exUk: [],
  },
  progress_lift: {
    ex: [
      'jak mi idzie przysiad ostatnio',
      'jak postępuje moje wyciskanie',
      'kaip sekasi mano spaudimas',
      'kaip progresuoja pritūpimai',
      'kuidas mu kükk edeneb',
      'kas mu lõuatõmbed paranevad',
    ],
    exUk: [],
  },
  compare_lifts: {
    ex: [
      'porównaj mój przysiad i martwy ciąg',
      'wyciskanie a przysiad, porównanie',
      'palygink mano spaudimą su pritūpimais',
      'võrdle minu kükki ja jõutõmmet',
    ],
    exUk: [],
  },
  volume_muscle: {
    ex: [
      'ar pakankamai serijų darau krūtinei',
      'ar užtenka treniruočių kojoms',
      'kas ma teen jalgadele piisavalt seeriaid',
      'czy robię wystarczająco na nogi',
    ],
    exUk: [],
  },
  split_choice: {
    ex: [
      'koks padalijimas geriausias treniruotėms',
      'kokį treniruočių skirstymą rinktis',
      'milline treeningjaotus sobib kõige paremini',
      'jaki podział treningowy wybrać',
    ],
    exUk: [],
  },
  k_ankle_mobility: {
    ex: [
      'pritūpiant kulnai atsikelia nuo žemės',
      'pięty mi się podnoszą przy przysiadzie',
      'kükis tõusevad kannad maast lahti',
    ],
    exUk: [],
  },
  k_program_boredom: {
    ex: [
      'nusibodo tos pačios treniruotės',
      'mano programa pabodo',
      'znudził mi się mój plan treningowy',
      'mul on oma kavast kõrini',
    ],
    exUk: [],
  },
  k_joint_clicking: {
    ex: [
      'keliai traška kai tupiu',
      'traška pečiai spaudžiant',
      'trzeszczy mi w barku przy wyciskaniu',
      'põlved ragisevad kükitades',
    ],
    exUk: [],
  },
  k_magnesium: {
    ex: [
      'ar verta gerti magnį',
      'magnis nuo traukulių ar veikia',
      'czy magnez pomaga na skurcze',
      'kas magneesium aitab lihaskrampide korral',
    ],
    exUk: [],
  },
  app_finish_session: {
    ex: [
      'kaip baigti treniruotę programėlėje',
      'kur paspausti kad užbaigčiau treniruotę',
      'jak zakończyć sesję w aplikacji',
      'kuidas äpis trenn lõpetada',
    ],
    exUk: [],
  },
  you_dumb: {
    ex: ['tu manęs visai nesupranti', 'nie rozumiesz o co pytam', 'sa ei saa üldse aru'],
    exUk: [],
  },
  act_swap: {
    ex: [
      'pakeisk spaudimą gulint į spaudimą su hantelėmis',
      'zamień wyciskanie na wyciskanie hantli',
      'vaheta pink hantlitega surumise vastu',
    ],
    exUk: [],
  },
  act_avoid: {
    ex: [
      'nemėgstu pritūpimų, išimk juos',
      'nie znoszę martwego ciągu',
      'mulle ei meeldi kükid, võta need kavast välja',
    ],
    exUk: [],
  },
  k_detraining: {
    ex: [
      'kiek raumenų prarasiu per mėnesį nesportuodamas',
      'jak szybko tracę siłę bez treningu',
      'kui kiiresti jõud kaob kui ei treeni',
    ],
    exUk: [],
  },
  strength_ratio: {
    ex: [
      'kas mu kükk on kehakaalu kohta tugev',
      'czy mój przysiad jest dobry jak na moją wagę',
      'ar mano spaudimas geras pagal kūno svorį',
    ],
    exUk: [],
  },
  percent_max: {
    ex: ['80% mu pingist', '70% mojego martwego ciągu', '75% mano spaudimo'],
    exUk: [],
  },
  cooldown: {
    ex: [
      'kas pärast trenni tuleks maha jahtuda',
      'czy po treningu robić schłodzenie',
      'ar reikia atvėsti po treniruotės',
    ],
    exUk: [],
  },
  superset: {
    ex: ['kas superseeriad on kasulikud', 'czy superserie mają sens', 'ar verta daryti supersetus'],
    exUk: [],
  },
  running: {
    ex: [
      'kas jooksmine segab jõutrenni',
      'czy bieganie przeszkadza w budowaniu siły',
      'ar bėgiojimas trukdo jėgos treniruotėms',
    ],
    exUk: [],
  },
  fats: {
    ex: [
      'kui palju rasvu peaks päevas sööma',
      'ile tłuszczów jeść dziennie',
      'kiek riebalų suvalgyti per dieną',
    ],
    exUk: [],
  },
  k_chalk: {
    ex: [
      'kas kasutada kätele magneesiumi pulbrit',
      'czy używać magnezji do chwytu',
      'magnezija rankoms prieš mirties trauką, reikia?',
    ],
    exUk: [],
  },
  k_knees_over_toes: {
    ex: [
      'kas põlved tohivad kükis varvastest üle minna',
      'czy kolana mogą wychodzić przed palce',
      'ar keliai gali išeiti už kojų pirštų',
    ],
    exUk: [],
  },
  k_creatine_myths: {
    ex: [
      'kas kreatiin põhjustab juuste väljalangemist',
      'czy od kreatyny wypadają włosy',
      'girdėjau kad kreatinas slinkdina plaukus, tiesa?',
    ],
    exUk: [],
  },
  app_bodyweight_log: {
    ex: [
      'kuhu äpis oma kaal kirjutada',
      'gdzie wpisać wagę ciała w apce',
      'kur įrašyti savo svorį programėlėje',
    ],
    exUk: [],
  },
  mood_down: {
    ex: ['mul on täna halb tuju', 'mam dziś kiepski humor', 'šiandien bloga nuotaika'],
    exUk: [],
  },
  act_rest: {
    ex: [
      'pingil puhkepaus 2 minutit',
      'przerwa na przysiadach 3 minuty',
      'poilsis spaudimui 2 minutės',
    ],
    exUk: [],
  },
  pullup_zero: {
    ex: [
      'kuidas teha oma esimene lõuatõmme',
      'od czego zacząć, żeby się pierwszy raz podciągnąć',
      'niekada nesu prisitraukęs, nuo ko pradėti',
    ],
    exUk: [],
  },
  k_protein_per_meal: {
    ex: [
      'kiek baltymų įsisavinama per vieną valgį',
      'ile białka organizm przyswoi naraz',
      'kui palju valku keha korraga omastab',
    ],
    exUk: [],
  },
  k_calisthenics: {
    ex: [
      'kaip progresuoti treniruojantis tik su savo svoriu',
      'jak robić postępy ćwicząc z masą ciała',
      'kuidas areneda ainult kehakaaluga',
    ],
    exUk: [],
  },
};
