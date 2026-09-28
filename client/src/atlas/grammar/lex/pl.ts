/**
 * Polish lexicon.
 *
 * Verbs: "infinitive:3sg-present[:imperative[:pastM3/pastF3]]", '!' = perfective.
 * Empty fields are derived by the conjugation-class rules in lang/pl.ts
 * (3sg -a / -i / -y / -e / -uje / -nie / -dzie; past from the infinitive).
 */
export const PL_VERBS = `robić:robi:rób zrobić!:zrobi:zrób przerobić!:przerobi:przerób wykonać!:wykona wykonywać:wykonuje
przebiec!:przebiegnie::przebiegł/przebiegła biec:biegnie::biegł/biegła pobiec!:pobiegnie::pobiegł/pobiegła
dobiec!:dobiegnie::dobiegł/dobiegła biegać:biega pobiegać!:pobiega przebiegać:przebiega uciekać:ucieka
boleć:boli rozboleć!:rozboli móc:może::mógł/mogła trenować:trenuje potrenować!:potrenuje przetrenować!:przetrenuje
ćwiczyć:ćwiczy poćwiczyć!:poćwiczy jeść:je::jadł/jadła zjeść!:zje::zjadł/zjadła pić:pije wypić!:wypije
spać:śpi:śpij wyspać!:wyśpi:wyśpij odpowiedzieć!:odpowie:odpowiedz odpowiadać:odpowiada dać!:da:daj dawać:daje
mieć:ma:miej wiedzieć:wie:wiedz być:jest:bądź iść:idzie:idź:szedł/szła pójść!:pójdzie:pójdź:poszedł/poszła
chcieć:chce:chciej schudnąć!:schudnie::schudł/schudła chudnąć:chudnie::chudł/chudła liczyć:liczy policzyć!:policzy
zliczyć!:zliczy doliczyć!:doliczy doliczać:dolicza komentować:komentuje skomentować!:skomentuje potrzebować:potrzebuje
pokazać!:pokaże:pokaż pokazywać:pokazuje tańczyć:tańczy zatańczyć!:zatańczy mówić:mówi powiedzieć!:powie:powiedz
myśleć:myśli pomyśleć!:pomyśli czuć:czuje poczuć!:poczuje lubić:lubi polubić!:polubi pomóc!:pomoże:pomóż:pomógł/pomogła
pomagać:pomaga odpoczywać:odpoczywa odpocząć!:odpocznie zmęczyć!:zmęczy męczyć:męczy pracować:pracuje popracować!:popracuje
ważyć:waży zważyć!:zważy przysiadać:przysiada przysiąść!:przysiądzie::przysiadł/przysiadła wyciskać:wyciska
wycisnąć!:wyciśnie:wyciśnij podnosić:podnosi podnieść!:podniesie:podnieś:podniósł/podniosła spalić!:spali palić:pali
spalać:spala zapisać!:zapisze:zapisz zapisywać:zapisuje pamiętać:pamięta zapamiętać!:zapamięta zapomnieć!:zapomni
zapominać:zapomina rozciągać:rozciąga rozciągnąć!:rozciągnie ignorować:ignoruje zignorować!:zignoruje przytyć!:przytyje
tyć:tyje zaczynać:zaczyna zacząć!:zacznie kończyć:kończy skończyć!:skończy pływać:pływa popływać!:popływa
przepłynąć!:przepłynie jeździć:jeździ:jeźdź chodzić:chodzi:chodź przyjść!:przyjdzie:przyjdź:przyszedł/przyszła
wyjść!:wyjdzie:wyjdź:wyszedł/wyszła wejść!:wejdzie:wejdź:wszedł/weszła dojść!:dojdzie:dojdź:doszedł/doszła
przejść!:przejdzie:przejdź:przeszedł/przeszła zejść!:zejdzie:zejdź:zszedł/zeszła wrócić!:wróci wracać:wraca
ułożyć!:ułoży:ułóż układać:układa planować:planuje zaplanować!:zaplanuje wyjaśnić!:wyjaśni wyjaśniać:wyjaśnia
tłumaczyć:tłumaczy wytłumaczyć!:wytłumaczy rozumieć:rozumie zrozumieć!:zrozumie widzieć:widzi zobaczyć!:zobaczy
słyszeć:słyszy usłyszeć!:usłyszy pytać:pyta zapytać!:zapyta spytać!:spyta dodać!:doda dodawać:dodaje zmienić!:zmieni
zmieniać:zmienia wziąć!:weźmie:weź:wziął/wzięła brać:bierze:bierz zabrać!:zabierze:zabierz wybrać!:wybierze:wybierz
wybierać:wybiera zebrać!:zbierze:zbierz zbierać:zbiera nabrać!:nabierze:nabierz przybrać!:przybierze:przybierz
czekać:czeka poczekać!:poczeka zaczekać!:zaczeka czytać:czyta przeczytać!:przeczyta dbać:dba zadbać!:zadba
grać:gra zagrać!:zagra wygrać!:wygra przegrać!:przegra wygrywać:wygrywa przegrywać:przegrywa kochać:kocha
mieszkać:mieszka oglądać:ogląda obejrzeć!:obejrzy słuchać:słucha posłuchać!:posłucha sprawdzać:sprawdza
sprawdzić!:sprawdzi szukać:szuka poszukać!:poszuka znaleźć!:znajdzie:znajdź:znalazł/znalazła znajdować:znajduje
trzymać:trzyma utrzymać!:utrzyma wytrzymać!:wytrzyma oddychać:oddycha odetchnąć!:odetchnie przesadzać:przesadza
przesadzić!:przesadzi nadrabiać:nadrabia nadrobić!:nadrobi opuszczać:opuszcza opuścić!:opuści pomijać:pomija
pominąć!:pominie spóźniać:spóźnia spóźnić!:spóźni wstawać:wstaje wstać!:wstanie zasypiać:zasypia
zasnąć!:zaśnie::zasnął/zasnęła budzić:budzi obudzić!:obudzi wysypiać:wysypia nagrywać:nagrywa nagrać!:nagra
mierzyć:mierzy zmierzyć!:zmierzy śledzić:śledzi uwzględniać:uwzględnia uwzględnić!:uwzględni zaliczać:zalicza
zaliczyć!:zaliczy odejmować:odejmuje odjąć!:odejmie:odejmij przestawać:przestaje przestać!:przestanie
dostawać:dostaje dostać!:dostanie zostawać:zostaje zostać!:zostanie stawać:staje stać:stoi:stój uczyć:uczy
nauczyć!:nauczy używać:używa użyć!:użyje:użyj jechać:jedzie:jedź pojechać!:pojedzie:pojedź przyjechać!:przyjedzie
wyjechać!:wyjedzie przejechać!:przejedzie kłaść:kładzie:kładź:kładł/kładła położyć!:położy:połóż stawiać:stawia
postawić!:postawi siedzieć:siedzi usiąść!:usiądzie::usiadł/usiadła siadać:siada leżeć:leży kucać:kuca
skakać:skacze skoczyć!:skoczy pompować:pompuje podciągać:podciąga podciągnąć!:podciągnie wiosłować:wiosłuje
rozgrzewać:rozgrzewa rozgrzać!:rozgrzeje naciągnąć!:naciągnie nadwyrężyć!:nadwyręży skręcić!:skręci
złamać!:złamie uszkodzić!:uszkodzi dolegać:dolega drżeć:drży kręcić:kręci puchnąć:puchnie spuchnąć!:spuchnie
chorować:choruje zachorować!:zachoruje leczyć:leczy wyleczyć!:wyleczy znać:zna wierzyć:wierzy uwierzyć!:uwierzy
sądzić:sądzi uważać:uważa wydawać:wydaje wydać!:wyda martwić:martwi zmartwić!:zmartwi bać:boi:bój
denerwować:denerwuje zdenerwować!:zdenerwuje stresować:stresuje zestresować!:zestresuje cieszyć:cieszy
ucieszyć!:ucieszy nudzić:nudzi znudzić!:znudzi wkurzać:wkurza wkurzyć!:wkurzy nienawidzić:nienawidzi
musieć:musi umieć:umie potrafić:potrafi próbować:próbuje spróbować!:spróbuje starać:stara postarać!:postara
zwiększać:zwiększa zwiększyć!:zwiększy zmniejszać:zmniejsza zmniejszyć!:zmniejszy obniżać:obniża obniżyć!:obniży
startować:startuje wystartować!:wystartuje gotować:gotuje ugotować!:ugotuje kupować:kupuje kupić!:kupi
płacić:płaci zapłacić!:zapłaci rozmawiać:rozmawia porozmawiać!:porozmawia pisać:pisze:pisz napisać!:napisze:napisz
odpisać!:odpisze:odpisz dzwonić:dzwoni zadzwonić!:zadzwoni radzić:radzi poradzić!:poradzi doradzić!:doradzi
polecać:poleca polecić!:poleci proponować:proponuje zaproponować!:zaproponuje sugerować:sugeruje
zasugerować!:zasugeruje przypominać:przypomina przypomnieć!:przypomni zdążyć!:zdąży otworzyć!:otworzy:otwórz
zamknąć!:zamknie włączyć!:włączy wyłączyć!:wyłączy kontynuować:kontynuuje powtarzać:powtarza powtórzyć!:powtórzy
poprawić!:poprawi poprawiać:poprawia naprawić!:naprawi rozwijać:rozwija rozwinąć!:rozwinie budować:buduje
zbudować!:zbuduje rosnąć:rośnie::rósł/rosła urosnąć!:urośnie::urósł/urosła tracić:traci stracić!:straci
zyskać!:zyska osiągnąć!:osiągnie osiągać:osiąga regenerować:regeneruje zregenerować!:zregeneruje pocić:poci
spocić!:spoci przeszkadzać:przeszkadza działać:działa zadziałać!:zadziała pasować:pasuje wystarczać:wystarcza
wystarczyć!:wystarczy brakować:brakuje zależeć:zależy ruszać:rusza ruszyć!:ruszy spacerować:spaceruje
wspinać:wspina decydować:decyduje zdecydować!:zdecyduje wątpić:wątpi trwać:trwa zajmować:zajmuje
zająć!:zajmie:zajmij przyjmować:przyjmuje przyjąć!:przyjmie:przyjmij zrzucić!:zrzuci zrzucać:zrzuca
wyglądać:wygląda dźwigać:dźwiga obciążać:obciąża wzmacniać:wzmacnia wzmocnić!:wzmocni rozluźnić!:rozluźni
napinać:napina prostować:prostuje wyprostować!:wyprostuje zginać:zgina opierać:opiera chwytać:chwyta
chwycić!:chwyci upuścić!:upuści spadać:spada spaść!:spadnie::spadł/spadła upaść!:upadnie::upadł/upadła
przewrócić!:przewróci pękać:pęka pęknąć!:pęknie strzelać:strzela klikać:klika kliknąć!:kliknie drętwieć:drętwieje
zdrętwieć!:zdrętwieje mdleć:mdleje zemdleć!:zemdleje odwołać!:odwoła przełożyć!:przełoży:przełóż przesunąć!:przesunie
ustawić!:ustawi ustawiać:ustawia zmodyfikować!:zmodyfikuje dostosować!:dostosuje dostosowywać:dostosowuje
dopasować!:dopasuje obliczyć!:obliczy obliczać:oblicza pokonać!:pokona nosić:nosi zgadzać:zgadza zgodzić!:zgodzi
mylić:myli pomylić!:pomyli kłamać:kłamie żartować:żartuje dziękować:dziękuje podziękować!:podziękuje prosić:prosi
poprosić!:poprosi chwalić:chwali pochwalić!:pochwali narzekać:narzeka obiecać!:obieca obiecywać:obiecuje
zamierzać:zamierza szkodzić:szkodzi zaszkodzić!:zaszkodzi ryzykować:ryzykuje unikać:unika uniknąć!:uniknie
słabnąć:słabnie zdarzać:zdarza zdarzyć!:zdarzy dziać:dzieje wydarzyć!:wydarzy kosztować:kosztuje
podskakiwać:podskakuje ciągnąć:ciągnie pociągnąć!:pociągnie pchać:pcha pchnąć!:pchnie rzucać:rzuca rzucić!:rzuci
łapać:łapie złapać!:złapie kopać:kopie bić:bije pobić!:pobije walczyć:walczy boksować:boksuje wspierać:wspiera
motywować:motywuje zmotywować!:zmotywuje wstydzić:wstydzi zasłużyć!:zasłuży podróżować:podróżuje
pozwalać:pozwala pozwolić!:pozwoli:pozwól zabraniać:zabrania zabronić!:zabroni kazać:każe zdołać!:zdoła
żyć:żyje patrzeć:patrzy spojrzeć!:spojrzy ubierać:ubiera przygotować!:przygotuje przygotowywać:przygotowuje
odpuścić!:odpuści odpuszczać:odpuszcza przerwać!:przerwie:przerwij przerywać:przerywa przeciążyć!:przeciąży
naciskać:naciska nacisnąć!:naciśnie:naciśnij prowadzić:prowadzi poprowadzić!:poprowadzi mijać:mija minąć!:minie
zmusić!:zmusi zmuszać:zmusza trafić!:trafi trafiać:trafia stracić!:straci wyrobić!:wyrobi dokończyć!:dokończy
dokładać:dokłada dołożyć!:dołoży:dołóż odważyć!:odważy zważać:zważa`;

