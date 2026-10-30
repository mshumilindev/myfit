import type { LegalTexts } from './legal.types';

/**
 * Polish texts of the Privacy Policy and Terms of Use. MACHINE-PREPARED TRANSLATION of legal.en.ts (the canonical
 * text): NOT reviewed by a lawyer or a native speaker, NOT for publication (see `TRANSLATION_REVIEW` in
 * client/src/legal/pending.ts). Same section ids and structure as legal.en.ts; do not add or drop anything here
 * without changing the English text first.
 */
export const legalPl: LegalTexts = {
  ui: {
    brandLabel: 'Spotter, strona główna',
    contents: 'Spis treści',
    save: 'Zapisz jako PDF',
    print: 'Drukuj',
    saveHint:
      'Oba przyciski otwierają okno drukowania przeglądarki. Aby uzyskać PDF, wybierz jako drukarkę „Zapisz jako PDF”.',
    version: (v) => `Wersja ${v}`,
    updated: (d) => `Ostatnia aktualizacja: ${d}`,
    legalNav: 'Informacje prawne',
    privacyLink: 'Polityka prywatności',
    termsLink: 'Warunki korzystania',
    englishOnlyNote: '',
  },
  privacy: {
    title: 'Polityka prywatności Spotter',
    sections: [
      {
        id: 'p1',
        title: 'Kim jesteśmy',
        body: [
          {
            p: 'Administratorem Twoich danych osobowych jest **Mykola Volodymyrovych Lukianov**, osoba fizyczna, Bukowińska 17/1005, Warszawa, Polska („Spotter”, „my”). Nie powołaliśmy inspektora ochrony danych.',
          },
          {
            p: 'Spotter to aplikacja treningowa dla osób, które ćwiczą, i dla trenerów personalnych, którzy je prowadzą, dostępna jako aplikacja internetowa (myspotter.fit).',
          },
        ],
      },
      {
        id: 'p2',
        title: 'Role: Ty, Twój trener i my',
        body: [
          {
            ul: [
              '**Gdy korzystasz ze Spotter samodzielnie** (zapisujesz treningi, sen, pomiary ciała, żywienie itd.), to my decydujemy, w jakim celu i w jaki sposób Twoje dane są przetwarzane. Jesteśmy administratorem.',
              '**Gdy współpracujesz z trenerem w Spotter**, trener decyduje, co zapisuje o Tobie na potrzeby treningu (na przykład prywatne notatki, plany i harmonogramy) i w jakim celu. W odniesieniu do tych zapisów trener jest prawdopodobnie niezależnym administratorem, a my zapewniamy narzędzie.',
              '**Członkowie zespołu trenera** (na przykład menedżer) widzą tylko to, co udostępnił trener i na co pozwala aplikacja dla danej roli. Zespół Twojego trenera jest dla Ciebie widoczny w aplikacji, a działania członka zespołu na Twoich danych są pokazane w „Kto widział Twoje dane”.',
            ],
          },
        ],
      },
      {
        id: 'p3',
        title: 'Jakie dane przetwarzamy, po co i na jakiej podstawie prawnej',
        body: [
          {
            table: {
              head: ['Co', 'Po co', 'Podstawa prawna (RODO)'],
              rows: [
                [
                  '**Konto:** nazwa użytkownika, imię i nazwisko, rola, status, zdjęcie profilowe, powiązanie z Twoim trenerem, skrót hasła, czas utworzenia i aktualizacji',
                  'Utworzenie i prowadzenie konta; logowanie; pokazanie, kto jest kim',
                  'Umowa, art. 6 ust. 1 lit. b',
                ],
                [
                  '**Dane o treningu, aktywności i ciele, które wprowadzasz:** treningi, serie, siłownie, przerwy, aktywności, sen, pomiary ciała, cele',
                  'Zapewnienie trackera i obliczeń, o które prosisz',
                  'Umowa, art. 6 ust. 1 lit. b. Gdy dane ujawniają stan zdrowia — wyraźna zgoda, art. 9 ust. 2 lit. a, zob. punkt 6',
                ],
                [
                  '**Dane dotyczące zdrowia, które postanawiasz wprowadzić:** urazy, choroby przewlekłe, cykl menstruacyjny, nikotyna, alkohol, suplementy, żywienie',
                  'Zapewnienie funkcji, które włączasz',
                  'Wyraźna zgoda, art. 9 ust. 2 lit. a, udzielana przy włączeniu funkcji',
                ],
                [
                  '**Dane współpracy z trenerem:** wiadomości czatu, udostępnione Ci notatki, plany, harmonogramy i prośby o zmianę terminu, ustawienia zgód i udostępniania, dziennik dostępu, powiadomienia serwisowe',
                  'Umożliwienie Tobie i Twojemu trenerowi wspólnej pracy',
                  'Umowa, art. 6 ust. 1 lit. b; treści dotyczące zdrowia — na podstawie Twojej wyraźnej zgody, art. 9 ust. 2 lit. a',
                ],
                [
                  '**Dane zespołu (trenerzy i menedżerowie):** członkostwo w zespole, role, zaproszenia, dziennik działań (kto co zrobił, bez treści)',
                  'Prowadzenie zespołu trenera i pokazanie Ci, co działo się z Twoimi danymi',
                  'Umowa; prawnie uzasadniony interes w rozliczalności, art. 6 ust. 1 lit. f',
                ],
                [
                  '**Powiadomienia push:** token urządzenia, zaplanowany tekst przypomnienia, godziny ciszy',
                  'Wysyłanie przypomnień i alertów, o które prosisz',
                  'Zgoda wyrażona przez uprawnienie przeglądarki lub systemu, art. 6 ust. 1 lit. a',
                ],
                [
                  '**Dane bezpieczeństwa:** liczniki prób logowania (w tym adres IP i wpisana nazwa), sesje urządzeń i passkeys, dziennik pobrań kluczy',
                  'Ochrona kont przed odgadywaniem haseł i nadużyciami',
                  'Prawnie uzasadniony interes, art. 6 ust. 1 lit. f',
                ],
                [
                  '**Ustawienia i drobne wartości na Twoim koncie:** jednostki, ustawienia ćwiczeń, wartości widżetów „Dziś”, rozpoczęte wyzwania i ich postęp, zapisane lekcje, motyw i język, przełączniki powiadomień',
                  'Aby ustawienia i postępy były takie same na wszystkich Twoich urządzeniach',
                  'Umowa, art. 6 ust. 1 lit. b',
                ],
                [
                  '**Historia czatu Atlas na Twoim koncie (tylko jeśli ją włączysz):** wiadomości z Twojego czatu z Atlasem',
                  'Pokazywanie tego samego czatu na wszystkich Twoich urządzeniach',
                  'Zgoda, art. 6 ust. 1 lit. a; dane o zdrowiu wpisane w czacie — wyraźna zgoda, art. 9 ust. 2 lit. a; zob. punkty 7 i 8',
                ],
                [
                  '**Czat Atlas AI (tylko jeśli go włączysz):** Twoje pytanie i podsumowanie Twoich danych treningowych',
                  'Odpowiadanie na pytania w dowolnej formie',
                  'Wyraźna zgoda, art. 9 ust. 2 lit. a, gdy uwzględniono dane o zdrowiu, w pozostałych przypadkach art. 6 ust. 1 lit. a; zob. punkt 7',
                ],
                [
                  '**Dane techniczne:** adres IP i metadane żądań przetwarzane przez naszych dostawców hostingu i chmury',
                  'Świadczenie usługi i dbanie o jej bezpieczeństwo',
                  'Prawnie uzasadniony interes, art. 6 ust. 1 lit. f',
                ],
              ],
            },
          },
          {
            p: 'Nie sprzedajemy Twoich danych. Nie wykorzystujemy ich do reklamy. Nie podejmujemy wobec Ciebie decyzji opartych wyłącznie na zautomatyzowanym przetwarzaniu, które wywołują skutki prawne lub podobnie istotnie na Ciebie wpływają (art. 22).',
          },
        ],
      },
      {
        id: 'p4',
        title: 'Jak chronimy Twoje dane',
        body: [
          {
            ul: [
              'Dane, które wprowadzasz (treningi, sen, ciało, urazy, choroby, cykl, nikotyna, alkohol, suplementy i reszta listy w „Co Spotter wie o Tobie” w aplikacji), są szyfrowane na Twoim urządzeniu przed zapisaniem w naszej bazie, więc baza zawiera szyfrogram. Klucz szyfrowania Twojego konta wydaje nasz serwer Twojemu zalogowanemu urządzeniu; niewielki zestaw pól potrzebnych naszym serwerom do działania (takich jak znaczniki czasu i niektóre liczby zbiorcze) nie jest szyfrowany, podobnie jak zapis udzielonych przez Ciebie zgód, który pokazuje rodzaj zgody (na przykład którą funkcję zdrowotną albo czat Atlas AI). Dziennika żywienia Spotter również nie szyfruje. Ponieważ klucz wydaje nasz serwer, jest to **szyfrowanie danych w spoczynku i w transmisji, a nie szyfrowanie end-to-end wobec nas**: osoba z dostępem do sekretów naszego serwera mogłaby technicznie wyprowadzić klucz.',
              'Rozmowy z trenerem, udostępnione notatki, plany i harmonogramy są szyfrowane kluczem rozmowy, który jest opakowany dla urządzeń uczestników. Nasze serwery nie przechowują tego klucza rozmowy. Zmiany kluczy są rejestrowane, a usunięty członek zespołu nie otrzymuje kluczy do nowych treści.',
              'Prywatne notatki, które trener prowadzi o Tobie w obecnej funkcji notatek, są szyfrowane własnym kluczem trenera, a nie naszym ani Twoim. Starsze notatki trenera (sprzed tej funkcji) są przechowywane na naszych serwerach w czytelnej postaci.',
              'Dostęp do bazy jest ograniczony regułami i naszymi funkcjami w chmurze; działania uprzywilejowane odbywają się wyłącznie przez funkcje.',
              'Po wylogowaniu dane konta są usuwane z urządzenia.',
            ],
          },
          {
            p: 'Żaden system nie jest całkowicie bezpieczny. Jeśli naruszenie wpłynie na Twoje prawa, powiadomimy Ciebie i organ nadzorczy zgodnie z przepisami.',
          },
        ],
      },
      {
        id: 'p5',
        title: 'Kto otrzymuje Twoje dane',
        body: [
          {
            ul: [
              '**Twój trener i jego zespół** — w granicach tego, co udostępniasz, i tego, na co pozwala ich rola. Udostępnianiem kategorii zdrowotnych zarządzasz w „Prywatność i udostępnianie” i możesz je cofnąć.',
              '**Google (Firebase / Google Cloud)** jako nasz podmiot przetwarzający: uwierzytelnianie, baza danych, funkcje w chmurze (region us-central1), przechowywanie plików, hosting, dostarczanie powiadomień push i atestacja aplikacji (App Check z reCAPTCHA Enterprise). Google działa jako podmiot przetwarzający na podstawie Warunków przetwarzania danych i bezpieczeństwa Firebase; transfery międzynarodowe opierają się na mechanizmach z tych warunków (decyzje o odpowiednim stopniu ochrony, EU-US Data Privacy Framework lub standardowe klauzule umowne). Firebase Authentication jest przetwarzane w Stanach Zjednoczonych.',
              '**Cloudflare, Inc.** jako nasz podmiot przetwarzający do dostarczania serwisu i ograniczania dostępu: każde żądanie do myspotter.fit przechodzi przez Cloudflare, który widzi Twój adres IP i metadane żądania. Na podstawie adresu IP Cloudflare ustala przybliżoną lokalizację (kraj i region); używamy jej wyłącznie do ustalenia, czy aplikacja jest dostępna tam, gdzie jesteś, ponieważ z powodów prawnych dostęp jest ograniczony z niektórych krajów i obszarów. Nie zapisujemy tej lokalizacji na Twoim koncie. Cloudflare może przechowywać techniczne logi żądań przez ograniczony czas na podstawie własnych warunków.',
              '**Dostawcy Atlas AI (tylko jeśli włączysz Atlas AI):** Google (Gemini przez Firebase AI Logic) oraz, jeśli na to zezwolisz, Puter (puter.com) przez Twoje własne konto Puter. Zob. punkt 7.',
              '**Usługi miejsc i map**, gdy szukasz siłowni lub otwierasz trasę: Twój tekst wyszukiwania oraz, jeśli zezwolisz na lokalizację, Twoja przybliżona lub dokładna pozycja i adres IP trafiają do usług map i wyszukiwania miejsc używanych przez aplikację (usługi oparte na OpenStreetMap: Photon, Overpass, Nominatim i OSRM, a także kafelki map z OpenStreetMap), logotypy i zdjęcia siłowni z Wikidata i Wikimedia Commons; biblioteka map jest ładowana z unpkg. Te usługi widzą Twój adres IP. Google Places jest odpytywane wyłącznie przez nasz serwer (Cloud Function): do Google trafia tekst wyszukiwania i przybliżona pozycja, ale nie Twój adres IP ani konto, a zdjęcia siłowni z Google wracają również przez nasz serwer. Są używane dopiero po Twojej zgodzie na wyszukiwanie siłowni i mapy, którą możesz wycofać w dowolnym momencie. Foursquare nie jest używany.',
              '**Kod QR zaproszenia:** gdy administrator lub trener pokazuje zaproszenie jako kod QR, link zaproszenia (zawierający token zaproszenia) i jego adres IP są wysyłane do usługi obrazów QR api.qrserver.com (QR Server), która rysuje kod.',
              '**Open Food Facts**, gdy wyszukujesz produkty lub skanujesz kody kreskowe w Żywieniu: Twoja przeglądarka wysyła wyszukiwanie lub kod do ich usługi, a oni widzą Twój adres IP.',
              '**Organy i doradcy**, gdy wymaga tego prawo lub w celu ochrony praw.',
            ],
          },
          {
            p: 'Jeśli zaprosisz kogoś do Spotter, Twoje zdjęcie profilowe może zostać pokazane zaproszonej osobie przed jej rejestracją.',
          },
        ],
      },
      {
        id: 'p6',
        title: 'Dane o zdrowiu i zgoda',
        body: [
          {
            p: 'Niektóre wprowadzane przez Ciebie dane ujawniają stan Twojego zdrowia. Przetwarza je siedem funkcji: urazy, choroby długotrwałe, cykl, nikotyna, alkohol, suplementy i żywienie. Każda prosi o Twoją wyraźną zgodę przed pierwszym użyciem i bez niej pozostaje wyłączona; zgoda jest zapisywana z wersją jej tekstu. Możesz ją cofnąć w każdej chwili w Ustawienia > Twoja prywatność > Zgody; cofnięcie nie wpływa na przetwarzanie przed nim. Limity bezpieczeństwa już zapisane z urazów, chorób długotrwałych i ciąży nadal obowiązują po wyłączeniu funkcji jako ograniczenia treningu, ochrony serii i Cyklu; nigdy nie są pokazywane, udostępniane ani nigdzie wysyłane, a usunięcie wpisów je usuwa. Wyłączenie „Urazów” lub „Żywienia” wyłącza też odpowiednią kategorię udostępniania trenerowi. Sen i pomiary ciała nie mają osobnego kroku zgody. Korzystanie ze Spotter nie wymaga zgody na funkcje, z których nie korzystasz.',
          },
        ],
      },
      {
        id: 'p7',
        title: 'Czat Atlas AI',
        body: [
          {
            p: 'Atlas odpowiada z własnej wbudowanej biblioteki, gdy może, nie wysyłając niczego poza Twoje urządzenie. **Jeśli włączysz „Czat Atlas AI”, Atlas wysyła Twoje pytanie i podsumowanie treningów do dostawcy AI, aby sformułować odpowiedź.**',
          },
          {
            ul: [
              '**Co jest wysyłane (wszystko razem, nie można wybrać części):** Twoje pytanie i ostatnie wiadomości czatu; ostatnie treningi (daty, ćwiczenia, serie, powtórzenia, ciężary) i historia każdego ćwiczenia; Twój plan; Twoje notatki i to, co powiedziałeś(-aś) Atlasowi; inne aktywności; kontuzjowane mięśnie; wpływ chorób długotrwałych na trening (zanonimizowane: nigdy imię, obszar ani notatka); długość snu z ostatniej nocy; masa ciała; dzisiejsza data, dzień tygodnia i Twoja rola. Twoje imię, e-mail, data urodzenia i zdjęcia nie są wysyłane.',
              '**Do kogo:** Google (Gemini API, poziom bezpłatny). W wersji bezpłatnej Google może używać wysłanych danych do ulepszania swoich produktów, a ludzie mogą je czytać. Jeśli osobno zezwolisz, a dzienny bezpłatny limit Google zostanie wyczerpany — Puter, przez **Twoje własne konto Puter** (osobna zgoda).',
              '**Warunki:** żądanie idzie z Twojego urządzenia do dostawcy; nasze serwery nie widzą jego treści. Do tego, co dostawca z nim robi, stosuje się jego własne warunki.',
              '**Twoje wybory:** czat Atlas AI jest wyłączony, dopóki go nie włączysz. Pytamy za każdym razem, gdy go włączasz, wszystko albo nic, a wyłączyć go możesz jednym dotknięciem (ustawienia Atlasa lub „Twoja prywatność > Zgody”); potem nic więcej nie jest wysyłane, a historię czatu można wyczyścić. Domyślnie historia (ostatnie 100 wiadomości) jest przechowywana tylko na Twoim urządzeniu. Jeśli osobno włączysz „Czat Atlas na wszystkich urządzeniach”, jest ona zapisywana także na Twoim koncie, zaszyfrowana tak jak inne Twoje dane (punkt 4), abyś widział(a) ten sam czat wszędzie; nie zmienia to tego, co jest wysyłane do dostawcy AI. Wyłączenie usuwa kopię zgodnie z opisem w punkcie 8. Odpowiedź napisana przez model AI jest oznaczona „Odpowiedź AI”. Odpowiedzi nie są poradą medyczną.',
            ],
          },
        ],
      },
      {
        id: 'p8',
        title: 'Jak długo przechowujemy dane',
        body: [
          {
            ul: [
              '**Konto i dane, które wprowadzasz:** do czasu ich usunięcia lub usunięcia konta.',
              '**Zapisy współpracy z trenerem:** prywatne notatki trenera o Tobie są zapisami trenera i podlegają jego okresowi przechowywania.',
              '**Historia czatu Atlas na Twoim koncie (tylko jeśli ją włączyłeś/-aś):** dopóki przełącznik jest włączony. Po jego wyłączeniu wybierasz: usunąć kopię od razu albo przechowywać ją nieużywaną przez 30 dni (aby można było włączyć ponownie i ją odzyskać), po czym zostaje usunięta automatycznie. Kopia na Twoim urządzeniu pozostaje, dopóki nie wyczyścisz czatu.',
              '**Dziennik „Kto widział Twoje dane”:** 400 dni. **Dziennik działań zespołu:** 90 dni. **Wpisy dziennika przypomnień:** 30 dni.',
              '**Zapisy Twoich zgód** (na co się zgodziłeś(-aś), która wersja, kiedy): do czasu usunięcia konta.',
              '**Zapisy techniczne bez automatycznego terminu:** liczniki prób logowania, dziennik wydawania kluczy, tokeny push, zaplanowane i odrzucone przypomnienia oraz powiadomienia serwisowe nie mają dziś w aplikacji automatycznego terminu, a okresów przechowywania dla nich jeszcze nie ustaliliśmy.',
              '**Kopie zapasowe i usuwanie przez Google:** po usunięciu danych Google kończy ich usuwanie ze swoich systemów w okresie podanym w warunkach Firebase (do 180 dni, chyba że prawo wymaga przechowywania).',
              'Obowiązki prawne mogą wymagać dłuższego przechowywania niektórych zapisów; poinformujemy Cię, których, gdy to nastąpi.',
            ],
          },
        ],
      },
      {
        id: 'p9',
        title: 'Twoje prawa',
        body: [
          {
            p: 'Masz prawo do: informacji; **dostępu** do swoich danych i otrzymania kopii; **sprostowania**; **usunięcia**; **ograniczenia** przetwarzania; **sprzeciwu** wobec przetwarzania opartego na prawnie uzasadnionych interesach; **przenoszenia** danych, które podałeś, w ustrukturyzowanym, powszechnie używanym formacie nadającym się do odczytu maszynowego; **cofnięcia zgody** w każdej chwili. Jak z nich skorzystać:',
          },
          {
            ul: [
              'W aplikacji: **Co Spotter wie o Tobie** (zobacz, co przechowuje aplikacja, pobierz kopię jako ZIP z JSON i CSV, usuń według kategorii, usuń konto), **Prywatność i udostępnianie** (cofnij dostęp trenera), **Atlas AI** (wyłącz).',
              '**Kopia** jest tworzona na Twoim urządzeniu z tego, co aplikacja może tam odczytać i odszyfrować. Nie ma w niej danych przechowywanych tylko na naszych serwerach (na przykład szczegółów profilu, takich jak imię i zdjęcie, prób logowania, passkeys i sesji urządzeń, dziennika wydawania kluczy, powiadomień serwisowych), rozmów, planów i harmonogramów niezaładowanych na urządzeniu oraz prywatnych zapisów Twojego trenera; kopia wymienia je w pliku spisu treści, a możesz o nie poprosić nas na piśmie.',
              '**Usunięcie konta** (w aplikacji, po podaniu hasła) usuwa Twój profil, wprowadzone dane, Twoje relacje z trenerami, passkeys, liczniki logowania, zdjęcie profilowe, nazwę użytkownika i skrót hasła, a następnie Twoje konto logowania. Wpisy, które o Tobie mają inne osoby, pozostają u nich: wpisy dzienników dostępu i udostępniania w ich zapisach, otrzymane przez nie powiadomienia serwisowe oraz do 90 dni wpisów aktywności zespołu, do którego należałeś(-aś). Kopie zapasowe podlegają punktowi 8.',
              'Pisząc do nas na adres z punktu 14. Odpowiadamy w ciągu miesiąca; jeśli wniosek jest złożony lub wniosków jest wiele, możemy przedłużyć ten termin o kolejne dwa miesiące i poinformujemy dlaczego. Możemy poprosić o ponowne zalogowanie, aby potwierdzić Twoją tożsamość; nie prosimy o dokumenty tożsamości, jeśli jesteś już zalogowany.',
              '**Zapisy Twojego trenera o Tobie:** możesz poprosić trenera o dostęp w aplikacji; za te zapisy odpowiada trener.',
              '**Skarga:** możesz złożyć skargę do organu nadzorczego kraju swojego zamieszkania lub pracy albo kraju administratora: **Prezesa Urzędu Ochrony Danych Osobowych (UODO), Polska**.',
            ],
          },
        ],
      },
      {
        id: 'p10',
        title: 'Dzieci',
        body: [
          {
            p: 'Spotter jest przeznaczony dla osób w wieku **18 lat i więcej**. Świadomie nie przetwarzamy danych młodszych dzieci. Jeśli uważasz, że dziecko ma konto, napisz do nas, a je usuniemy.',
          },
        ],
      },
      {
        id: 'p11',
        title: 'Pamięć lokalna i podobne technologie',
        body: [
          {
            p: 'Spotter przechowuje ustawienia, pamięć podręczną offline i zapamiętaną kopię Twojego klucza szyfrowania (bez możliwości eksportu) w Twojej przeglądarce lub aplikacji (local storage i IndexedDB). Są potrzebne, aby aplikacja działała offline i utrzymywała Cię w zalogowaniu; są usuwane po wylogowaniu. Spotter nie ustawia własnych plików cookie i nie używa reklamowych. Czcionki są serwowane z naszego własnego hosta, nie z Google. Google reCAPTCHA Enterprise (App Check) działa przy ładowaniu aplikacji i przy komunikacji z Firebase, aby odróżniać ludzi od botów; odczytuje sygnały z Twojej przeglądarki lub urządzenia, może ustawiać własne pliki cookie, a Google widzi Twój adres IP.',
          },
        ],
      },
      {
        id: 'p12',
        title: 'Transfery międzynarodowe',
        body: [
          {
            p: 'Twoje dane są przetwarzane w Stanach Zjednoczonych i innych krajach, w których działa Google, na podstawie mechanizmów opisanych w punkcie 5.',
          },
        ],
      },
      {
        id: 'p13',
        title: 'Zmiany tej polityki',
        body: [
          {
            p: 'Prowadzimy wersje tej polityki. Istotne zmiany są ogłaszane w aplikacji, zanim wejdą w życie; wersja i data są pokazane na górze i w Ustawieniach. Wcześniejsze wersje są dostępne na żądanie.',
          },
        ],
      },
      {
        id: 'p14',
        title: 'Kontakt',
        body: [{ p: 'Bukowińska 17/1005, Warszawa, Polska' }],
      },
    ],
  },
  terms: {
    title: 'Warunki korzystania ze Spotter',
    sections: [
      {
        id: 't1',
        title: 'Z kim zawierasz te warunki',
        body: [
          {
            p: 'Te warunki dotyczą relacji między Tobą a **Mykola Volodymyrovych Lukianov**, Bukowińska 17/1005, Warszawa, Polska („Spotter”, „my”). Zakładając konto, akceptujesz te warunki i potwierdzasz, że udostępniono Ci naszą Politykę prywatności. Jeśli się nie zgadzasz, nie korzystaj ze Spotter. Polityka prywatności wyjaśnia, jak przetwarzamy dane; nie jest warunkiem umowy ani ogólną zgodą na przetwarzanie. Tam, gdzie prawo wymaga Twojej zgody (na przykład dla danych o zdrowiu lub przetwarzania przez AI), prosimy o nią osobno.',
          },
        ],
      },
      {
        id: 't2',
        title: 'Usługa',
        body: [
          {
            p: 'Spotter to tracker treningowy i aplikacja do współpracy z trenerem. Funkcje mogą być zmieniane, dodawane lub usuwane wyłącznie z powodów podanych w punktach 10 i 13, a o zmianach poinformujemy w sposób tam opisany. Niektóre funkcje wymagają połączenia z internetem; aplikacja jest zaprojektowana tak, by działać offline z późniejszą synchronizacją. Jeśli zostaną wprowadzone funkcje płatne, poinformujemy Cię przed obciążeniem, a te warunki zostaną zaktualizowane.',
          },
        ],
      },
      {
        id: 't3',
        title: 'Kto może korzystać',
        body: [
          {
            p: 'Musisz mieć co najmniej 18 lat, mieć zdolność prawną do zawarcia tej umowy i nie znajdować się w kraju ani regionie, w którym usługa jest niedostępna (zob. punkt 12). Odpowiadasz za to, co dzieje się na Twoim koncie; chroń hasło i urządzenia i poinformuj nas, jeśli podejrzewasz nadużycie.',
          },
        ],
      },
      {
        id: 't4',
        title: 'Konta i trenerzy',
        body: [
          {
            ul: [
              'Konto jest osobiste. Nie udostępniaj go. Trenerzy i członkowie ich zespołów używają własnych kont.',
              '**Trenerzy są niezależni.** Trener, z którym pracujesz, nie jest naszym pracownikiem ani przedstawicielem. Wszelkie ustalenia dotyczące treningu są zawierane między Tobą a trenerem. Zapewniamy narzędzie i nie odpowiadamy za porady trenera, jego wynagrodzenie, postępowanie ani kwalifikacje.',
              'Sam decydujesz, czym dzielisz się z trenerem w aplikacji. Członkowie zespołu trenera otrzymują tylko taki dostęp, jaki aplikacja przyznaje dla ich roli.',
            ],
          },
        ],
      },
      {
        id: 't5',
        title: 'Zdrowie i bezpieczeństwo',
        body: [
          {
            p: 'Spotter, w tym Atlas, podaje ogólne informacje o fitnessie, **a nie porady medyczne**, i nie diagnozuje, nie leczy ani nie zapobiega żadnemu schorzeniu. Ćwiczenia wiążą się z ryzykiem. Przed rozpoczęciem lub zmianą programu skonsultuj się z wykwalifikowanym specjalistą, zwłaszcza jeśli masz uraz lub chorobę, jesteś w ciąży lub przyjmujesz leki. Przerwij, jeśli poczujesz ból, zawroty głowy lub złe samopoczucie. Odpowiedzi Atlas, w tym odpowiedzi wspierane przez AI, mogą być błędne; kieruj się własnym osądem.',
          },
        ],
      },
      {
        id: 't6',
        title: 'Twoje treści',
        body: [
          {
            p: 'Zachowujesz prawa własności do tego, co wprowadzasz. Udzielasz nam ograniczonej licencji na przechowywanie, przetwarzanie i wyświetlanie tych treści wyłącznie w zakresie potrzebnym do świadczenia usługi Tobie i osobom, którym postanowisz je udostępnić. Odpowiadasz za swoje treści i musisz mieć prawo je wprowadzać (na przykład nie wprowadzaj prywatnych danych innej osoby bez pozwolenia).',
          },
        ],
      },
      {
        id: 't7',
        title: 'Dopuszczalne korzystanie',
        body: [
          {
            p: 'Nie wolno: łamać prawa; nękać innych ani podszywać się pod nich; wgrywać złośliwego oprogramowania ani nadużywać zasobów usługi; próbować uzyskać dostępu do cudzych kont lub danych, sondować, scrapować ani dokonywać inżynierii wstecznej usługi ponad to, na co pozwala prawo; obchodzić zabezpieczeń, limitów ani ograniczeń regionalnych; używać usługi do udzielania nielicencjonowanej pomocy medycznej. Możemy zawiesić lub zakończyć konta naruszające te warunki i wyjaśnimy dlaczego, chyba że prawo nam tego zabrania.',
          },
        ],
      },
      {
        id: 't8',
        title: 'Usługi stron trzecich i AI',
        body: [
          {
            p: 'Niektóre funkcje korzystają ze stron trzecich (zob. Politykę prywatności). Czat Atlas AI jest opcjonalny i działa dopiero po Twojej zgodzie, którą wyrażasz za każdym razem, gdy go włączasz. Odpowiedzi AI generuje model strony trzeciej i nie gwarantujemy ich dokładności.',
          },
        ],
      },
      {
        id: 't9',
        title: 'Nasza własność intelektualna',
        body: [
          {
            p: 'Oprogramowanie, projekt, teksty, katalog ćwiczeń i marka Spotter należą do nas lub naszych licencjodawców. Możesz z nich korzystać, aby używać usługi dla siebie; nie przyznajemy żadnych innych praw. Komponenty open source stron trzecich pozostają na swoich licencjach.',
          },
        ],
      },
      {
        id: 't10',
        title: 'Dostępność, zmiany i zakończenie',
        body: [
          {
            p: 'Dążymy do tego, by Spotter był dostępny, ale nie obiecujemy nieprzerwanego działania. Możemy zmieniać lub wycofywać funkcje; jeśli zmiana znacząco ogranicza to, za co zapłaciłeś lub na czym polegałeś, damy rozsądne wypowiedzenie. W każdej chwili możesz przestać korzystać ze Spotter i usunąć konto w aplikacji; Twoje dane usuwamy tak, jak opisano w Polityce prywatności. Możemy zakończyć usługę dla Ciebie, jeśli istotnie naruszysz te warunki lub jeśli wymaga tego prawo; poinformujemy Cię i, jeśli to możliwe, pozwolimy najpierw wyeksportować dane.',
          },
        ],
      },
      {
        id: 't11',
        title: 'Zastrzeżenia i odpowiedzialność',
        body: [
          {
            p: 'Usługa jest świadczona „w stanie, w jakim jest” w zakresie dozwolonym prawem. Nie odpowiadamy za szkody pośrednie ani następcze, uraz lub szkodę wynikającą z Twoich wyborów dotyczących ćwiczeń lub treningu ani za działania trenerów. **Nic w tych warunkach nie ogranicza odpowiedzialności, której prawo nie pozwala ograniczyć (w tym za śmierć lub uszczerbek na zdrowiu spowodowane niedbalstwem, oszustwo lub umyślne uchybienie), ani Twoich praw konsumenta wynikających z przepisów bezwzględnie obowiązujących.**',
          },
        ],
      },
      {
        id: 't12',
        title: 'Dostępność według regionów',
        body: [
          {
            p: 'Spotter nie jest oferowany w każdym kraju ani regionie. Możemy ograniczać dostęp na podstawie lokalizacji sieciowej. Korzystając ze Spotter, potwierdzasz, że nie znajdujesz się w miejscu, w którym usługa jest niedostępna. Próby obejścia ograniczenia są naruszeniem tych warunków.',
          },
        ],
      },
      {
        id: 't13',
        title: 'Wymagania techniczne, zawarcie umowy, reklamacje',
        body: [
          {
            ul: [
              '**Wymagania techniczne:** aktualna przeglądarka z włączonymi JavaScript, local storage i IndexedDB oraz połączenie z internetem do logowania i synchronizacji.',
              '**Zawarcie umowy:** umowa zostaje zawarta, gdy zakończysz rejestrację i potwierdzisz zgodę na te warunki. Możesz zapoznać się z tymi warunkami przed rejestracją oraz pobrać lub zapisać je w dowolnym momencie.',
              '**Zakończenie umowy:** możesz w każdej chwili usunąć konto. My możemy ją zakończyć tylko z powodów i z wypowiedzeniem określonymi w punkcie 10.',
              '**Zmiany usługi:** możemy zmienić funkcję z ważnego powodu wskazanego tutaj (bezpieczeństwo, wymóg prawny, usunięcie wady, zmiana lub zakończenie usługi strony trzeciej, od której zależymy, ulepszenie usługi bez pogorszenia jej dla Ciebie). Informujemy jasno i z wyprzedzeniem; jeśli zmiana istotnie i negatywnie wpływa na Twoje korzystanie, możesz zakończyć umowę w ciągu 30 dni i nie obciążymy Cię z tego tytułu.',
              '**Reklamacje:** napisz do nas na adres z punktu 16. Potwierdzamy otrzymanie reklamacji i odpowiadamy w języku usługi, z której korzystasz, wskazując decyzję i jej uzasadnienie.',
              '**Treści niezgodne z prawem:** nie wolno wgrywać treści niezgodnych z prawem (zob. punkt 7).',
            ],
          },
        ],
      },
      {
        id: 't14',
        title: 'Zmiany warunków',
        body: [
          {
            p: 'Możemy aktualizować te warunki. Istotne zmiany są ogłaszane w aplikacji wraz z nową wersją i datą, zanim wejdą w życie; jeśli się nie zgadzasz, możesz przestać korzystać ze Spotter i usunąć konto. Dalsze korzystanie po dacie wejścia w życie oznacza akceptację.',
          },
        ],
      },
      {
        id: 't15',
        title: 'Prawo właściwe i spory',
        body: [
          {
            p: 'Te warunki podlegają **prawu polskiemu**, bez pozbawiania Cię bezwzględnie obowiązujących zasad ochrony konsumenta kraju Twojego zamieszkania. Sądy: **właściwe sądy w Polsce**; konsumenci mogą także korzystać z sądów swojego miejsca zamieszkania, jeśli prawo daje takie uprawnienie.',
          },
        ],
      },
      {
        id: 't16',
        title: 'Kontakt',
        body: [{ p: 'Bukowińska 17/1005, Warszawa, Polska' }],
      },
    ],
  },
};
