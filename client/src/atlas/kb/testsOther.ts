/** Held-out pl / lt / et questions (2 per topic per language) — never used for matching. */
export const KB_TESTS_OTHER: Record<string, { pl: string[]; lt: string[]; et: string[] }> = {
  pain: {
    pl: ['bolii mnie bark jak podnosze reke', 'czuję ból w kolanie przy wypadach, co mam zrobić'],
    lt: ['nugara skaudą po treniruotės, ką man daryti', 'jaučiu skausmą klubuose, stabdyti?'],
    et: ['olg valutab kas peaks trenni pooleli jatma', 'kael valutb peale treeningut'],
  },
  rest: {
    pl: ['ile odpoczywać przy izolacjach', 'ile czasu przerwy miedzy seryjami'],
    lt: ['kiek poilsio tarp serijų raumenų augimui', 'kiek laiko ilsėtis tarp prieijimų?'],
    et: ['paus seeriate vahel kui pikk', 'kui kaua puhata seerate vahel'],
  },
  next_weight: {
    pl: ['ostatnio zrobiłem 80 na ławce, ile teraz?', 'jaki ciężarr na martwy ciag teraz'],
    lt: ['su kokiu svoriu dirbti šiandien', 'kiek dėt ant grifo kita treniruotę'],
    et: ['palju kangile panna tana', 'mis raskusga jargmisena kukkida'],
  },
  best: {
    pl: ['mój najlepszy wynik w martwym ciągu', 'jakie mam rekordy we wszytkich bojach'],
    lt: ['ar galiu pamatyt savo rekordus', 'geriausi mano kėlimai'],
    et: ['mis on mu parim joutomme', 'mu isiklkud rekordid'],
  },
  progress_lift: {
    pl: ['czy moje wiosłowanie się poprawiło', 'jak wyglada moj postep na klacie'],
    lt: ['ar judu i prieki su spaudimu', 'koks mano progresas prisitraukimuose'],
    et: ['kuidas mu kukk edeneb', 'kas mu joutõmme on paranend'],
  },
  volume_muscle: {
    pl: ['policz moje serie na klatkę z tego tygodnia', 'ile seri na tricepsa zrobilem'],
    lt: ['kiek priejimu padariau bicepsui', 'savaitės serijos pagal raumenis'],
    et: ['seljale seeriaid kokku', 'mitu seeraid jalgadele tegin'],
  },
  weak: {
    pl: ['czy mam jakieś zaległości w którejś partii', 'słabe strony mojego treningu'],
    lt: ['ar per mazai kojų darau lyginant su viršum', 'kur mano spragos treniruotėse'],
    et: ['kas mu treening on tasakaalus voi mitte', 'mida ma unustan treenda'],
  },
  recovery: {
    pl: ['czy barki doszły do siebie', 'czy moje miesnie sa gotowe'],
    lt: ['ar kojos atsigavusios?', 'ar as jau atsigaves'],
    et: ['kas jalad on juba taastunud voi veel ei', 'mis lihased on valmis trenniks'],
  },
  today: {
    pl: ['na co iść dzisiaj?', 'co dzis robimy na treningu'],
    lt: ['kas šiandien pagal planą', 'ką šiandien sportuojam'],
    et: ['tanane kava', 'mda ma täna teen'],
  },
  tomorrow: {
    pl: ['jutro trenuje?', 'co jutro trenuje w planie'],
    lt: ['rytoj einu į salę, kas laukia?', 'rytoj kokia diena'],
    et: ['kas homme on puhkepaev', 'homne treenng'],
  },
  next_session: {
    pl: ['pokaż następny trening z planu', 'kiedy nastepny trning'],
    lt: ['ką darysiu kitoje treniruotėje', 'kada kitas sportas'],
    et: ['mis on jargmine treening', 'millal järgmne trennipäev on'],
  },
  last_session: {
    pl: ['jak mi poszło ostatnim razem na siłowni', 'co robiłem na poprzedniej sesji'],
    lt: ['ka dariau vakar sale', 'parodyk ką kėliau paskutinį kartą'],
    et: ['mida ma eelmine kord tegin trennis', 'naita viimast treenigut'],
  },
  week: {
    pl: ['ocena mojego tygodnia treningowego', 'ile treningow w tym tygodni'],
    lt: ['ar gera buvo mano savaitė', 'parodyk šios savaitės treniruotes'],
    et: ['kuidas mu nadal laks', 'mitu trenni sell nädalal'],
  },
  streak: {
    pl: ['czy mój streak jest wciąż aktywny', 'ile tygodni z rzędu trenuję'],
    lt: ['kiek laiko nepraleidau treniruočių', 'mano rekordinė serija'],
    et: ['mis mu streak on', 'kui pikk mu jarjestkune seeria'],
  },
  total: {
    pl: ['ile trenignów łącznie', 'od kiedy używam apki, ile było treningów?'],
    lt: ['kiek jau esu sportavęs iš viso', 'mano treniruočių skaičius'],
    et: ['treeningute arv kokku kogu aja', 'mitu treenigut ma teinud olen'],
  },
  sleep: {
    pl: ['czy za mało śpię na regenerację', 'ile spie w tygodniu'],
    lt: ['ar per mažai miegu treniruotėms', 'miego vidurkis šią savaitę'],
    et: ['mu une keskmine sel nadalal', 'kas ma magan piisavlt'],
  },
  deload: {
    pl: ['czy potrzebuje deloadu', 'kiedy mam zrobic deloud'],
    lt: ['kiek dažnai daryti iškrovą', 'jaučiuosi pavargęs, gal laikas iškrovai?'],
    et: ['kas peaks deloadi tegema', 'mis on deload nadal'],
  },
  plan: {
    pl: ['co jest w moim planie', 'jaki mam plam'],
    lt: ['kokios dienos ką treniruoju pagal programą', 'koks mano treniruociu splitas'],
    et: ['mis mu treeningplaan on', 'mu progamm'],
  },
  skip: {
    pl: ['skip dzisiaj ok?', 'czy moge odpuscic trening'],
    lt: ['ar bus blogai jei šiandien neisiu', 'galiu siandien nesportuot?'],
    et: ['skipin tana trenni, kas ok', 'kas võin trenni vahel jätta'],
  },
  motivation: {
    pl: ['cos mi sie nie chce', 'nie moge się zebrać na siłownię'],
    lt: ['prarandu motyvaciją', 'tingisi siandien'],
    et: ['pole motivatsiooni', 'mul ei ole motivatsjooni'],
  },
  warmup: {
    pl: ['pomiń rozgrzewkę czy nie?', 'jak sie rozgrewać przed treningiem'],
    lt: ['apšilimo pratimai', 'kaip apsildyt raumenis'],
    et: ['kas soojendus on vajalk', 'soojendus enne treeningut kuidas'],
  },
  cooldown: {
    pl: ['czy potrzebny jest cool down', 'czy trzeba sie schladzac po silowni'],
    lt: ['ar būtina pasitampyti po sporto', 'kaip nurimti po treniruotes'],
    et: ['jahutus parast treeningut', 'kuidas trenni jarel jahtuda'],
  },
  cardio: {
    pl: ['ile minut cardio tygodniowo', 'czy robic kardio'],
    lt: ['ar kardio reikalingas', 'kiek kartu per savaite kardio'],
    et: ['kardio enne voi parast joutrenni', 'palju kardiot peaks tegma'],
  },
  reps: {
    pl: ['ile powtorzen na mase', 'ile powtórzen na serie'],
    lt: ['koks optimalus pakartojimų skaičius', 'kiek pakartojimų per setą daryt'],
    et: ['korduste arv seerias', 'mitu kordus lihasmassiks'],
  },
  failure: {
    pl: ['czy robić do odmowy na każdej serii', 'czy dochodzic do upadku miesniowego'],
    lt: ['ar treniruotis iki raumenų nesekmės', 'ar gerai eit iki nebegalejimo'],
    et: ['kas iga seeria peab lopuni minema', 'kas lihase vasimuseni treenmine on halb'],
  },
  bodyweight: {
    pl: ['moja aktualna waga ciała', 'ile wynosi moja waga'],
    lt: ['paskutinis mano svorio įrašas', 'kiek dabar sveriu kg'],
    et: ['mis mu kehakaal praegu on', 'mu viimne kaalumine'],
  },
  session_length: {
    pl: ['mój średni czas sesji', 'ile czasu powiniem trenować'],
    lt: ['kiek laiko praleidžiu salėje', 'kiek ilgai sportuot'],
    et: ['kaua mu trennid kestavad keskmiselt', 'kui pik treening peaks olema'],
  },
  swap: {
    pl: ['zamiennik dla wioslowania', 'jak zmienic cwiczenie'],
    lt: ['negaliu daryti traukos, kuo pakeisti?', 'kaip sukeisti pratimą kitu'],
    et: ['kuidas harjutust asendada', 'kas saab harjutust vahetda'],
  },
  technique: {
    pl: ['jak sprawdzić czy mam dobrą technikę', 'tehnika przysiadu'],
    lt: ['kaip nesugadint technikos', 'kaip taisyklingai atlikti pratimą'],
    et: ['kuidas kukki oigesti teha', 'pingil surumise tehnka'],
  },
  protein: {
    pl: ['dieta na mięśnie', 'ile białka powinienem jesc'],
    lt: ['kiek baltymų reikia sportininkui', 'kiek balltymų man reikia'],
    et: ['kui palju proteiini vaja', 'mitu grammi valku kilo kohta paevas'],
  },
  supplements: {
    pl: ['czy przedtreningówka ma sens', 'jakie suplemnty polecasz'],
    lt: ['ar būtina baltymų kokteilis ir kreatinas', 'kokius papildus rekomenduoji'],
    et: ['mis toidulisandeid votta', 'kas kreatin on ohutu'],
  },
  temper: {
    pl: ['nie krzycz na mnie', 'badz milszy prosze'],
    lt: ['gali būti griežtesnis?', 'kaip pakeist tavo bendravimo stilių'],
    et: ['ole kenam', 'miks sa nii ranga oled'],
  },
  who: {
    pl: ['jakie masz funkcje', 'help'],
    lt: ['kokius klausimus galiu tau užduoti', 'padek'],
    et: ['mida sa oskad', 'mis sa tead teha'],
  },
  thanks: {
    pl: ['dzięki za pomoc', 'dziekuje bardzo'],
    lt: ['dėkoju', 'ačiu'],
    et: ['tanan', 'tanks'],
  },
  greeting: {
    pl: ['cześć atlas', 'dobry wieczór'],
    lt: ['labas vakaras', 'sveikutis'],
    et: ['tsaw', 'hommikust atlas'],
  },
  ack: {
    pl: ['zrozumiałem', 'dobrze'],
    lt: ['puiku', 'suprantu'],
    et: ['sain aru, aitah', 'selgee'],
  },
  muscle_last: {
    pl: ['kiedy ostatnio miałem trening ramion', 'kiedy ostanio robilem brzuch'],
    lt: ['kada paskutini kart kojos buvo', 'prieš kiek dienų dariau krūtinę'],
    et: ['millal viimati selga treenisin', 'millal ma viimti rinda tegin'],
  },
  lift_last: {
    pl: ['kiedy ostatnio robiłem hip thrust', 'kiedy ostatnio wyciskalem'],
    lt: ['kada dariau atsispaudimus ant lygiagrečių', 'kada paskutinį kart spaudžiau'],
    et: ['millal ma viimati kykke tegin', 'millal viimati pingil surusn'],
  },
  lift_count: {
    pl: ['częstotliwość mojego martwego ciągu', 'ile razy robilem podciaganie'],
    lt: ['kiek sesijų turėjau su pritūpimais', 'kiek kartų esu daręs mirties trauką'],
    et: ['mitu korda olen joutõmmet teinud', 'kui tihti ma pingil surn'],
  },
  e1rm: {
    pl: ['estymowany maks na ławce', 'jakie mam 1rm na lawce'],
    lt: ['kiek būtų mano maksas traukoj', 'koks mano ivertintas 1rm'],
    et: ['arvuta mu kyki maks', 'mu hinnanguline maksimm joutõmbes'],
  },
  tonnage: {
    pl: ['tonaz tygodniowy', 'ile kg w sumie podniosłem'],
    lt: ['suskaičiuok kiek pakėliau per treniruotę', 'bendra apimtis kilogramais'],
    et: ['tonnaaz sel nadalal', 'mitu kilo tõstsin sel nädlal'],
  },
  muscle_frequency: {
    pl: ['ile razy na tydzien nogi', 'co ile dni trenować tę samą partię'],
    lt: ['kaip daznai daryt pecius', 'du kartus per savaitę krūtinė ok?'],
    et: ['mitu korda nadalas jalgu teha', 'kui tihti ma selga treenn'],
  },
  days_per_week: {
    pl: ['mam czas 2 razy w tygodniu, wystarczy?', 'ile dni w tygodniu trenowac'],
    lt: ['kiek dienu sportuot pradedanciajam', 'kiek dienų savaitėje aš vidutiniškai sportuoju'],
    et: ['mitu paeva nadalas treenida', 'kui mitu treenigut nädalas'],
  },
  how_am_i_doing: {
    pl: ['ocen moj progres', 'powiedz szczerze jak mi idzie'],
    lt: ['kaip man sekas sale', 'ar esu ant teisingo kelio'],
    et: ['anna tagasisidet', 'hinda mu trenni'],
  },
  prs_today: {
    pl: ['wydaje mi się, że dziś pobiłem rekord na ławce, tak?', 'czy dzis byl rekrod'],
    lt: ['ar šiandien kas nors naujo rekordinio', 'ar padariau nauja PR'],
    et: ['tanased pr-id', 'kas ma tegin tana rekordi'],
  },
  plateau: {
    pl: ['plateau co robic', 'od dwóch miesięcy ten sam ciężar na przysiadzie'],
    lt: ['uzstrigau su spaudimu ka daryt', 'neprogresuoju, padėk'],
    et: ['arengut pole enam', 'kuidas platost labi murda'],
  },
  injury_status: {
    pl: ['stan mojego urazu', 'jak moja kontuzja pleców'],
    lt: ['kaip mano nugaros trauma dabar', 'traumos statusas?'],
    et: ['kuidas mu vigastus paraneb', 'mis seis mu olavigastusega'],
  },
  overtraining: {
    pl: ['trenuję 6 razy w tygodniu, nie za dużo?', 'czy jestem przetrenowny'],
    lt: ['ar mano kruvis per didelis', 'ar nepersistengiu salėje'],
    et: ['kas teen liiga palju trenni', 'kas mul on uletrening'],
  },
  train_sore: {
    pl: ['czy moge cwiczyc z zakwasami', 'trenowac na zakwasach?'],
    lt: ['raumenys gelia, ar eiti i sale', 'ar sportuot kai viskas skauda po vakar'],
    et: ['lihased valusad kas trenni teha', 'kas treenda kui lihased valutavad'],
  },
  weaker_today: {
    pl: ['skąd spadek siły dzisiaj', 'czemu nie mam dzis sily'],
    lt: ['siandien kazkoks silpnas', 'kodėl nepavyko pakelti to, ką visada keliu'],
    et: ['tana pole joudu', 'miks kang tana nii raske on'],
  },
  split_choice: {
    pl: ['czy robic split czy full body', 'jaki podzial na 5 dni'],
    lt: ['ar geriau treniruoti visą kūną kiekvieną kartą', 'kaip susidėlioti splitą 3 dienoms'],
    et: ['full body voi split', 'milline splitt teha'],
  },
  exercises_per_session: {
    pl: ['ile ćwiczeń na klatę w jednym treningu', 'ile ćwiczen na jedną sesje'],
    lt: ['kiek pratimu daryti per diena', 'kiek pratimų įtraukti į treniruotę'],
    et: ['mitu harjutust teha', 'kas 8 harjutust on liga palju'],
  },
  compound_isolation: {
    pl: ['czy uginanie bicepsa ma sens przy podciąganiu', 'wielostawowe czy izolowane cwiczenia'],
    lt: ['bazė ar izoliacija masei', 'ar reikia izoliaciniu pratimu'],
    et: ['mis on pohiharjutus', 'kas isoleerivaid harjutusi on vaja'],
  },
  machines_free: {
    pl: ['trening na maszynach ma sens?', 'maszyny czy wolne ciężąry'],
    lt: ['ar laisvi svoriai būtini', 'masinos ar laisvi svoriai'],
    et: ['kas masinad on halvemad', 'trenazoorid voi kang'],
  },
  superset: {
    pl: ['czy robic superserie', 'co daje superseia'],
    lt: ['ar supersetai efektyvūs', 'kas tie supersetai'],
    et: ['kas supersette teha', 'kuidas supersettid toimivad'],
  },
  dropset: {
    pl: ['czy warto robić serie zrzucane', 'co to drop sett'],
    lt: ['kada daryti dropsetus', 'kas yra drop set'],
    et: ['kuidas dropsetti teha', 'kas drop setid on kasulkud'],
  },
  rpe: {
    pl: ['wytlumacz rpe', 'co to jest rir'],
    lt: ['ką reiškia krūvio pojūčio skalė', 'kas yra rpe skale'],
    et: ['mida rir tahendab', 'kuidas rpe hinnata'],
  },
  tempo: {
    pl: ['tempo na hipertrofię', 'jak wolno opuszczac sztange'],
    lt: ['letai ar greitai daryt pakartojimus', 'ar sprogstamai kelti'],
    et: ['kas aeglased kordused on paremad', 'kui kiirelt raskust langetda'],
  },
  warmup_sets: {
    pl: ['ile powtórzeń w seriach rozgrzewkowych', 'ile seri rozgrzewkowych robic'],
    lt: ['apsilimo seriju skaicius', 'kaip laipsniškai didinti svorį apšilimui'],
    et: ['soojendusseeriad pingil kuidas', 'mitu soojendus seeriat teha'],
  },
  stretch_before: {
    pl: ['rozciaganie przed treningiem tak czy nie', 'czy rozcigać się przed siłownią'],
    lt: ['ar tempimas pries sporta reikalingas', 'kada geriau tempti, prieš ar po'],
    et: ['kas enne trenni venitada', 'venitada enne voi parast'],
  },
  mobility: {
    pl: ['sztywne plecy co robic', 'jak poprawić zakres ruchu'],
    lt: ['kaip pagerinti mobiluma', 'pratimai klubų paslankumui'],
    et: ['puusad on kanged mis teha', 'kuidas painduvamaks saad'],
  },
  abs_daily: {
    pl: ['czy trenowac brzuch co dzien', 'jak zrobic sixpack'],
    lt: ['kaip gauti kubikus ant pilvo', 'presas kasdien ar ne'],
    et: ['kuidas six pack saada kiirelt', 'kui tihti kohtu treenida'],
  },
  grip: {
    pl: ['dłonie mi się męczą przy podciąganiu', 'slaby chwyt na martwym ciagu'],
    lt: ['silpnas gniaužtas ką daryti', 'kaip stiprinti suemima'],
    et: ['kuidas haardejoudu parandada', 'haarre väsib ära'],
  },
  belt_straps: {
    pl: ['usztywniacze na nadgarstki potrzebne?', 'pas czy bez pasa'],
    lt: ['ar reikia riesines', 'ar naudot dirzelius traukai'],
    et: ['kas rihmad on petmine', 'millal vööd kanda kykis'],
  },
  breathing: {
    pl: ['czy wstrzymywać oddech', 'jak oddyhać przy ciężarach'],
    lt: ['įkvėpti prieš nuleidžiant ar po?', 'kaip kvėpuoti sportuojant su štanga'],
    et: ['hingamine kykis', 'millal pingil hingta'],
  },
  squat_form: {
    pl: ['głębokość przysiadu', 'czy musze robic pelny przysiad'],
    lt: ['kaip plačiai statyti kojas pritūpiant', 'ar tupti iki galo'],
    et: ['polved vajuvad sisse kukis', 'kas polved voivad varvastest ette minna'],
  },
  results_time: {
    pl: ['po ilu miesiącach widać różnicę', 'kiedy bedom efekty'],
    lt: ['kiek menesiu reikia kad matytusi', 'kada pagaliau matysiu progresą veidrodyje'],
    et: ['kaua laheb kuni tulemusi naen', 'kui kiirelt tugevamaks saan'],
  },
  muscle_gain_rate: {
    pl: ['jak szybko rosną mięśnie', 'jak budowac mase miesniowa'],
    lt: ['kaip priaugt masės greitai', 'ką daryti kad augtų raumenys'],
    et: ['kuidas massi juurde saada', 'kui palju lihast kuus kasvab'],
  },
  fat_loss: {
    pl: ['jak chudnąć i nie tracić mięśni', 'jak zrzucic tluszcz'],
    lt: ['kaip sumažinti riebalų procentą', 'kaip sulieknet greitai'],
    et: ['kuidas kaalu langetada', 'kuidas kohurasvast lahti saada'],
  },
  myth_bulky: {
    pl: ['ciężary a kobieca sylwetka', 'czy od silowni zrobie sie klocem'],
    lt: ['ar svarmenys padarys mane masyvią', 'ar moterims tinka sunkūs svoriai'],
    et: ['kas naised peaks raskelt tostma', 'kas lahen liiga lihaseliseks'],
  },
  cardio_gains: {
    pl: ['czy kardio niszczy miesnie', 'czy cardio zabija mase'],
    lt: ['ar kardio atima raumenų masę', 'ar kardio kenkia mases rinkimui'],
    et: ['kas jooksmine votab lihased', 'kas kardio poletab lihast'],
  },
  sick: {
    pl: ['trening z katarem ok?', 'jestem chory czy moge cwiczyc'],
    lt: ['kiek palaukti po ligos iki treniruotės', 'susirgau, ar praleist treniruote'],
    et: ['kas voin kulmetusega treenida', 'kas haigena võib trenni tehaa'],
  },
  alcohol: {
    pl: ['czy wino psuje regenerację', 'wypilem wczoraj, trenowac dzis?'],
    lt: ['ar alkoholis gadina treniruociu rezultatus', 'isgeriau vakar, ar treniruotis'],
    et: ['kas alkohol on halb lihastele', 'kas parast joomist voib treenida'],
  },
  water: {
    pl: ['czy pić wodę w trakcie treningu', 'ile wody pic na masie'],
    lt: ['kiek skysčių reikia sportininkui', 'ar per mazai geriu vandens'],
    et: ['kas joon piisavalt vett', 'mitu liitrit vett trennipäeval'],
  },
  sleep_better: {
    pl: ['źle śpię, jak to naprawić', 'jak poprawic jakosc snu'],
    lt: ['ka daryt kad geriau miegociau', 'miegas prastas, patarimai?'],
    et: ['ei saa magama jaada', 'nouanded parema une jaoks'],
  },
  time_of_day: {
    pl: ['kiedy najlepiej chodzic na silke', 'rano czy po pracy trenowac'],
    lt: ['ryto treniruotė ar po darbo', 'kada dienos metu sportuot geriausia'],
    et: ['mis kellaajal treenida', 'kas hommikul olen norgem'],
  },
  fasted: {
    pl: ['czy moge nie jesc przed silownia', 'na czczo na silke?'],
    lt: ['nevalgius kardio ar ne', 'ar treniruotis tusciu pilvu'],
    et: ['kas enne hommikusooki voib trenni teha', 'tuhja kohu kardio'],
  },
  caffeine: {
    pl: ['kiedy wypić kawę przed treningiem', 'czy kawa pomaga cwiczyc'],
    lt: ['kofeinas prieš sportą ar ne', 'puodelis kavos prieš treniruotę padės?'],
    et: ['kas kofein aitab', 'kas energiajook enne trenni on okei'],
  },
  protein_timing: {
    pl: ['kiedy najlepiej jesc bialko', 'bialko po treningu od razu?'],
    lt: ['ar reikia protko iskart po treniruotes', 'kokiu metu gerti baltymu kokteili'],
    et: ['valk enne voi parast trenni', 'kas anaboolne aken on päris'],
  },
  travel: {
    pl: ['w podróży służbowej jak ćwiczyć', 'wakacje a silownia'],
    lt: ['kelionėje sportuoti ar ilsėtis', 'važiuoju dviem savaitėm, kaip neprarasti formos'],
    et: ['puhkusel trenn', 'trenn hotelli toas'],
  },
  home: {
    pl: ['domowy trening zamiast silowni', 'jak trenowac bez silowni'],
    lt: ['neturiu abonemento, kaip sportuoti namuose', 'namu treniruote'],
    et: ['kas kodus saab lihaseid kasvatada', 'kodune treening ilma vahenditeta'],
  },
  comeback: {
    pl: ['ile zmniejszyć ciężar po przerwie', 'wracam na silke po roku'],
    lt: ['kiek sumažinti svorius po pertraukos', 'po pertraukos visai silpnas, kaip grįžti'],
    et: ['kust alustada peale pausi', 'kuidas parast pikka pausi alustada'],
  },
  rest_day: {
    pl: ['czy w dzien wolny nic nie robic', 'co robię w dni bez treningu'],
    lt: ['ar galima plaukti poilsio dieną', 'aktyvus poilsis ka daryti'],
    et: ['kas puhkepaeval voib jalutada', 'puhkepäeval mida tegda'],
  },
  beginner: {
    pl: ['pierwsze kroki na siłce', 'jestem poczatkujacy co robic'],
    lt: ['pirmas mėnuo salėje, ką daryti', 'kaip pradeti treniruotis nuo nulio'],
    et: ['kust alustada joususaalis', 'algajale mis teha'],
  },
  shoes: {
    pl: ['czy warto kupić buty do przysiadów', 'jakie obuwie na trening'],
    lt: ['kokia avalynė geriausia sporto salei', 'ar kilnot su sportbačiais'],
    et: ['kas joutõmme paljajalu', 'kas tostekingi on vaja'],
  },
  app_log_set: {
    pl: ['gdzie jest przycisk dodania serii', 'jak zapisac seriee'],
    lt: ['kaip programoj uzrasyti priejima', 'kaip loginti setus'],
    et: ['kuhu kordused kirja panna', 'kuidas seeraid salvestada'],
  },
  app_rest_timer: {
    pl: ['jak zmienic czas odpoczynku w timerze', 'jak ustawic minutnik'],
    lt: ['kaip ijungti garsa laikmaciui', 'poilsio taimeris neveikia'],
    et: ['puhketaimer seaded kus', 'kuidas taimeri aega muta'],
  },
  app_notifications: {
    pl: ['jak wylaczyc powiadomienia', 'przypomnienia w apce jak wlaczyc'],
    lt: ['kaip nustatyti priminimus programėlėje', 'kodėl negaunu notifikaciju'],
    et: ['teavitused ei toota', 'ei saa teavitusi appist'],
  },
  app_turn_off: {
    pl: ['jak cie wylaczyc', 'gdzie się wyłącza Atlasa'],
    lt: ['nereikia man trenerio, kaip išjungti', 'kaip tave deaktyvuoti'],
    et: ['atlas ara', 'kuidas treener valja lülitda'],
  },
  app_role: {
    pl: ['trener mi rozpisuje plan, jak mi pomożesz', 'jestes dodatkowym trenerem?'],
    lt: ['turiu asmenini treneri, ar tu reikalingas', 'koks tavo vaidmuo jei turiu trenerį'],
    et: ['mul on inimtreener', 'kas sa oled lisatreener'],
  },
  app_injury_log: {
    pl: ['jak zapisać że coś mnie boli w aplikacji', 'gdzie dodaje sie kontuzje'],
    lt: ['kaip pranešti apie traumą kad pritaikytų programą', 'kaip ivesti trauma'],
    et: ['kuhu vigastus kirja panna', 'kuidas vigastust logda'],
  },
  are_you_ai: {
    pl: ['czy jesteś czatbotem', 'jestes prawdziwy?'],
    lt: ['ar tu dirbtinis intelektas ar zmogus', 'ar su manim rašo žmogus'],
    et: ['kas sa oled pariselt inimene', 'oled sa tehisintelekt'],
  },
  who_made: {
    pl: ['jaka firma cię zrobiła', 'kto cie zaprogramowal'],
    lt: ['kas tave suprogramavo', 'kas stovi už atlas'],
    et: ['kes atlase tegi', 'kes sind lõi'],
  },
  motivate: {
    pl: ['daj motywacje', 'zmotywój mnie'],
    lt: ['motivuok mane', 'padėk susiimti ir eiti treniruotis'],
    et: ['vaja motivatsiooni kohe', 'utle midagi motiveerivat'],
  },
  joke: {
    pl: ['opowiedz cos zabawnego', 'dawaj żart'],
    lt: ['sugalvok juokelį apie kilnojimą', 'pajuokink'],
    et: ['utle midagi naljakat', 'raagi moni nali'],
  },
  insult: {
    pl: ['idiota', 'pierdol sie'],
    lt: ['koks tu debilas', 'eik šikt'],
    et: ['jaa vait', 'sa oled mottetu'],
  },
  done: {
    pl: ['odhaczone', 'zrobilem'],
    lt: ['baigta', 'treniruote baigta'],
    et: ['trenn tehtd', 'lopetasin trenni'],
  },
  bye: { pl: ['pa pa', 'lece, nara'], lt: ['bye', 'iki vel'], et: ['naeme hiljem', 'headaega'] },
  how_are_you: {
    pl: ['co slychac', 'jak sie trzymasz'],
    lt: ['kaip einasi', 'kaip laikais atlai'],
    et: ['kuidas kasi kaib', 'kuidas sul lahheb'],
  },
  heaviest: {
    pl: ['ile maksymalnie podniosłem', 'najcięższe co dzwignalem'],
    lt: ['kiek sunkiausiai esu pakeles', 'parodyk sunkiausią mano kėlimą'],
    et: ['minu raskeim toste', 'mu suurim tõstetd kaal'],
  },
  favourite_lift: {
    pl: ['najczestsze cwiczenie u mnie', 'jakie cwiczenie lubie najbardziej wg logow'],
    lt: ['ką aš labiausiai mėgstu daryti pagal įrašus', 'koks mano top pratimas'],
    et: ['mida ma koige rohkem teen', 'mu koige sagedasem harjutus'],
  },
  consistency: {
    pl: ['czy regularnie chodzę na siłownię', 'jak u mnie z systematycznoscia'],
    lt: ['ar pastoviai sportuoju', 'kaip sekasi su nuoseklumu'],
    et: ['kas treenin regulaarselt', 'kui jarjepidev ma olen'],
  },
  best_weekday: {
    pl: ['w jakie dni tygodnia trenuje najwiecej', 'najczestszy dzien treningu'],
    lt: ['kuri diena man sekasi geriausiai', 'mano treniruociu dienos'],
    et: ['mis paevadel ma saalis kain', 'mu tavalsed trennipäevad'],
  },
  rest_actual: {
    pl: ['czy moje przerwy są za krótkie', 'srednia przerwa u mnie'],
    lt: ['kiek poilsio darau tarp setų pagal įrašus', 'kiek as ilsiuosi tarp seriju'],
    et: ['mu keskmine puhkeaeg', 'kui pikk mu paus tegelkult on'],
  },
  warmup_habit: {
    pl: ['czy moja rozgrzewka jest wystarczająca', 'rozgrzewam sie wystarczajaco?'],
    lt: ['ar mano įrašuose yra apšilimo serijos', 'ar as apsilu tinkamai'],
    et: ['kas ma jatan soojenduse vahele', 'kas ma alati soojendn'],
  },
  cardio_done: {
    pl: ['moje aktywnosci w tym tygodniu', 'ile kardio zrobilem'],
    lt: ['kiek laiko skyriau kardio', 'kiek kardio sia savaite'],
    et: ['mu kardio sel nadalal', 'mitu minutit kardiot tegin'],
  },
  my_gym: {
    pl: ['którą siłownię odwiedzam najczęściej', 'gdzie cwicze'],
    lt: ['kur treniruojuosi dažniausiai', 'kuri sale mano pagrindine'],
    et: ['minu jousaal', 'kus ma koige rohkem treenin'],
  },
  my_goal: {
    pl: ['mój obecny cel', 'co jest moim celem'],
    lt: ['parodyk mano tikslą', 'koks mano tikslas programoje'],
    et: ['mu eesmark', 'kas mul on eesmärk seatd'],
  },
  bw_trend: {
    pl: ['ile schudlem w tym miesiacu', 'czy waga mi rośnie'],
    lt: ['kiek priaugau per menesi', 'svorio dinamika'],
    et: ['mu kaalu trend', 'kas ma kaotan kaalu voi mitte'],
  },
  strength_ratio: {
    pl: ['czy mój wynik na ławce to dobry poziom', 'czy jestem silny'],
    lt: ['ar esu stiprus savo svorio kategorijoj', 'kaip vertinti mano jega pagal svori'],
    et: ['kas mu kukk on tugev', 'kas olen oma kaalu kohta tugv'],
  },
  month: {
    pl: ['podsumuj mi ten miesiąc', 'ile trenignow w tym miesiacu'],
    lt: ['ką nuveikiau per mėnesį', 'menesio rezultatai'],
    et: ['kuu kokkuvote', 'kuidas mul sel kuul laks'],
  },
  longest_session: {
    pl: ['najdłuższy czas na siłowni u mnie', 'ile trwal najdluzszy trening'],
    lt: ['kuri buvo trumpiausia treniruote', 'ilgiausias mano sportas salėje'],
    et: ['pikim sessioon', 'mu koige pikem treening'],
  },
  grow_muscle: {
    pl: ['jak dorobić się dużej klaty', 'jak powiększyć uda'],
    lt: ['kaip padidint pecius', 'kokie pratimai krūtinės augimui'],
    et: ['saared ei kasva', 'kuidas suuremaid olgu saada'],
  },
  arms: {
    pl: ['trening na duże ręce', 'jak rozbudowac rece'],
    lt: ['rankos neauga nors darau bicepsa', 'kaip padidint rankų apimtį'],
    et: ['mu kaed ei kasva', 'kuidas suuremad kaed saada'],
  },
  add_weight: {
    pl: ['ile dodawać w martwym', 'kiedy zwiekszac obciazenie'],
    lt: ['ar pridėti 2,5 ar 5 kg', 'kada pridet svorio'],
    et: ['kui palju kaalu lisada', 'millal raskust tosta'],
  },
  strength_vs_size: {
    pl: ['czy siła i masa idą w parze', 'trening na sile czy na mase'],
    lt: ['hipertrofija ar jėga pradedančiajam', 'ar galima tuo pačiu siekti jėgos ir masės'],
    et: ['kas treenida jou jaoks voi massiks', 'joud vs hupertroofia'],
  },
  periodization: {
    pl: ['wytlumacz periodyzacje', 'czy periodyzacja ma sens dla amatora'],
    lt: ['ka reiskia periodizacija', 'kaip susiplanuot treniruočių ciklus'],
    et: ['mis on mesotsukkel', 'kas perioodiseerida trenni'],
  },
  unilateral: {
    pl: ['czy robic cwiczenia na jedna noge', 'lewa reka slabsza co robic'],
    lt: ['ar vienpusiai pratimai naudingi', 'kaip sutvarkyt asimetrija'],
    et: ['kas uhepoolsed harjutused on kasulikud', 'vasak pool on norgem'],
  },
  pullup_zero: {
    pl: ['podciąganie z gumą ok na start?', 'jak sie nauczyc podciagania'],
    lt: ['neprisitraukiu, ka daryti', 'kaip sustiprėti prisitraukimams'],
    et: ['kuidas esimene louatomme teha', 'null louatombeid'],
  },
  squat_vs_press: {
    pl: ['suwnica czy przysiady na masę', 'przysiad czy suwnica na nogi'],
    lt: ['nemėgstu pritūpimų, ar kojų spaudimo užteks', 'presas kojom ar pritūpimai su štanga'],
    et: ['kas jalapress on sama hea', 'kas saan kykki jalapressiga asendada'],
  },
  incline_flat: {
    pl: ['górna klatka mi odstaje, co robić', 'czy skos wystarczy zamiast plaskiej'],
    lt: ['ar reikia abiejų: tiesaus ir nuožulnaus', 'kas geriau krutinei kampu ar tiesiai'],
    et: ['kuidas ulemist rinda kasvatada', 'incline vs flat pink'],
  },
  foam_roll: {
    pl: ['pistolet do masażu pomaga?', 'rolowanie przed treningiem ok'],
    lt: ['ar masažas padeda raumenims', 'ar volelis naudingas'],
    et: ['rull enne voi parast trenni', 'kas massaaz on hea taastumiseks'],
  },
  sauna_cold: {
    pl: ['sauna po treningu ok?', 'czy chodzic do sauny po silowni'],
    lt: ['pirtis ar saltas vanduo atsigavimui', 'ar verta i pirti po sales'],
    et: ['jaavann parast trenni', 'kas kulm dush aitab'],
  },
  nap: {
    pl: ['drzemka 20 minut czy godzina', 'czy moge sie zdrzemnac przed trenignem'],
    lt: ['ar dienos miegas padeda raumenims', 'ar verta pasnaust diena'],
    et: ['kui pikk uinak', 'kas lounauinak on hea'],
  },
  stress: {
    pl: ['czy silownia pomaga na stres', 'mam dużo stresu, co z treningiem'],
    lt: ['labai pavargęs psichologiškai, ar sportuoti', 'ar sportuoti kai daug streso'],
    et: ['stress ja trenn', 'kas tostmine aitab stressi vastu'],
  },
  bench_alone: {
    pl: ['przysiady sam w klatce ok?', 'co zrobic jak utkne na lawce sam'],
    lt: ['ar spausti vienas su stanga', 'kaip nusimesti štangą jei nepakeli'],
    et: ['kas uksi on ohutu suruda', 'ilma julgestajata pingil'],
  },
  age: {
    pl: ['czy w wieku 55 lat zbuduję mięśnie', 'jestem za stary na cwiczenia?'],
    lt: ['pradėti salę sulaukus 50 ar verta', 'ar amžius trukdo sportuoti'],
    et: ['joutrenn parast 50', 'kas 45selt on liga hilja'],
  },
  gym_anxiety: {
    pl: ['wstydze sie na silowni', 'czuje sie obco na silowni'],
    lt: ['jauciuosi kvailai sporto saleje', 'kaip įveikti baimę salėje'],
    et: ['jousaali arevus', 'tunnen end saalis piinlkult'],
  },
  app_backfill: {
    pl: ['jak dodac trening z zeszlego tygodnia', 'zapomnialem wpisac treningu'],
    lt: ['ar galima įrašyti treniruotę vėliau', 'kaip pridet sena treniruote'],
    et: ['kuidas eilset trenni lisada', 'kuidas moodunud trenni lisada'],
  },
  app_units: {
    pl: ['gdzie zmienić jednostki', 'jak zmienic jednostki'],
    lt: ['kur vienetų nustatymai', 'noriu kilogramu vietoj svaru'],
    et: ['muuda kilod naelteks', 'kus uhikute seaded on'],
  },
  app_language: {
    pl: ['przelacz jezyk', 'chce apke po polsku'],
    lt: ['kaip ijungti lietuviu kalba', 'kaip pakeisti programos kalbą į kitą'],
    et: ['muuda api keelt', 'kus keele seaded'],
  },
  app_delete: {
    pl: ['jak usunac cały trening', 'dodałem przez pomyłkę serię, jak skasować'],
    lt: ['kaip atšaukti paskutinį setą', 'kaip istrint seta'],
    et: ['kustuta trenn', 'kuidas seeria ara kustutada'],
  },
  app_playbook: {
    pl: ['jak używać Playbooka', 'jak dziala playbook'],
    lt: ['kaip paleisti treniruotę iš šablono', 'kas yra sablonai'],
    et: ['kuidas malle kasutada', 'kuidas rutiini salvesta'],
  },
  app_streak_rules: {
    pl: ['jak dzała seria treningów', 'Na czym polega ta seria dni w aplikacji?'],
    lt: ['kaip vekia serija aplikacijoje', 'nuo ko priklauso mano serijos ilgis?'],
    et: ['kas seeria kaob kui ma nadalavahetusel ei treeni', 'kuidas streak toomib'],
  },
  app_sleep_tracking: {
    pl: ['jak dziala sledzenie snu', 'Czy można w tej aplikacji rejestrować sen automatycznie?'],
    lt: ['kaip veika miego sekimas', 'ar aplikacija mato mano miegą iš telefono?'],
    et: ['kas äpp loeb mu und telefonist', 'kuidas une trakkimine käib'],
  },
  do_you_lift: {
    pl: ['ty w ogóle ćwiczysz czy tylko gadasz?', 'trenjesz coś?'],
    lt: ['kiek tu spaudai gulint?', 'ar tu kada nors buvai salėj?'],
    et: ['kas sa trennis kaid', 'kas sa ise olwd kunagi tõstnud'],
  },
  compliment: {
    pl: ['jestes zajebisty', 'mega pomocny jesteś'],
    lt: ['tu jega', 'šaunus esi, Atlas'],
    et: ['tanan, oled parim', 'sa oled vapustaw'],
  },
  sorry: {
    pl: ['wybacz, zawaliłem', 'przykro mi, że nie ćwiczyłem'],
    lt: ['mano klaida, sorry', 'nepyk'],
    et: ['vabandust et segasin', 'vabandsut'],
  },
  plate_math: {
    pl: ['jak zrobić 102,5 kg na gryfie', 'talerze na stronę na 70'],
    lt: ['kokius dikus uzdet 70kg', 'štanga 100 kg, kokie diskai kiekvienoje pusėje?'],
    et: ['ketaste arvutus 150 kg', 'mis kettad panna 70kg jaoks kummalegi poolw'],
  },
  reps_at_weight: {
    pl: ['przysiad 130 kg ile powtórzeń', 'Na 100 kg w wyciskaniu ile bym zrobił?'],
    lt: [
      'noriu uždėti 110 kg ant traukos, kiek kartų pavyks?',
      'kiek pakartojimų su 50 kg virš galvos?',
    ],
    et: ['mitu kordust saan 100kg kukis', 'mitu kordut 80 kg pingil'],
  },
  percent_max: {
    pl: ['ile to 75% mojego martwego ciagu', 'podaj 80% z mojego rekordu na ławce'],
    lt: ['kiek sveria 80% mano spaudimo', 'koks mano 75% traukos svoris?'],
    et: ['mis on 80% minu joutõmbest', 'paljuon 75% mu kukist'],
  },
  warmup_lift: {
    pl: ['rozgrzewka na klate przed benchem', 'jak rozgzać się do przysiadu'],
    lt: ['kaip pasiruošti prieš mirties trauką?', 'apsilimo serijos prie spaudima'],
    et: ['kuidas soojendada enne joutõmmet', 'soojenduse seeriad pingile palun'],
  },
  exercise_muscles: {
    pl: ['jakie mięśnie robi face pull', 'na co jest dipsy'],
    lt: [
      'kokius raumenys treniruoja trauka prie smakro?',
      'ar spaudimas gulint treniruoja tricepsą?',
    ],
    et: ['mida pingilsurumine treenib', 'mis lihaseid lõuatõmme treenib'],
  },
  alternatives: {
    pl: ['alternatwa dla podciągania', 'jakie ćwiczenie zamiast wykroków?'],
    lt: ['vietoj traukos ką galima daryti?', 'alternatyvus pratimas spaudimui virš galvos'],
    et: ['mida teha pingi asmel', 'alternatiiv joutõmbele'],
  },
  sets_for_lift: {
    pl: ['ile serii przysiadu tygodniowo', 'ile serii robic na podciaganiu'],
    lt: ['trauka kiek serijų geriausia?', 'kiek serijų pritūpimų per savaitę?'],
    et: ['mitu seeriat kukki', 'mitu seeriat joutõmmet teha'],
  },
  day_lookup: {
    pl: ['co ćwiczyłem wczoraj?', 'jaki był mój ostatni poniedziałkowy trening'],
    lt: ['ką aš dariau praėjusį pirmadienį?', 'kokius pratimus dariau vakar?'],
    et: ['mida ma esmaspaeval tegin', 'mis mul eila treeningus oli'],
  },
  compare_weeks: {
    pl: ['ten tydzien a poprzedni', 'porównaj moje dwa ostatnie tygodnie'],
    lt: [
      'ar šios savaitės apimtis didesnė nei praeitos?',
      'ši savaitė lyginant su praeita savaite',
    ],
    et: ['vordle seda nadalat eelmisega', 'see nädal vs eelmine nädl'],
  },
  short_on_time: {
    pl: ['brak czasu dzisiaj jaki trening', 'mam 30 minut co robic'],
    lt: ['neturiu laiko, trumpas variantas?', 'skubu i darba, 25 min turiu'],
    et: ['mul on ainult 30 min', 'pole aega, kiire treenig'],
  },
  two_days_row: {
    pl: ['dwa dni z rzedu na silce', 'moge cwiczyc codziennie?'],
    lt: [
      'treniruotes dienas is eiles ar ok',
      'ar galima eiti į sporto salę kelias dienas iš eilės?',
    ],
    et: ['kas voin kaks paeva jarjest treenida', 'kas jarjest trennid on ok'],
  },
  two_a_day: {
    pl: ['trening rano i po pracy tego samego dnia', 'dwa treningi dziennie czy to przesada'],
    lt: ['dvi sesijos per dieną', 'ar gera treniruotis 2 kartus per dieną?'],
    et: ['kas kaks korda päevas trenn on ok', 'kaks trenni paevas kas tasub'],
  },
  health_conditions: {
    pl: ['mam epilepsje czy moge dzwigac', 'trening z przewlekłą chorobą'],
    lt: ['ar galiu kilnot su epilepsija', 'turiu lėtinę ligą, ar galiu treniruotis?'],
    et: ['kas korge vererohuga voib treenida', 'mul on diabeet kas voin tostab'],
  },
  peds: {
    pl: ['sarmy działają?', 'Brać coś na wspomaganie czy lepiej nie?'],
    lt: ['ar steroidai kenksmingi?', 'anabolikai ar verta'],
    et: ['kas steroidid on halvad', 'mis sa steroidest arvad'],
  },
  cycle: {
    pl: ['trening przy okresie ok?', 'jak dopasować treningi do cyklu'],
    lt: ['ar ciklas turi itakos jegai?', 'sportas per mėnesines'],
    et: ['kas paevade ajal voib treenida', 'menstruatsioon ja tostmine'],
  },
  pregnancy: {
    pl: ['ciąża a martwy ciąg', 'trening w ciazy bezpieczny?'],
    lt: ['nestumas ir sporto sale', 'kaip treniruotis per nėštumą?'],
    et: ['kas rasedana voib tosta', 'olen rase kas voin trennis kaia'],
  },
  hr_zones: {
    pl: ['strefa 2 jakie tetno', 'o co chodzi ze strefami tętna?'],
    lt: ['kas yra zone 2 kardio', 'kokioje pulso zonoje treniruotis?'],
    et: ['pulsitsoonid kuidas toimivad', 'mis on tsoon kaks'],
  },
  hiit: {
    pl: ['hit czy spacer na spalanie', 'przykładowy trening interwałowy'],
    lt: ['noriu numesti riebalų, ar daryti HIIT?', 'ar hit treniruotes efektyvios'],
    et: ['kas hiit on hea', 'hiit trenn kuidas teja'],
  },
  running: {
    pl: ['łączenie biegania z ciężarami', 'bieganie po siłce czy przed w inne dni'],
    lt: ['ar galiu bėgti tą pačią dieną kaip kojų treniruotė?', 'begimas ir sale kartu'],
    et: ['kas voin joosta ja tosta', 'jooksmine ja joutrenn koos'],
  },
  steps: {
    pl: ['ile chodzic dziennie', 'kroki a odchudzanie'],
    lt: ['ar 5000 žingsnių pakanka?', 'kiek zingsnių per dena optimalu?'],
    et: ['mitu sammu paevas', 'kas kondimine aitab kaalu langetada'],
  },
  posture: {
    pl: ['cwiczenia na garba', 'korekcja postawy na siłowni'],
    lt: ['pratimai nugarai kad butu tiesi laikysena', 'kaip pagerinti laikysna'],
    et: ['kuidas ruhti parandada', 'umarad olad harjutused'],
  },
  other_sport: {
    pl: ['silownia dla kolarza', 'trenuję boks, jakie ćwiczenia siłowe robić'],
    lt: [
      'treniruotes sporto saleje dviratininkui',
      'žaidžiu futbolą, ar man reikia kojų treniruočių?',
    ],
    et: ['kuidas tosta jalgpalli jaoks', 'jõutrenn poksijale'],
  },
  home_equipment: {
    pl: ['minimalny sprzęt do treningu w domu', 'co warto mieć w domowej siłce'],
    lt: ['kokio inventoriaus reikia sportuot namuose?', 'štanga ar hanteliai namams?'],
    et: ['mida osta koju trenniks', 'kodujousaali varustus'],
  },
  what_can_i_ask: {
    pl: ['w czym pomagasz?', 'jakie masz funkcje'],
    lt: ['apie ką galim pakalbėti?', 'ko gali paklaust'],
    et: ['mida ma saan kusida', 'mida sa oskad tehs'],
  },
  reminder: {
    pl: ['przypominajka o treningu', 'daj znać jutro żebym poszedł na silownie'],
    lt: ['primink penktadienį kojų dieną', 'priminima sporto salei pridek'],
    et: ['tuleta mulle meelde treenide', 'pane meeldetulets trenni jaoks'],
  },
  memory_show: {
    pl: ['wiesz coś o mnie?', 'co pamietasz na moj temat'],
    lt: ['kas įrašyta tavo atmintyje apie mane?', 'ka tu zinai apie mani'],
    et: ['mida tead minust', 'mis sa minust mailetad'],
  },
  memory_forget: {
    pl: ['skasuj co zapamietales', 'wymaż wszystko'],
    lt: ['istrink atminti', 'pamirk ką žinai apie mane'],
    et: ['unusta koik minust', 'unust ara'],
  },
  act_rest: {
    pl: ['przerwa na klate 3 min', 'skróć przerwę w podciąganiu do 60 s'],
    lt: ['poilsi spaudimui nustatyk 2 min', 'pakeisk poilsio laiką spaudimui gulint į 150 sek'],
    et: ['maara pingi puhkus 3 minutiks', 'pane kuki puhkeaeg 2 minutit'],
  },
  act_swap: {
    pl: ['zamień przysiad ze sztangą na goblet', 'zmien martwy ciag na hip thrust'],
    lt: ['pakeisk trauka i rumuniska', 'keisk spaudimą virš galvos į hantelių spaudimą sėdint'],
    et: ['vaheta pink hantli surumisega', 'asenda kukk jalapressiga'],
  },
  act_avoid: {
    pl: ['wyklucz ławkę z planu', 'nie dawaj mi wiecej wykrokow'],
    lt: ['pasalink iskritimus', 'prašau, išimk atsispaudimus ant lygiagrečių iš plano'],
    et: ['eemalda valjaasted kavast', 'vota pink mu programmist valja'],
  },
  act_move: {
    pl: ['przesuń trening o jeden dzień', 'przenieś pull na wtorek'],
    lt: ['perkelk trečiadienio treniruotę į ketvirtadienį', 'perkel šiandienos treniruotę į poryt'],
    et: ['liiguta jalapaev neljapaevale', 'nihuta tanane trenn homseks'],
  },
  act_start: {
    pl: ['startuj trening', 'rozpocznij sesje'],
    lt: ['startas treniruotei', 'pradek šiandien treniruote'],
    et: ['alusta tanast trenni', 'alusta treenignut'],
  },
  act_temper: {
    pl: ['zmień ton na milszy', 'badz bardziej wymagajacy'],
    lt: ['per griežtai kalbi, sumažink tempą', 'būk draugiškesnis'],
    et: ['ole lahkem palun', 'ara ole nii karm'],
  },
  act_mute: {
    pl: ['wycisz się na dzisiaj', 'zero powiadomień dziś'],
    lt: ['nutidyk pranešimus šiandien', 'sustabdyk pranešimus šiandienai'],
    et: ['vaigista teavitused tana', 'lulita teavitused valja'],
  },
  act_bodyweight: {
    pl: ['mam teraz 88 kilo', 'waga dzis 81.2'],
    lt: ['sveriu 67 kg dabar', 'irasyk svori 80 kg'],
    et: ['ma kaalun 82 kilo', 'mu kaal on tana 79 kg'],
  },
  range_count: {
    pl: ['ile moich sesji w ostatnich 8 tygodniach', 'ile trenigów zrobiłem w tym roku'],
    lt: ['kiek treniruočių turėjau per paskutines 6 savaites?', 'kiek treniruočiu šį mėnesi?'],
    et: ['mitu trenni ma eelmisel kuul tegin', 'mitu korda ma sel kuul treenisn'],
  },
  range_summary: {
    pl: [
      'streszczenie moich treningow z ostatnich 6 tygodni',
      'podsumowanie mojego roku treningowego',
    ],
    lt: ['ka dariau per paskutinius 3 menesius', 'praeto mėnesio treniruočių apžvalga'],
    et: ['eelmise kuu kokkuvote', 'mida ma eelmisel kuul teginn'],
  },
  range_lift: {
    pl: ['jak się zmieniał mój przysiad w tym roku', 'moj bench ostatnie 2 miesiace'],
    lt: [
      'geriausias mano spaudimas per pastaruosius 2 mėnesius',
      'kaip patobulėjo mano trauka per 3 mėn?',
    ],
    et: ['minu kuki areng alates juunist', 'kuidas mu pink on arenend'],
  },
  range_muscle: {
    pl: ['objętość na ramiona w ostatnim kwartale', 'ile seri na tricek w tym tygodniu'],
    lt: ['kiek seriju kojom sia savaite', 'mano sėdmenų apimtis praeitą mėnesį'],
    et: ['minu rinna maht viimased 2 kuud', 'mitu seeriat jalgadele sel nadalal'],
  },
  range_bw: {
    pl: ['jak sie zmieniala moja waga', 'ile przybrałem od początku masy'],
    lt: ['svoris per paskutinius 2 menesius', 'kiek pasikeitė mano kūno svoris nuo sausio?'],
    et: ['mu kaal viimase poole aasta jooksul', 'kuidas mu kaal muutus viimase kuuga'],
  },
  then_vs_now: {
    pl: ['porównaj moją formę z tą sprzed roku', 'jestem mocniejszy niż miesiąc temu?'],
    lt: ['ar mano jėga išaugo per paskutinius mėnesius?', 'aš dabar vs aš prieš pusmetį'],
    et: ['kas ma olen tugevam kui 3 kuud tagasi', 'kas olen nork kui aasta tagasi'],
  },
  compare_lifts: {
    pl: ['porownanie moich bojow', 'proporcje moich wyników w trójboju'],
    lt: ['palygink trauka ir pritupima', 'kas stipresnis mano spaudimas ar pritupimas?'],
    et: ['vordle mu pinki ja kukki', 'kukk vs pink'],
  },
  why_today: {
    pl: ['dlaczego dzis nogi a nie klata', 'czemu mam dziś taki plan?'],
    lt: ['kodėl šiandien lengva treniruotė?', 'kodėl šiandien pečių diena?'],
    et: ['miks tana see trenn', 'miks ma tana jalgu teen'],
  },
  why_weight: {
    pl: ['skąd taka waga na wiosłowaniu', 'czemu podniosles mi ciezar'],
    lt: ['kodėl šiandien tokie sunkūs pritūpimai?', 'kodėl nekeli svorio spaudime?'],
    et: ['miks pink tana kergem', 'miks kukki kaal tousis'],
  },
  why_plan: {
    pl: ['skad taki rozklad treningow', 'po co mi ten program'],
    lt: ['kodėl mano plane tiek mažai kardio?', 'kokia logika mano programos?'],
    et: ['miks see kava', 'miks mu programm selline on'],
  },
  why_lift: {
    pl: ['czemu mam martwy rumunski', 'po co mi facepull w planie'],
    lt: ['kodėl mano programoje tiek daug spaudimo?', 'kodėl turiu daryti kojų presą?'],
    et: ['miks kukk mu kavas on', 'miks joutõmme mu plaanis'],
  },
  technique_lift: {
    pl: ['technika martwego krok po kroku', 'jak prawidłowo robić wykroki'],
    lt: ['kaip taisyklingai daryti iškritimus?', 'kaip taisiklingai spausti'],
    et: ['kuidas oigesti kukitada', 'joutõmbe tehnikaa'],
  },
  pain_types: {
    pl: ['tepy bol czy ostry co gorsze', 'rwący ból podczas serii co to znaczy'],
    lt: ['kada skausmas reiškia kad reikia sustoti?', 'astrus skausmas ar bukas koks skirtumas'],
    et: ['terav voi tuim valu', 'kas poletav tunne lihases on okei'],
  },
  return_injury: {
    pl: ['wracam po kontuzji, od czego zaczac', 'trening po urazie nadgarstka'],
    lt: ['grizimas i sporta po traumos', 'kaip saugiai grįžti į treniruotes po sužeidimo?'],
    et: ['millal voin parast vigastust treenida', 'kuidas vigastusejärgselt tagasi tulle'],
  },
  ice_heat: {
    pl: ['lod na nadgarstek czy nie', 'kiedy lód a kiedy ciepło'],
    lt: ['ar šilta vonia padeda skaudantiems raumenims?', 'ar ledas padeda po treniruotes?'],
    et: ['kas panna jääd või sooja', 'kulm voi soe'],
  },
  painkillers: {
    pl: ['przeciwbólowe przed siłownią', 'tabletka przeciwbólowa i trening?'],
    lt: ['ar galiu gert paracetamoli ir sportuot', 'treniruotis išgėrus vaistų nuo skausmo – ok?'],
    et: ['kas voin valuvaigistiga treenida', 'ibuprofeen enne trenni kas ok'],
  },
  tendon: {
    pl: ['ścięgno barku boli przy wyciskaniu', 'bol sciegna achillesa po bieganiu'],
    lt: ['peties sausgyslė skauda spaudžiant', 'kaip sustiprinti sausgysles?'],
    et: ['koolusevalu mida teha', 'mu achilleus valutab'],
  },
  cramps: {
    pl: ['skurcz lydki co robic', 'łapią mnie kurcze w udzie'],
    lt: ['per treniruotę sutraukė blauzdą, ką daryti?', 'ką daryti, kad netrauktų mėšlungio?'],
    et: ['miks mul krambid tulevad', 'kramp saares trenni ajal'],
  },
  numbness: {
    pl: ['czemu drętwieją mi ręce na siłce', 'cierpna mi ręka przy wyciskaniu'],
    lt: ['tirpsta ranka nuo prisitraukimų', 'jaučiu dilgčiojimą rankoje po salės'],
    et: ['mu kasi laheb tuimaks', 'sormed kipitavad parast pinki'],
  },
  calories: {
    pl: ['moje zero kaloryczne', 'jakie zapotrzebowanie przy treningach'],
    lt: ['mano dienos kalorijų poreikis', 'kiek kalorju reikia per diena?'],
    et: ['mitu kalorit mul vaja on', 'minu kalorivajadua'],
  },
  cut_deficit: {
    pl: ['redukcja jaki deficyt', 'ile ujac kalorii zeby schudnac'],
    lt: ['ar per didelis deficitas sudegina raumenis?', 'koks deficitas kad nesumazetu raumenys'],
    et: ['kui suur defitsiit peaks olema', 'kuivatus kui suur defitsit'],
  },
  bulk_surplus: {
    pl: ['lean bulk ile kalorii', 'ile dodac kalorii na mase'],
    lt: ['kiek kaloriju virs palaikomuju mases auginimui', 'kaip priaugti masės be daug riebalų?'],
    et: ['kui suur ulejaak massiks', 'bulk kui palju kalorit juurde'],
  },
  carbs: {
    pl: ['ile gramów węglowodanów na kg', 'wegle przed treningiem czy po'],
    lt: ['kiek angliu man reikia', 'angliavandenai ar blogi?'],
    et: ['kui palju susivesikuid suua', 'kas süsikad on halvad'],
  },
  fats: {
    pl: ['tluszcze na redukcji ile', 'czy jeść dużo tłuszczów na masie'],
    lt: ['ar valgyti avokadus ir riešutus?', 'per mažai riebalų – ar blogai testosteronui?'],
    et: ['kui palju rasva suua', 'mitu grammi rasva paevas'],
  },
  pre_meal: {
    pl: ['przed treningiem co najlepiej', 'ile przed silownia zjesc obiad'],
    lt: ['ar sportuoti tuščiu skrandžiu?', 'ka valgyt pries treniruote'],
    et: ['mida suua enne trenni', 'mis suua enne treenigut'],
  },
  post_meal: {
    pl: ['co jeść po wieczornym treningu', 'po silowni co najlepiej jesc'],
    lt: ['ar galima nevalgyti po treniruotės?', 'po treniruotes valgyt ka'],
    et: ['mida suua parast trenni', 'mis suua peale trenni'],
  },
  meals_count: {
    pl: ['co ile godzin jesc', 'ile posiłków na redukcji'],
    lt: ['kas kiek valandų valgyti?', 'kiek kartu per diena turėčiau vagyti?'],
    et: ['mitu toidukorda paevas', 'mitu korda paevas suua'],
  },
  vegan: {
    pl: ['wege a masa miesniowa', 'skąd brać białko jak nie jem mięsa'],
    lt: ['veganiski baltymai', 'ar augalinių baltymų pakanka raumenims?'],
    et: ['kas veganina saab lihast kasvatada', 'taimetoitlane ja lihaskasv'],
  },
  cheat_meal: {
    pl: ['zawaliłem dietę w weekend', 'czy można czasem zjeść fast food'],
    lt: ['suvalgiau visą tortą, ką dabar daryti?', 'ar ciyt meal ok per dziovinima'],
    et: ['kas petupaev on okei', 'soin burgerit kas dieet rikutud'],
  },
  sugar: {
    pl: ['batonik po treningu ok?', 'czy rezygnować z cukru całkiem'],
    lt: ['mėgstu saldumynus, ar tai trukdys progresui?', 'ar cukrus blogas sportuojant?'],
    et: ['kas suhkur on halb', 'sokolaad dieedi ajal'],
  },
  late_eating: {
    pl: ['pozne jedzenie zle?', 'twarożek przed snem ok?'],
    lt: ['ar blogai valgyt naktį', 'ar suvalgyti vakarienę 22 valandą ok?'],
    et: ['kas hilja soomine on halb', 'kas voin enne magamist suua'],
  },
  electrolytes: {
    pl: ['elektrolity czy woda', 'czy pic izotonik na silowni'],
    lt: ['ar gert magni', 'elektrolitai per treniruotę ar būtina?'],
    et: ['kas mul on elektroluute vaja', 'magneesium trenniks kas vaja'],
  },
  fiber: {
    pl: ['ile gramów błonnika', 'czy trzeba jeść warzywa na siłowni'],
    lt: ['kiek skaidulu per diena', 'ar gauti pakankamai skaidulų svarbu raumenims?'],
    et: ['kui palju kiudaineid suua', 'kiudainete kogus paevas'],
  },
  whats_up: {
    pl: ['cześć, co słychać?', 'hej co tam u cb'],
    lt: ['kas gird', 'nu kaip?'],
    et: ['mis teed?', 'kuidas laheb'],
  },
  good_night: {
    pl: ['kolorowych snów', 'pora spać, dobranoc'],
    lt: ['labanat', 'gerų sapnų'],
    et: ['head ood', 'head ööd sulle ka'],
  },
  tired: {
    pl: ['padam na twarz', 'nie mam sily dzisiaj'],
    lt: ['jokios energijos', 'pavargu labai'],
    et: ['olen vasinud', 'energiat pole yldse'],
  },
  bored: {
    pl: ['mam dość monotonii', 'jest mi nudno'],
    lt: ['nieko idomaus', 'man nuobodzu'],
    et: ['igavlen', 'nii igaw'],
  },
  challenge: {
    pl: ['dawaj wyzwanie', 'jakies wyzwanie treningowe'],
    lt: ['duok iššūki', 'sugalvok man iššūkį'],
    et: ['anna valjakutse', 'anna mulle valjakutse'],
  },
  fun_fact: {
    pl: ['jakiś fun fact?', 'wiesz coś ciekawego?'],
    lt: ['idomu faktas', 'pasakyk įdomų faktą apie raumenis'],
    et: ['raagi huvitav fakt', 'lobus fakt palun'],
  },
  quote: {
    pl: ['zmotywuj mnie cytatem', 'jakis cytat'],
    lt: ['pasakyk ką nors motyvuojančio', 'motivacine citata'],
    et: ['motiveeriv tsiaat', 'inspireeri mind palun'],
  },
  laugh: { pl: ['heheszki', 'smieszne xd'], lt: ['hahah', 'cha'], et: ['hahah', 'muahaha'] },
  mood_down: {
    pl: ['mam depresyjny nastrój', 'dzień do bani'],
    lt: ['bloga diena siandien', 'man liudna labai'],
    et: ['olen kurb tana', 'tunnen end masendunuld'],
  },
  mood_up: {
    pl: ['dobry dzien dzis', 'czuję się jak milion dolarów'],
    lt: ['puiki diena siandien', 'jaučiuos kaip milijonas'],
    et: ['tunnen end super hasti', 'tana on suureparane paev'],
  },
  lets_go: { pl: ['do boju', 'jazdaa'], lt: ['einammm', 'tai varom'], et: ['lahme', 'laaks'] },
  nothing: {
    pl: ['nic nic', 'tak se piszę'],
    lt: ['ai nieko', 'nieko, nekreipk dėmesio'],
    et: ['ei tahtnud midagi', 'vahet pole ikka'],
  },
  rival_ai: {
    pl: ['claude czy ty?', 'inne AI są lepsze od ciebie'],
    lt: ['ar tu toks pat kaip ChatGPT?', 'geriau paklausiu chatgpt'],
    et: ['kas sa oled parem kui chatgpt', 'chatgpt on targem kui sa'],
  },
  atlas_age: {
    pl: ['wiek?', 'jestes mlody czy stary'],
    lt: ['ar tu jaunas?', 'kiek tau metų, Atlas?'],
    et: ['mitu aastat sul on', 'kui vana sa olet'],
  },
  atlas_sleep: {
    pl: ['spisz w nocy?', 'ile śpisz'],
    lt: ['ar tu miegi naktim?', 'ar tu kartais miegi?'],
    et: ['kas sa magad', 'kas sa kunagi magad?'],
  },
  atlas_eat: {
    pl: ['jestes na masie czy redukcji?', 'co jadłeś dzisiaj'],
    lt: ['ar tu alkanas?', 'ar tu kada nors valgai?'],
    et: ['mida sa sood', 'mis su dieet on?'],
  },
  sing_poem: {
    pl: ['zaspiewasz?', 'ułóż rym o nogach'],
    lt: ['ar moki dainuoti?', 'parepuok'],
    et: ['laula mulle laulu', 'kirjuta luuletuss'],
  },
  clock: {
    pl: ['jaki mamy czas', 'sprawdź godzinę'],
    lt: ['kiek valandu dabar', 'kiek laiko rodo?'],
    et: ['mis kell on', 'palju kell on?'],
  },
  which_day: {
    pl: ['podaj datę', 'ktory dzis jest'],
    lt: ['kokia diena', 'kelinta diena siandien?'],
    et: ['mis paev tana on', 'mis kuupaev on'],
  },
  you_dumb: {
    pl: ['glupia odpowiedz', 'totalnie nie o to pytałem'],
    lt: ['tu visiškai nenaudingas', 'tu bukas'],
    et: ['kasutu robot', 'mottetu'],
  },
  k_bench_arch: {
    pl: ['mostek przy wyciskaniu jak zrobic', 'czy wyginać plecy przy wyciskaniu'],
    lt: ['ar nugara turi liesti suoliuką spaudžiant?', 'isslenkta nugara spaudime ok?'],
    et: ['kas pingil selga kaardu tommata', 'pingi kaar kas vajalik'],
  },
  k_deadlift_rounding: {
    pl: ['zaokrąglone plecy martwy ciag', 'plecy mi sie wyginaja w martwym'],
    lt: ['kaip neapvalint nugaros per trauka', 'mano apatinė nugara lenkiasi keliant nuo grindų'],
    et: ['selg laheb joutõmbel kuuru', 'umar selg joutombel'],
  },
  k_knees_cave: {
    pl: ['koślawe kolana przysiad jak poprawić', 'kolana wchodzą do środka przy wstawaniu'],
    lt: ['kylant keliai susiglaudžia', 'keliai i vidu per pritupima kaip taisyt'],
    et: ['polved vajuvad kukis sisse', 'mu polved lahevad kukis sissepoole'],
  },
  k_butt_wink: {
    pl: ['butwink jak poprawic', 'zaokrąglanie lędźwi na dole przysiadu'],
    lt: ['butwink ar blogai', 'uodegikaulis palenda po savim pritūpiant'],
    et: ['mis on butt vink', 'vaagen keerab kukis alla'],
  },
  k_ohp_lean: {
    pl: ['wyginam plecy przy wyciskaniu nad glowe', 'odchylanie przy military press'],
    lt: ['per daug atsilošimo OHP, kaip taisyti?', 'spaudimas stovint ir nugaros išlenkimas'],
    et: ['kaldun olalesurumisel taha', 'olale surumisel alaselg kaardub'],
  },
  k_sumo_conventional: {
    pl: ['sumo to cheat?', 'zmienić martwy na sumo?'],
    lt: ['kokia trauka geriau ilgoms kojoms?', 'sumo ar konvencine trauka'],
    et: ['sumo voi tavaline joutõmme', 'kas sumo on petmine'],
  },
  k_row_lower_back: {
    pl: ['czy zmienić wiosłowanie bo bolą lędźwie', 'krzyż mnie męczy przy wiosłowaniu w opadzie'],
    lt: [
      'ar pakeisti štangos trauką kitu pratimu, nes skauda juosmuo?',
      'juosmuo nepakelia traukos pasilenkus',
    ],
    et: ['alaselg vasib kangiga soudmisest', 'soudmine teeb alaseljale haiget'],
  },
  k_sleeves_wraps: {
    pl: ['czy owijki to oszukiwanie', 'owijki czy nie'],
    lt: ['ar pirkti riešų juostas spaudimui?', 'keliu movos ar reikia pritupimam'],
    et: ['kas mul on polvesukki vaja', 'randmesidemed kas vaja'],
  },
  k_chalk: {
    pl: ['magnezja w plynie czy sypka', 'magnezja na silce wolno?'],
    lt: ['magnezija ar verta', 'ar kreida padeda laikyti štangą?'],
    et: ['kas kasutada kriiti', 'kriit voi rihmad'],
  },
  k_smith_machine: {
    pl: ['smit czy wolne ciezary', 'czy ćwiczenia na Smithcie budują siłę'],
    lt: ['ar galiu treniruotis tik su Smito mašina?', 'smito treniruoklis blogai ar ne'],
    et: ['kas smithi masin on halb', 'smith vs vaba kang'],
  },
  k_test_max: {
    pl: ['testowanie maxa bezpiecznie', 'czy liczyć maksa z kalkulatora czy testować'],
    lt: ['kokie žingsniai testuojant maksimumą?', 'kaip patikrint savo maksa'],
    et: ['kuidas testida 1rm', 'kuidas ohutult maksi teha'],
  },
  k_shift_work: {
    pl: ['nocna zmiana i siłka', 'grafik zmianowy a trening'],
    lt: ['kaip suderinti salę su slenkančiu grafiku?', 'naktines pamainos ir treniruotes'],
    et: ['ootöo ja trenn', 'kuidas vahetustega too korvalt treenida'],
  },
  k_maintenance: {
    pl: ['czy 1 trening w tygodniu utrzyma mięśnie', 'utrzymanie masy przy małej ilości czasu'],
    lt: ['užimtas laikotarpis, kiek minimum treniruotis?', 'kiek treniruot kad islaikyt jega'],
    et: ['minimaalne trenn lihaste hoidmiseks', 'kuidas lihaseid sailitada vahese trenniga'],
  },
  k_holidays: {
    pl: ['czy przerwa świąteczna mi zaszkodzi', 'jedzenie w swieta i trening'],
    lt: ['persivalgiau per Kūčias, ar prarasiu raumenis?', 'kaip treniruotis per sventes'],
    et: ['kuidas joulude ajal treenida', 'puhad ja soomine'],
  },
  k_heat: {
    pl: ['duchota na silce co robic', 'trening przy wysokiej temperaturze'],
    lt: ['ar sumažinti krūvį kai karšta?', 'kaip treniruot kai karšta'],
    et: ['kuidas palavaga treenida', 'kuum ilm ja trenn'],
  },
  k_teen_lifting: {
    pl: ['czy dzieci mogą dźwigać', 'siłownia a wzrost u nastolatków'],
    lt: ['ar sale kenkia augimui', 'paauglys ir sporto salė'],
    et: ['kas tostmine on teismelistele ohutu', 'olen 15 kas voin joussaali minna'],
  },
  k_older_lifter: {
    pl: ['dźwiganie w starszym wieku', 'regeneracja po 50 roku życia'],
    lt: ['man 65 m. ar galiu pradėti kilnoti?', 'treniruotes po 50 metu'],
    et: ['kuidas vanemana treenida', 'tostmine parast 50'],
  },
  k_women_training: {
    pl: ['plan dla kobiety na silowni', 'czy kobieta powinna robić tylko pośladki'],
    lt: ['moteru ir vyru treniruotes skirtumas', 'ar moterims reikia daugiau pakartojimų?'],
    et: ['kas naised peavad rohkem kordusi tegema', 'naiste ja meeste treening erinevus'],
  },
  k_pushup_progression: {
    pl: ['zero pompek co robic', 'plan na naukę pompek'],
    lt: ['noriu padaryti bent vieną atsispaudimą', 'atsispaudimu progresija'],
    et: ['ma ei suuda katekoverdust teha', 'kuidas saada esimene katekõverdus'],
  },
  k_etiquette: {
    pl: ['czy mozna sie wciąć w czyjąś serię', 'czego nie robić na siłowni'],
    lt: ['kaip mandagiai pasidalinti treniruokliu?', 'sales etiketas ka reikia zinot'],
    et: ['joussaali etikett', 'joussaali kirjutamata reeglid'],
  },
  k_beta_alanine: {
    pl: ['beta alanina dawkowanie', 'beta-alanina warto?'],
    lt: ['beta alaninas niezti oda', 'beta alaninas ar padeda salėje?'],
    et: ['kas beeta alaniin tootab', 'beeta-alaniin kipitus'],
  },
  k_fish_oil: {
    pl: ['omega-3 na stawy', 'olej z ryb suplementowac?'],
    lt: ['omega trys ar verta', 'ar vartoti žuvų aliejų?'],
    et: ['kas vota kalaoli', 'omega-3 kas tasub votta'],
  },
  k_preworkout: {
    pl: ['jaki przedtreningowy suplement', 'przedtreningówka codziennie ok?'],
    lt: ['ką turi turėti geras priešdarbinis?', 'preworkout ar reikia'],
    et: ['kas preworkout on vajalik', 'pre workout kas tasub'],
  },
  k_bcaa: {
    pl: ['bcaa to strata kasy?', 'czy brac bcaa'],
    lt: ['ar bcaa verta pirkti', 'BCAA naudingos ar ne?'],
    et: ['kas bcaa on vajalik', 'bcaa kas tasub votta'],
  },
  k_core_stability: {
    pl: ['ćwiczenia na mięśnie brzucha dla trójboisty', 'jak wzmocnic core'],
    lt: ['core pratimai kokie geriausi', 'noriu stipraus korpuso, ką daryti?'],
    et: ['parimad kohulihaste harjutused', 'kere treening mitte kohukõverdused'],
  },
  k_ankle_mobility: {
    pl: ['buty do przysiadu czy mobilność', 'kostki blokuja przysiad'],
    lt: ['ciurnu mobilumas kaip pagerint', 'kulnai pakyla per pritupimus ka daryt'],
    et: ['kannad tousevad kukis', 'pahkluu liikuvus kukk'],
  },
  k_gassed: {
    pl: ['brakuje mi powietrza podczas serii', 'kondycja na silke jak poprawic'],
    lt: ['greitai uždūstu per treniruotę', 'kaip pagerint istverme salej'],
    et: ['jaan seeriates hingetuks', 'kuidas konditsiooni parandada'],
  },
  k_sticking_point: {
    pl: ['martwy ciąg staje przy kolanach', 'jak pokonac martwy punkt'],
    lt: ['kaip įveikti stagnacijos tašką judesyje?', 'negaliu uzrakint spaudimo virsuje'],
    et: ['kuidas seisupunkti parandada', 'pink jaab poolel teel kinni'],
  },
  k_more_pullups: {
    pl: ['wiecej powtorzen na drazku', 'jak dojść do 20 podciągnięć'],
    lt: ['kaip gerint prisitraukimus', 'daugiau prisitrauikmų kaip?'],
    et: ['kuidas rohkem louatõmbeid teha', 'louatombed kuidas rohkem'],
  },
  k_mind_muscle: {
    pl: ['czuję ćwiczenie nie tam gdzie trzeba', 'jak lepiej czuc miesien'],
    lt: ['mind muscle connection kaip', 'spaudžiu bet dirba tik pečiai, ne krūtinė'],
    et: ['ei tunne rinda pingil', 'ma ei tunne lihast tootamas'],
  },
  k_partial_reps: {
    pl: ['czy robic pelny zakres', 'półruchy czy pełne powtórzenia'],
    lt: ['partials ar pilnas judesys', 'ar gerai daryti pusinius pakartojimus?'],
    et: ['taisamplituud voi osalised kordused', 'kas osalised kordused toimivad'],
  },
  k_bands: {
    pl: ['trening na gumach tylko', 'czy mozna rosnac na gumach'],
    lt: ['gumos ar svarmenys kas geriau', 'ar verta pirkti treniruočių gumas?'],
    et: ['kas kummid on tohusad', 'kummid vs raskused kumb parem'],
  },
  k_kettlebell_swing: {
    pl: ['swing kettlebell krok po kroku', 'jak robić wymachy kettlebell'],
    lt: ['svarscio mosto technika', 'skauda nugara nuo svarsčio mostų, ką darau blogai?'],
    et: ['sangpommi ootsu tehnika', 'kuidas teha kettlebelli swingi'],
  },
  k_program_hopping: {
    pl: ['zmieniac cwiczenia czesto?', 'jak długo robić ten sam program'],
    lt: ['kiek laiko daryti tą pačią programą?', 'ar daznai keisti pratimus'],
    et: ['kui tihti kava vahetada', 'kas lihaseid saab segadusse ajada'],
  },
  k_cardio_order: {
    pl: ['czy biegac przed treningiem silowym', 'co najpierw rower czy ciężary'],
    lt: ['kada daryti kardio, prieš ar po svarmenų?', 'kardijo pries ar po sales'],
    et: ['kardio enne voi parast joutrenni', 'kas joosta enne voi parast tostmist'],
  },
  k_exercise_order: {
    pl: ['kolejnosc na nogi', 'ułożenie ćwiczeń w treningu'],
    lt: ['kokia tvarka daryt pratimus', 'kaip išdėstyti pratimus vienoje treniruotėje?'],
    et: ['mis jarjekorras harjutusi teha', 'harjutuste jarjekord'],
  },
  k_imbalance: {
    pl: ['asymetria na klacie', 'lewa strona slabsza'],
    lt: ['ar daryti vienpusius pratimus dėl disbalanso?', 'viena ranka stipresne uz kita'],
    et: ['uks pool tugevam kui teine', 'vasak kasi norgem'],
  },
  k_knees_over_toes: {
    pl: ['kolana za palcami w wykroku', 'czy trzymac kolana za palcami'],
    lt: ['ar keliams kenkia kai jie išeina į priekį už pėdų?', 'keliai uz kojų pirštų ar blogai?'],
    et: ['polved ule varvaste kas halb', 'kas polved tohivad varvastest ette minna'],
  },
  k_bail_squat: {
    pl: ['zrzut sztangi do tyłu', 'jak ustawic zabezpieczenia do przysiadu'],
    lt: ['kaip nukristi su štanga saugiai?', 'kaip išlipti iš po štangos jei nepakeliu?'],
    et: ['kuidas kukist ohutult valja tulla', 'turvatoed kuki jaoks'],
  },
  k_personal_trainer: {
    pl: ['personalny czy aplikacja', 'trener personalny dla poczatkujacego'],
    lt: ['ar verta imt asmenini treneri', 'ar asmeninis treneris atsipirks?'],
    et: ['kas personaaltreener tasub', 'kas mul on treenerit vaja?'],
  },
};