/** Irregular present forms: form:lemma:person+number. */
export const PL_IRR = `jestem:być:1s jesteś:być:2s jest:być:3s jesteśmy:być:1p jesteście:być:2p są:być:3p
mogę:móc:1s możesz:móc:2s może:móc:3s możemy:móc:1p możecie:móc:2p mogą:móc:3p
pomogę:pomóc:1s pomożesz:pomóc:2s pomoże:pomóc:3s pomogą:pomóc:3p
jem:jeść:1s jesz:jeść:2s je:jeść:3s jemy:jeść:1p jecie:jeść:2p jedzą:jeść:3p zjem:zjeść:1s zjesz:zjeść:2s zjedzą:zjeść:3p
wiem:wiedzieć:1s wiesz:wiedzieć:2s wie:wiedzieć:3s wiemy:wiedzieć:1p wiecie:wiedzieć:2p wiedzą:wiedzieć:3p
mam:mieć:1s masz:mieć:2s ma:mieć:3s mamy:mieć:1p macie:mieć:2p mają:mieć:3p
chcę:chcieć:1s chcesz:chcieć:2s chce:chcieć:3s chcemy:chcieć:1p chcecie:chcieć:2p chcą:chcieć:3p
śpię:spać:1s śpisz:spać:2s śpimy:spać:1p śpią:spać:3p
biorę:brać:1s bierzesz:brać:2s biorą:brać:3p zabiorę:zabrać:1s wybiorę:wybrać:1s zbiorę:zebrać:1s nabiorę:nabrać:1s
wezmę:wziąć:1s weźmiesz:wziąć:2s wezmą:wziąć:3p
jadę:jechać:1s jadą:jechać:3p pojadę:pojechać:1s pojadą:pojechać:3p przyjadę:przyjechać:1s wyjadę:wyjechać:1s
jeżdżę:jeździć:1s zasnę:zasnąć:1s zasną:zasnąć:3p rosnę:rosnąć:1s urosnę:urosnąć:1s
muszę:musieć:1s musisz:musieć:2s musi:musieć:3s musimy:musieć:1p musicie:musieć:2p muszą:musieć:3p
boję:bać:1s boisz:bać:2s boi:bać:3s boją:bać:3p stoję:stać:1s stoją:stać:3p
powinienem:powinien:1s powinnam:powinien:1s powinieneś:powinien:2s powinnaś:powinien:2s powinien:powinien:3s
powinna:powinien:3s powinno:powinien:3s powinniśmy:powinien:1p powinnyśmy:powinien:1p powinni:powinien:3p powinny:powinien:3p
będę:być:1s:f będziesz:być:2s:f będzie:być:3s:f będziemy:być:1p:f będziecie:być:2p:f będą:być:3p:f`;

