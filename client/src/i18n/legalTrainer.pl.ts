import type { LegalTrainerTexts } from './legalTrainer.types';

/**
 * Maszynowa WERSJA ROBOCZA polskiego tłumaczenia Trainer Terms i DPA (SPO-289). Tekst kanoniczny jest angielski (legalTrainer.en.ts).
 * Wymaga sprawdzenia przez native speakera i prawnika przed wydaniem (`TRANSLATION_REVIEW` w legal/pending.ts). Znaczniki identyczne jak w angielskim.
 */
export const legalTrainerPl: LegalTrainerTexts = {
  draftNote:
    'WERSJA ROBOCZA. Tekst nie został sprawdzony przez prawnika i nie jest ostateczny. Punkty w podwójnych nawiasach są otwarte i trzeba je zamknąć przed wydaniem.',
  trainerTerms: {
    title: 'Warunki dla trenerów Spotter (WERSJA ROBOCZA)',
    sections: [
      {
        id: 'tt1',
        title: 'Czym są te warunki',
        body: [
          {
            p: 'Te Warunki dla trenerów dotyczą Ciebie, gdy korzystasz z funkcji trenerskich Spottera jako trener, administrator lub menedżer zespołu. Uzupełniają Regulamin i Politykę prywatności Spottera. Umowa powierzenia przetwarzania danych (DPA) to osobny dokument, który również akceptujesz; dotyczy danych klientów, które Spotter przetwarza w Twoim imieniu.',
          },
          {
            p: 'Musisz mieć ukończone 18 lat i używać Spottera do treningu zgodnie z prawem i profesjonalnie. Jeśli prowadzisz treningi zawodowo, potwierdzasz, że masz do tego prawo tam, gdzie pracujesz.',
          },
        ],
      },
      {
        id: 'tt2',
        title: 'Role: Ty, Twój klient i Spotter',
        body: [
          {
            ul: [
              '**Własne dane klienta** (treningi, sen, wskaźniki ciała, odżywianie itd.) należą do klienta. Administratorem tych danych jest Spotter, jak wyjaśnia Polityka prywatności. Widzisz je tylko w kategoriach, którymi klient się z Tobą podzielił.',
              '**To, co zapisujesz o kliencie** na potrzeby treningu (prywatne notatki, decyzje, plany, harmonogramy, wiadomości), ustalasz Ty: co zapisywać, po co i jak długo. W przypadku prywatnych notatek jesteś prawdopodobnie odrębnym administratorem. Odpowiadasz za zgodność tego przetwarzania z prawem.',
              '**Spotter dostarcza narzędzie.** W przypadku danych klientów, które wprowadzasz do Spottera, Spotter działa jako Twój podmiot przetwarzający na podstawie DPA.',
              '**Ten podział jest roboczym opisem, a nie ostateczną oceną prawną.** {{ЮРИСТ:tt-roles-matrix}}',
            ],
          },
        ],
      },
      {
        id: 'tt3',
        title: 'Podstawa prawna i zgoda Twojego klienta',
        body: [
          {
            p: 'Zanim zapiszesz dane osobowe klienta, potrzebujesz podstawy prawnej, a w przypadku informacji o zdrowiu wyraźnej zgody lub innej ważnej podstawy. Odpowiadasz za poinformowanie klientów, co zapisujesz i po co.',
          },
          {
            p: 'W Spotterze klient sam decyduje, co możesz zobaczyć: udostępnianie zaczyna się dopiero, gdy klient je zaakceptuje na stronie Udostępnianie, obejmuje tylko wybrane przez niego kategorie i można je wyłączyć w każdej chwili. Spotter pokazuje klientowi, kto widział jego dane. Nie wolno Ci próbować obchodzić tych granic.',
          },
          {
            p: 'W odniesieniu do osoby, która nie ma jeszcze konta w Spotterze (na przykład zaproszonej przez Ciebie): zapisuj tylko to, co jest potrzebne do zaproszenia. {{ЮРИСТ:tt-no-account-person}}',
          },
        ],
      },
      {
        id: 'tt4',
        title: 'Twoje prywatne notatki i decyzje',
        body: [
          {
            p: 'Prywatne notatki i decyzje o kliencie są przechowywane w postaci zaszyfrowanej i widoczne tylko dla Ciebie. Klient nie może ich przeczytać w Spotterze. Klient, który prosi o kopię Twoich zapisów, zwraca się do Ciebie, bo to Ty za nie odpowiadasz.',
          },
          {
            p: 'Klucze do przechowywanych danych wydaje serwer Spottera. To szyfrowanie przechowywanych danych, a nie szyfrowanie end-to-end. {{ПОТРІБНО:tt-key-access}}',
          },
          {
            p: '**Starsze notatki.** Notatki napisane we wcześniejszej wersji Spottera (starsze notatki trenera) są przechowywane osobno i nie ma potwierdzenia, że są zaszyfrowane. Traktuj je jako dostępne dla systemów Spottera i dla klienta, którego dotyczą; może je przeczytać na swoim koncie.',
          },
        ],
      },
      {
        id: 'tt5',
        title: 'Dane klienta, do których masz dostęp przez udostępnianie',
        body: [
          {
            ul: [
              'Dostęp do danych klienta uzyskujesz przez udostępnianie, które klient przyznał (klucz dla wybranych przez niego kategorii). Bez niego nic nie widzisz; aplikacja pokazuje, że brakuje dostępu, a nie pustą stronę.',
              'Informacje o zdrowiu są udostępniane tylko wtedy, gdy klient zgodził się na tę kategorię. Używaj ich wyłącznie do treningu tego klienta.',
              'Gdy otwierasz ekran klienta, w dzienniku widocznym dla klienta („Kto widział Twoje dane”) zapisywany jest wpis dla danej kategorii. Niektóre odczyty przez funkcje serwerowe też są zapisywane; odczyt listy klientów lub przypisania nie jest zapisywany.',
              'Nie wolno Ci kopiować danych klientów ze Spottera, publikować ich ani używać do innego celu, na przykład marketingu.',
            ],
          },
        ],
      },
      {
        id: 'tt6',
        title: 'Twój zespół i menedżerowie',
        body: [
          {
            p: 'Trener może dodawać członków zespołu, na przykład menedżera. Menedżer działa w imieniu trenera i widzi tylko to, co trener mu powierzył i na co aplikacja pozwala w tej roli (harmonogram, listę klientów i zespół). Twoi klienci widzą, kto jest w Twoim zespole.',
          },
          {
            p: 'Odpowiadasz za osoby, które dodajesz: wybieraj je ostrożnie, usuwaj, gdy dostęp nie jest już potrzebny, i dbaj, by przestrzegały tych warunków. Menedżer korzystający z funkcji trenerskich również akceptuje te Warunki dla trenerów i DPA. {{ЗАЛЕЖИТЬ:tt-manager-scope}}',
          },
        ],
      },
      {
        id: 'tt7',
        title: 'Poufność i bezpieczeństwo',
        body: [
          {
            ul: [
              'Zachowuj w tajemnicy to, czego dowiadujesz się o klientach, także po zakończeniu treningów.',
              'Chroń konto: nie udostępniaj logowania, używaj urządzenia, które kontrolujesz, i wylogowuj się na wspólnych urządzeniach.',
              'Niezwłocznie powiadom Spottera, jeśli podejrzewasz, że konto, urządzenie lub dane klientów zostały ujawnione. Kroki powiadomienia opisuje DPA.',
            ],
          },
        ],
      },
      {
        id: 'tt8',
        title: 'Gdy współpraca się kończy',
        body: [
          {
            p: 'Gdy klient przestaje udostępniać, kończy powiązanie lub usuwa konto, Twój dostęp do jego danych się kończy. Klient zachowuje własną historię, a Twój dostęp do niej nie jest do tego potrzebny. O tym, co zrobić z Twoimi własnymi zapisami o kliencie (prywatne notatki, decyzje, napisane przez Ciebie plany), decydujesz Ty: wyeksportuj je lub usuń i nie przechowuj dłużej, niż potrzeba. {{ПОТРІБНО:tt-retention}}',
          },
          {
            p: 'Klient traci dostęp do Twoich prywatnych notatek, gdy powiązanie się kończy, ponieważ nigdy nie miał do nich dostępu w Spotterze.',
          },
        ],
      },
      {
        id: 'tt9',
        title: 'Zawieszenie',
        body: [
          {
            p: 'Spotter może zawiesić konto trenera, na przykład za naruszenie tych warunków lub prawa albo w celu ochrony klientów. Zawieszenie trenera nigdy nie odbiera klientowi jego własnej historii. {{ЮРИСТ:tt-suspension}}',
          },
        ],
      },
      {
        id: 'tt10',
        title: 'Odpowiedzialność',
        body: [{ p: '{{ЮРИСТ:tt-liability}}' }],
      },
      {
        id: 'tt11',
        title: 'Zmiany i prawo właściwe',
        body: [
          {
            p: 'Gdy te warunki zmieniają się w istotny sposób, zostaniesz poproszony o przeczytanie i zaakceptowanie nowej wersji, zanim przejdziesz do funkcji dotyczących klientów. {{ЮРИСТ:tt-governing-law}}',
          },
        ],
      },
    ],
  },
  dpa: {
    title: 'Umowa powierzenia przetwarzania danych Spotter (WERSJA ROBOCZA)',
    sections: [
      {
        id: 'dp1',
        title: 'Strony i zakres',
        body: [
          {
            p: 'Umowa jest zawierana między Tobą, trenerem (administratorem zapisów o klientach, o których decydujesz), a Spotterem, operatorem wskazanym w Polityce prywatności (podmiotem przetwarzającym). Dotyczy danych osobowych Twoich klientów, które wprowadzasz do Spottera lub tworzysz w nim na potrzeby treningu, i jest częścią Warunków dla trenerów. {{ПОТРІБНО:dp-parties}}',
          },
          {
            p: 'Nie dotyczy danych, które osoba wprowadza o sobie, korzystając ze Spottera samodzielnie: dla nich administratorem jest Spotter (zob. Polityka prywatności).',
          },
        ],
      },
      {
        id: 'dp2',
        title: 'Przedmiot i czas trwania',
        body: [
          {
            p: 'Spotter przechowuje i przekazuje dane klientów, które wprowadzasz, aby umożliwić Ci prowadzenie klientów za pomocą aplikacji. Umowa trwa, dopóki istnieje Twoje konto trenera, oraz dopóki Spotter po tym czasie przechowuje Twoje zapisy o klientach, aż zostaną usunięte lub zwrócone. {{ПОТРІБНО:dp-duration}}',
          },
        ],
      },
      {
        id: 'dp3',
        title: 'Charakter, cel, dane i osoby, których dotyczą',
        body: [
          {
            table: {
              head: ['Dane', 'Osoby', 'Cel'],
              rows: [
                [
                  'Prywatne notatki i decyzje o kliencie (zaszyfrowane)',
                  'Twoi klienci',
                  'Zapisy trenerskie',
                ],
                [
                  'Plany, harmonogramy, sesje na żywo i wiadomości czatu z klientem',
                  'Twoi klienci',
                  'Prowadzenie treningu',
                ],
                [
                  'Skład zespołu, delegowanie uprawnień i dziennik aktywności zespołu',
                  'Ty i członkowie Twojego zespołu',
                  'Prowadzenie zespołu',
                ],
                [
                  'Dane klienta, które czytasz przez udostępnianie (kategorie wybrane przez klienta, w tym informacje o zdrowiu, jeśli klient się zgodził)',
                  'Twoi klienci',
                  'Trening tego klienta',
                ],
              ],
            },
          },
          {
            p: 'Przetwarzanie polega na przechowywaniu, szyfrowaniu, przekazywaniu, pokazywaniu i usuwaniu tych danych.',
          },
        ],
      },
      {
        id: 'dp4',
        title: 'Twoje polecenia',
        body: [
          {
            p: 'Spotter przetwarza te dane tylko na Twoje udokumentowane polecenia: korzystanie z aplikacji i wybrane przez Ciebie ustawienia są Twoimi poleceniami, podobnie jak Warunki dla trenerów i ta DPA. Jeśli Spotter uzna, że polecenie narusza prawo o ochronie danych, poinformuje Cię. Spotter może też przetwarzać dane, gdy wymaga tego prawo, i najpierw Cię o tym informuje, chyba że prawo tego zabrania.',
          },
        ],
      },
      {
        id: 'dp5',
        title: 'Poufność',
        body: [
          {
            p: 'Osoby w Spotterze, które mogą mieć dostęp do tych danych, są zobowiązane do poufności i mogą używać ich tylko do działania usługi dla Ciebie. {{ПОТРІБНО:dp-staff-access}}',
          },
        ],
      },
      {
        id: 'dp6',
        title: 'Środki bezpieczeństwa',
        body: [
          {
            ul: [
              'Dane wprowadzane przez użytkowników są przechowywane w postaci zaszyfrowanej. Klucze wydaje serwer Spottera, więc to szyfrowanie przechowywanych danych, a nie szyfrowanie end-to-end.',
              'Dostęp do danych klienta wymuszają reguły bazy danych i funkcje serwerowe, nie tylko ekran: zaszyfrowane dane klienta są dostępne tylko przez jego zgodę na udostępnianie; starsze odczyty po stronie serwera są sprawdzane na serwerze (dostęp do profilu i zgoda klienta na serie); listę klientów czytasz przez swoje powiązanie z trenerem.',
              'Logowanie korzysta z kont z obsługą passkey. Otwarcie ekranu klienta jest zapisywane dla danej kategorii w dzienniku widocznym dla klienta; niektóre odczyty po stronie serwera są zapisywane, odczyty listy klientów i przypisań nie.',
              'Spotter przegląda te środki, gdy zmienia się produkt. {{ЮРИСТ:dp-security-annex}}',
            ],
          },
        ],
      },
      {
        id: 'dp7',
        title: 'Podmioty podprzetwarzające',
        body: [
          {
            p: 'Zezwalasz Spotterowi korzystać z poniższych podmiotów podprzetwarzających. Lista odpowiada rejestrowi podmiotów przetwarzających Spottera i jest aktualizowana, gdy się zmienia. {{ЮРИСТ:dp-subprocessor-authorisation}}',
          },
          {
            table: {
              head: ['Podmiot podprzetwarzający', 'Czym się zajmuje', 'Stan'],
              rows: [
                [
                  'Google (Firebase: Authentication, Firestore, Cloud Functions, Storage, Hosting, wiadomości)',
                  'Wszystkie dane przechowywane na serwerze, w tym zapisy o klientach, oraz dane techniczne żądań',
                  'Warunki i region do potwierdzenia {{ПОТРІБНО:dp-google-terms}}',
                ],
                [
                  'Google (reCAPTCHA Enterprise / App Check)',
                  'Sygnały przeglądarki i urządzenia do odróżniania ludzi od botów, adres IP',
                  'Podstawa prawna do potwierdzenia {{ЮРИСТ:dp-recaptcha}}',
                ],
                [
                  'QR Server (api.qrserver.com)',
                  'Rysuje kod QR zaproszenia: otrzymuje pełny link zaproszenia, który zawiera token zaproszenia, oraz adres IP przeglądarki',
                  'Podstawa prawna do potwierdzenia {{ЮРИСТ:dp-qrserver}}',
                ],
              ],
            },
          },
          {
            p: 'Inne usługi z rejestru (mapy, baza produktów, Atlas AI) są używane tylko wtedy, gdy osoba włączy je na własny użytek. To, co każdy z nich otrzymuje, opisano w rejestrze; czy zapis o kliencie, który wprowadzasz, może do któregoś trafić, jest jeszcze sprawdzane. {{ПОТРІБНО:dp-other-processors-check}}',
          },
        ],
      },
      {
        id: 'dp8',
        title: 'Przekazywanie poza UE/EOG',
        body: [
          {
            p: 'Niektóre podmioty podprzetwarzające mogą przetwarzać dane poza UE/EOG. Mechanizm przekazania (decyzja o odpowiednim stopniu ochrony, standardowe klauzule umowne) i ocena nie są jeszcze udokumentowane. {{ЮРИСТ:dp-transfers}}',
          },
        ],
      },
      {
        id: 'dp9',
        title: 'Pomoc w realizacji praw osób',
        body: [
          {
            p: 'Spotter udostępnia klientom ich własne dane i pozwala przerwać udostępnianie. Żądanie dotyczące Twoich prywatnych zapisów trafia do Ciebie, ponieważ Spotter nie może przekazać ich w czytelnej postaci w imieniu klienta. Spotter pomaga Ci przy takich żądaniach w zakresie, na jaki pozwala produkt, i przekazuje żądania, które otrzymuje, a dotyczą Twoich zapisów. {{ЮРИСТ:dp-dsar-assistance}}',
          },
        ],
      },
      {
        id: 'dp10',
        title: 'Naruszenia ochrony danych osobowych',
        body: [
          {
            p: 'Spotter informuje Cię bez zbędnej zwłoki po stwierdzeniu naruszenia dotyczącego danych Twoich klientów, podając to, co wie o naruszeniu, jego prawdopodobne skutki i podjęte działania. Ty decydujesz, czy powiadomić organ nadzorczy i osoby, których to dotyczy, a Spotter pomaga faktami, których potrzebujesz. Termin, w którym Spotter Cię informuje, nie jest jeszcze ustalony. {{ЮРИСТ:dp-breach-period}}',
          },
        ],
      },
      {
        id: 'dp11',
        title: 'Usunięcie i zwrot',
        body: [
          {
            p: 'Gdy umowa się kończy, lub wcześniej na Twoje żądanie, Spotter usuwa Twoje zapisy o klientach albo zwraca je Tobie, zgodnie z Twoim wyborem, chyba że prawo wymaga ich przechowywania. Usunięcie konta usuwa Twoje zapisy trenerskie. Format i termin zwrotu danych nie są jeszcze ustalone. {{ПОТРІБНО:dp-return-format}}',
          },
        ],
      },
      {
        id: 'dp12',
        title: 'Audyt',
        body: [
          {
            p: 'Spotter udostępnia Ci informacje potrzebne do wykazania zgodności z tą umową i dopuszcza audyty w rozsądnych granicach. {{ЮРИСТ:dp-audit}}',
          },
        ],
      },
      {
        id: 'dp13',
        title: 'Odpowiedzialność i prawo właściwe',
        body: [{ p: '{{ЮРИСТ:dp-liability}}' }],
      },
    ],
  },
};
