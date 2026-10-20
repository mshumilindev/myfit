/** Coach komandos tekstai (lietuvių). Žr. `coachTeam.en.ts`. Reikia gimtakalbio peržiūros. */
import type { teamEn } from './coachTeam.en';
import { plural } from './coachPlural';

const peopleN = (n: number) =>
  plural('lt', n, {
    one: '{n} žmogus',
    few: '{n} žmonės',
    many: '{n} žmonės',
    other: '{n} žmonių',
  });
const daysAgo = (n: number) =>
  plural('lt', n, {
    one: 'prieš {n} dieną',
    few: 'prieš {n} dienas',
    many: 'prieš {n} dienos',
    other: 'prieš {n} dienų',
  });

export const teamLt: typeof teamEn = {
  tmTitle: 'Komanda',
  tmSubTrainer: (n) => `${peopleN(n)}. Jūs pridedate vadybininkus, vadybininkas prideda trenerius.`,
  tmSubManager: (n) =>
    `${peopleN(n)}. Jūs pridedate trenerius. Vadybininką gali pašalinti tik treneris.`,
  tmAddManager: 'Pridėti vadybininką',
  tmAddTrainer: 'Pridėti trenerį',
  tmMembers: 'Nariai',
  tmPending: 'Laukiantys kvietimai',
  tmYou: 'Jūs',
  tmRoleTrainer: 'Treneris',
  tmRoleManager: 'Vadybininkas',
  tmPendingTag: 'Laukia',
  tmRevoke: 'Atšaukti',
  tmRevokeFor: (email) => `Atšaukti kvietimą: ${email}`,
  tmActiveNow: 'Aktyvus dabar',
  tmLastActive: (when) => `Paskutinį kartą aktyvus: ${when}`,
  tmAdded: (date) => `Pridėta ${date}`,
  tmWhenToday: 'šiandien',
  tmWhenYesterday: 'vakar',
  tmInviteSent: (role, ago) => `${role}: kvietimas išsiųstas ${ago}`,
  tmAgoToday: 'šiandien',
  tmAgoYesterday: 'vakar',
  tmAgoDays: (n) => daysAgo(n),
  tmActivityLog: 'Veiklos žurnalas',
  tmActivityLogSub: 'Kas ką padarė, pagal dienas',
  tmRoles: 'Ką gali kiekvienas vaidmuo',
  tmRolesSub: 'Fiksuota prieiga, vienoda visiems',
  tmLeave: 'Palikti komandą',
  tmLeaveNoteTrainer:
    'Vadybininkai neteks prieigos prie jūsų klientų. Jūsų klientai ir duomenys lieka pas jus.',
  tmLeaveNoteManager: 'Klientai ir duomenys lieka kaip buvę. Jus galima pakviesti vėl.',
  tmOpenMember: (name) => `Atidaryti: ${name}`,
  tmMembersLabel: 'Komandos nariai',
  tmPendingLabel: 'Laukiantys kvietimai',

  tmAddManagerTitle: 'Pridėti vadybininką',
  tmAddManagerBody:
    'Vadybininkas tvarko jūsų tvarkaraštį ir klientų sąrašą. Jis nemato treniruočių, sveikatos, mitybos, užrašų ar pokalbių ir negali pridėti kitų vadybininkų.',
  tmAddTrainerTitle: 'Pridėti trenerį',
  tmAddTrainerBody:
    'Treneris dirba su savo klientais. Jis prisijungia prie jūsų valdomos komandos ir atsiranda jūsų Klientuose ir Tvarkaraštyje.',
  tmEmail: 'El. paštas',
  tmEmailHint:
    'Asmuo gaus kvietimo nuorodą el. paštu. Ji galioja 7 dienas ir vienam asmeniui. Prieiga prasideda priėmus.',
  tmSendInvite: 'Siųsti kvietimą',
  tmCancel: 'Atšaukti',
  tmErrInvalidEmail: 'Įveskite galiojantį el. pašto adresą.',
  tmErrExists: 'Šis asmuo jau komandoje arba turi atvirą kvietimą.',
  tmErrOffline: 'Nėra ryšio. Bandykite vėl, kai prisijungsite.',
  tmErrGeneric: 'Nepavyko išsiųsti kvietimo. Bandykite dar kartą.',
  tmInviteSentSnack: (email) => `Kvietimas išsiųstas: ${email}`,
  tmLinkTitle: 'Pasidalinkite kvietimo nuoroda',
  tmLinkBody: (email) => `Nusiųskite šią nuorodą: ${email}. Ji vienkartinė ir galioja 7 dienas.`,
  tmCopyLink: 'Kopijuoti nuorodą',
  tmLinkCopied: 'Nuoroda nukopijuota',
  tmDone: 'Atlikta',

  tmMemberTitle: 'Komandos narys',
  tmRole: 'Vaidmuo',
  tmEmailRow: 'El. paštas',
  tmAddedRow: 'Pridėta',
  tmLastActiveRow: 'Paskutinė veikla',
  tmScheduleAccess: 'Prieiga prie tvarkaraščio',
  tmScheduleReady: (ready, total) => `Paruošta ${ready} iš ${total} klientų`,
  tmPermissions: 'Leidimai',
  tmSeeAll: 'Matyti visą komandos veiklą',
  tmSeeAllOff: (name) =>
    `Išjungta: ${name} žurnale mato tik savo veiksmus. Įjungta: ${name} mato visų trenerių ir vadybininkų veiksmus.`,
  tmRemoveFromTeam: 'Pašalinti iš komandos',
  tmRemoveNote: (name) => `${name} iškart netenka prieigos. Ankstesni veiksmai lieka žurnale.`,
  tmClose: 'Uždaryti',

  tmRemoveTitle: (name) => `Pašalinti ${name} iš komandos?`,
  tmRemoveBody: (name) => `${name} neteks prieigos prie jūsų klientų ir tvarkaraščio.`,
  tmRemoveEffect1: 'Prieiga baigiasi iškart visuose įrenginiuose.',
  tmRemoveEffect2: (name) => `Sesijų raktai atnaujinami, kad ${name} neperskaitytų naujų duomenų.`,
  tmRemoveEffect3: 'Ankstesni veiksmai lieka veiklos žurnale.',
  tmRemoveKeep: (name) => `Palikti: ${name}`,
  tmRemoveConfirm: 'Pašalinti',
  tmLeaveManagerTitle: (owner) => `Palikti komandą: ${owner}?`,
  tmLeaveManagerBody: 'Neteksite prieigos prie tvarkaraščio ir klientų.',
  tmLeaveManagerEffect1: 'Klientai ir sesijos lieka pas savo trenerius.',
  tmLeaveManagerEffect2: 'Treneris gali pakviesti jus vėl.',
  tmLeaveManagerEffect3: 'Jūsų ankstesni veiksmai lieka veiklos žurnale.',
  tmLeaveStay: 'Pasilikti',
  tmLeaveConfirm: 'Palikti komandą',
  tmLeaveTrainerTitle: 'Palikti komandą?',
  tmLeaveTrainerBody: 'Vadybininkai neteks prieigos prie jūsų klientų.',
  tmLeaveTrainerEffect1: 'Jūsų klientai ir duomenys lieka pas jus.',
  tmLeaveTrainerEffect2: 'Jūsų klientų sesijų raktai atnaujinami.',
  tmLeaveTrainerEffect3: 'Jus galima pakviesti vėl.',

  tmLoadFailed: 'Nepavyko įkelti komandos.',
  tmRetry: 'Bandyti dar kartą',
  tmOfflineStale: 'Nėra ryšio. Rodoma paskutinė išsaugota komanda.',
  tmEmptyMembers: 'Kol kas tik jūs.',
  tmEmptyInvites: 'Atvirų kvietimų nėra.',
};