export const PL_NOUNS = `trening treningi seria serie powtórzenie powtórzenia biceps triceps brzuch kolano kolana noga nogi plan tydzień
przysiad przysiady kreatyna siłownia białko statystyka statystyki pytanie dzień dni godzina godziny cardio kardio
plecy ramię ramiona klatka mięsień mięśnie sen woda kawa dieta kalorie waga ciężar ciało głowa serce bieg
wynik rekord cel siła forma technika pora czas lato zima rano wieczór trener łokieć bark barki nadgarstek kostka
biodro biodra udo uda łydka łydki pośladki szyja kręgosłup ręka ręce palec palce stopa stopy pierś klatka
podciąganie pompka pompki wyciskanie martwy ciąg sztanga hantle hantla drążek ławka maszyna bieżnia rower
basen pływanie spacer rozgrzewka rozciąganie joga odpoczynek regeneracja kontuzja ból uraz lekarz fizjoterapeuta
kolega koleżanka żona mąż dziewczyna chłopak przyjaciel syn córka mama tata ludzie człowiek maraton półmaraton
tempo tętno puls kroki krok śniadanie obiad kolacja posiłek jedzenie mleko jajka ryż mięso owoce warzywa
suplement suplementy aplikacja telefon program rekordy wyniki postęp postępy przerwa tydzień miesiąc rok
wakacje urlop praca szkoła dom park deszcz pogoda upał zimno gorączka przeziębienie choroba grypa wilk
pas pasek buty ubranie zegarek`;

export const PL_ADJ = `bezpieczny zmęczony dobry zły najlepszy ciężki lekki nowy stary duży mały silny słaby gotowy pewny chory
zdrowy ważny szkodliwy normalny głodny spragniony obolały sztywny spocony zadowolony szczęśliwy smutny zły
wściekły zestresowany zmotywowany leniwy szybki wolny długi krótki wysoki niski gruby chudy trudny łatwy
możliwy potrzebny konieczny dziwny ostry tępy martwy dolny górny prawy lewy jedyny pierwszy ostatni kolejny
następny poprzedni wczorajszy dzisiejszy jutrzejszy ciepły zimny gorący mokry suchy pełny pusty lepszy gorszy
większy mniejszy cięższy lżejszy najgorszy zamknięty otwarty zajęty wolny`;
