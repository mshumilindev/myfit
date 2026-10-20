/**
 * Coach Agenda (file: today) + Decision strings (English, the base). Mirrored in uk / pl / lt / et with the
 * `typeof todayEn` type, so a missing key is a type error. Kept apart from `coach.*` (the shell
 * dictionary) so the two Coach screens being built in parallel never edit the same file.
 */
import { plural } from './coachPlural';

const P = (n: number, one: string, other: string) => plural('en', n, { one, other });

export const todayEn = {
  // Header and views
  queueTitle: 'Agenda',
  queueLoading: 'Loading',
  needDecision: (n: number) => P(n, '{n} needs a decision', '{n} need a decision'),
  requestsToAnswer: (n: number) => P(n, '{n} request to answer', '{n} requests to answer'),
  byPriority: 'By priority',
  byStage: 'By stage',
  viewLabel: 'View',
  allSignals: 'All signals',
  allDecisions: 'All decisions',
  liveCount: (n: number) => `${n} live`,

  // Sections
  sectionRequests: 'Reschedule requests',
  sectionNeeds: 'Needs a decision',
  sectionWatch: 'Keep an eye on',
  moreInDigest: (n: number) => `${n} more in the digest`,
  hideDigest: 'Hide the digest items',
  digestNote: 'The digest is the morning summary of everything that is not shown here.',

  // Stage board
  stageSignal: 'Signal',
  stageEvidence: 'Evidence',
  stageDecided: 'Decided',
  stageMeasuring: 'Measuring',
  stageResult: 'Result',
  stageBoard: 'Stage board, scroll for more',
  stageFold: (l: string, folded: boolean) => (folded ? `Show ${l}` : `Hide ${l}`),
  stageEmpty: 'Nothing here',
  stageOpen: (name: string, stage: string) => `${name}, ${stage}`,
  boardSummary: (
    improved: number,
    total: number,
    pct: number,
    measuring: number,
    kg: string,
    days: number,
  ) =>
    `${improved} of ${total} decisions improved (${pct}%), ${measuring} still measuring. Improved means the lift moved up by at least ${kg} kg of estimated 1RM, or the client got back to the plan, within ${days} days.`,
  close: 'Close',
  drawerTitle: 'Decision',

  // Severity and result words (text, never colour only)
  urgent: 'Urgent',
  watch: 'Watch',
  good: 'Good',
  decided: 'Decided',
  waiting: 'Waiting',
  measuring: 'Measuring',
  improved: 'Improved',
  noChange: 'No clear change',
  declined: 'Declined',
  confidence: (level: 'high' | 'medium' | 'low'): string =>
    level === 'high'
      ? 'Confidence High'
      : level === 'medium'
        ? 'Confidence Medium'
        : 'Confidence Low',
  tagNew: 'New',

  // Reschedule request card
  askMove: (name: string) => `${name} asks to move a session`,
  waitingFor: (name: string) => `Waiting for ${name}`,
  askedMove: (manager: string, name: string) => `${manager} asked ${name} to move a session`,
  needsAnswer: 'Needs your answer',
  moveFrom: 'From',
  moveTo: 'To',
  accept: 'Accept',
  decline: 'Decline',
  proposeAnother: 'Propose another',
  cancelRequest: 'Cancel request',
  acceptFor: (name: string) => `Accept move for ${name}`,
  declineFor: (name: string) => `Decline move for ${name}`,
  proposeFor: (name: string) => `Propose another time to ${name}`,
  cancelFor: (name: string) => `Cancel request to ${name}`,
  requestAccepted: (name: string) => `Accepted. ${name} gets the new time in chat.`,
  requestDeclined: (name: string) => `Declined. ${name} is told in chat.`,
  requestCancelled: (name: string) => `Request to ${name} cancelled.`,
  requestFailed: 'Could not send the answer. It stays on the list, try again.',

  // Decision preview (card on the Agenda)
  messageTo: (name: string) => `Message ${name}`,
  seeEvidence: 'See evidence and options',
  otherOptions: (n: number) => P(n, '{n} other option', '{n} other options'),
  moreOptions: 'Options',
  programWeek: (program: string, week: number) => `${program} · week ${week}`,
  heroLabel: (what: string) => `${what} est. 1RM`,
  heroSets: (what: string) => `${what}, weekly sets`,
  heroDays: 'Days since the last session',
  heroNoChange: (weeks: number) => P(weeks, 'no change in {n} week', 'no change in {n} weeks'),
  heroSetsVs: (chronic: string) => `usual ${chronic}`,
  effectLine: (text: string, days: number | null) =>
    days == null ? text : `${text} Checked again in ${days} days.`,

  // All clear, states
  allClearTitle: 'No decisions waiting',
  allClearBody: (requests: number, measuring: number, days: number) => {
    const parts: string[] = [];
    if (requests > 0)
      parts.push(
        P(
          requests,
          'One request waits for your answer above.',
          `${requests} requests wait for your answer above.`,
        ),
      );
    if (measuring > 0)
      parts.push(
        P(
          measuring,
          `${measuring} decision is still measuring and reports back within ${days} days.`,
          `${measuring} decisions are still measuring and report back within ${days} days.`,
        ),
      );
    return parts.length ? parts.join(' ') : 'Nothing needs you today. The digest has the rest.';
  },
  seeBoard: 'See the board',
  nothingTitle: 'Nothing needs you today',
  nothingBody: 'The digest has the rest.',
  updatedAt: (t: string) => `Updated ${t}`,
  staleRefreshing: (t: string) => `Updated ${t}, refreshing`,
  offlineNote: 'Offline. Changes sync when you are back.',
  offlineUpdated: (t: string) => `Offline. Showing data from ${t}. Changes sync when you are back.`,
  unsynced: (n: number) => P(n, '{n} change waiting to sync', '{n} changes waiting to sync'),
  retry: 'Retry',
  errorTitle: 'Could not load Agenda',
  errorBody:
    'Check your connection and try again. Nothing was lost: changes you made are saved on this device.',
  tryAgain: 'Try again',
  forbiddenTitle: 'No access to Coach data',
  forbiddenBody: 'Your account cannot read client data yet. Ask an admin.',
  vaultLockedTitle: 'Your data is locked',
  vaultLockedBody: 'Unlock your vault, then try again.',
  notFoundTitle: 'This signal is gone',
  notFoundBody: 'It was decided, snoozed or dismissed. Agenda has what is open now.',
  backToAgenda: 'Back to Agenda',
  weekBriefsTitle: 'Your roster is small, so there is no queue',
  weekBriefsBody: 'With fewer than 8 clients the Week screen shows each client in a line.',

  // Decision screen
  backLabel: 'Agenda',
  decChoose: 'Choose what to do',
  decNext: 'What happens next',
  decSuggested: 'Suggested',
  decChosen: 'Chosen',
  decRecord: 'Record decision',
  decWait: 'Wait a week',
  decDismiss: 'Dismiss signal',
  decWhy: 'Why dismiss this?',
  decPickOne: 'Pick one.',
  decReasonNotUseful: 'Not useful',
  decReasonHandled: 'Already handled',
  decReasonWrong: 'Wrong data',
  decDismissConfirm: 'Dismiss with reason',
  decPickReason: 'Pick a reason to dismiss.',
  decOptionsLabel: 'Options',
  nextProgram: 'Program',
  nextResult: 'Result check',
  nextSees: (name: string) => `${name} sees`,
  nextSeesBody: 'The new version of the program in the app.',
  nextNothingChanges: 'Nothing changes in the program.',
  nextMessage: (name: string) => `Message to ${name}`,
  nextMessageSent: (name: string) => `Message sent to ${name}`,
  nextMessageNote: 'Sent with the decision. You can edit it first.',
  nextMessageEdit: 'Edit message',
  nextMessageDone: 'Done',
  nextNoChat: (name: string) => `${name} uses program only: no chat, so no message is sent.`,
  messageField: (name: string) => `Message to ${name}`,
  resultStep: (days: number, kg: string) =>
    `In ${days} days. Counted as improved only if estimated 1RM moves by ${kg} kg or more.`,
  resultStepRhythm: (days: number) =>
    `In ${days} days. Counted as improved if sessions per week go up by 1 or more.`,
  resultStepSpike: (days: number) =>
    `In ${days} days. Counted as improved if weekly sets are back within the usual range.`,
  waitStep: (date: string) => `We bring it back on ${date} unless the evidence gets stronger.`,
  recordedTitle: (option: string, name: string | null) =>
    name ? `Recorded: ${option}. ${name} got a message.` : `Recorded: ${option}.`,
  recordedSub: (days: number | null, date: string | null) =>
    days == null || date == null
      ? 'Nothing to measure.'
      : `We check the result in ${days} days (${date}).`,
  recordedAria: 'Decision recorded',
  undoText: 'Decision recorded',
  undoLabel: 'Undo',
  undoAria: 'Undo recording this decision',
  snoozedTitle: 'Waiting a week',
  snoozedBody: (date: string) => `We will bring it back on ${date}.`,
  dismissedTitle: 'Signal dismissed',
  dismissedBody: 'It stays hidden for 30 days unless the evidence gets stronger.',
  dismissedWrongData: 'Marked as wrong data. Check the client data in the profile.',
  acknowledge: 'Got it',
  recording: 'Recording',
  openProfile: (name: string) => `Open ${name}'s profile`,
  noOptionsTitle: 'Nothing to change in the program',
  noOptionsBody: 'This one is for your information. You can wait a week or dismiss it.',

  // Evidence
  evTitle: 'Evidence',
  evDate: 'Date',
  evSets: 'Sets (kg × reps)',
  evWeek: 'Week',
  evValue: 'Est. 1RM',
  evValueSets: 'Sets',
  evValueSessions: 'Sessions',
  evTable: 'Evidence table',
  evChartAria: (what: string, from: string, to: string, unit: string) =>
    `${what}: ${from} to ${to} ${unit}`,
  evChartUnit: 'Estimated 1RM, kg',
  evChartUnitSets: 'Sets per week',
  evChartUnitSessions: 'Sessions per week',
  evWeeksAgo: (n: number) => P(n, '{n} week ago', '{n} weeks ago'),
  evThisWeek: 'This week',
  evNoData: 'Not enough sessions yet (needs 3)',
  evNeedsFull: 'Set-by-set evidence needs Full',
  evLocked: (name: string, what: string) => `${name} does not share ${what}.`,
  evAsk: 'Ask to share',
  evAskFor: (what: string) => `Ask to share ${what}`,
  evSimilar: (n: number, total: number) =>
    `In ${n} of your ${total} similar past decisions, this helped.`,
  evShares: (name: string, list: string) =>
    `${name} shares: ${list}. Reads are logged and visible to ${name}.`,
  evSharesNothing: (name: string) =>
    `${name} shares nothing yet. Reads are logged and visible to ${name}.`,
  evMachine: (from: string, to: string) => `Est. 1RM ${from} to ${to} kg after the change`,
  evFactChange: (a: string, b: string) => `${a} to ${b}`,
  cat: {
    totals: 'workout totals',
    sets: 'sets and weights',
    body: 'body weight',
    sleep: 'sleep',
    injury: 'injuries',
    nutrition: 'nutrition',
    checkins: 'check-in answers',
  },

  // Signal copy (title, body, one line). Facts are machine values.
  sigStallTitle: (ex: string, weeks: number) =>
    `${ex} has not moved in ${P(weeks, '{n} week', '{n} weeks')}`,
  sigStallBody: (e1rm: string, weeks: number) =>
    `Estimated 1RM stayed at ${e1rm} kg for ${P(weeks, '{n} week', '{n} weeks')}, with steady volume. Same exercise, same setup.`,
  sigStallLine: (ex: string, e1rm: string, weeks: number) =>
    `${ex} est. 1RM ${e1rm} kg · no change in ${P(weeks, '{n} week', '{n} weeks')}`,
  sigMachineTitle: 'Looks like a stall, but it is a different machine',
  sigMachineBody: (ex: string, from: string, to: string) =>
    `${ex} est. 1RM went from ${from} to ${to} kg when the machine changed. The numbers are not comparable, so this is not counted as a stall.`,
  sigMachineLine: (ex: string, to: string) => `${ex} · est. 1RM ${to} kg on the new machine`,
  sigRhythmIdleTitle: (days: number) => `No session for ${P(days, '{n} day', '{n} days')}`,
  sigRhythmLowTitle: 'Fewer than half of the planned sessions',
  sigRhythmBody: (low: number, idle: number | null) =>
    idle != null && idle > 7
      ? `The last session was ${P(idle, '{n} day', '{n} days')} ago while sessions are planned this week.`
      : `Under half of the planned sessions were done in each of the last ${low} weeks.`,
  sigRhythmLine: (idle: number | null) =>
    idle != null ? `Last session ${P(idle, '{n} day', '{n} days')} ago` : 'Below plan for 2 weeks',
  sigSpikeTitle: (muscle: string, pct: number) => `${muscle} volume up ${pct}% in one week`,
  sigSpikeBody: (muscle: string, sets: number, chronic: string) =>
    `${sets} weekly sets for ${muscle}, against ${chronic} usually over the last 4 weeks.`,
  sigSpikeLine: (muscle: string, sets: number, pct: number) => `${muscle} ${sets} sets · +${pct}%`,
  sigReadyTitle: (ex: string) => `Ready to add weight on ${ex}`,
  sigReadyBody: (n: number, rpe: number) =>
    `The last ${n} sessions were at RPE ${rpe} or lower with every rep done.`,
  sigReadyLine: (ex: string, rpe: number) => `${ex} · RPE ${rpe} or lower`,
  sigPrTitle: (ex: string, e1rm: string) => `New ${ex} record: ${e1rm} kg`,
  sigPrBody: (gain: string, prev: string) =>
    `Estimated 1RM is up ${gain} kg on the previous best (${prev} kg).`,
  sigPrLine: (ex: string, gain: string) => `${ex} · +${gain} kg`,
  sigInjuryTitle: (ex: string) => `${ex} conflicts with a restriction`,
  sigInjuryBody: (restriction: string | null, n: number) =>
    restriction
      ? `The program has ${P(n, '{n} exercise', '{n} exercises')} the restriction rules out: ${restriction}.`
      : `The program has ${P(n, '{n} exercise', '{n} exercises')} the injury notes rule out.`,
  sigInjuryLine: (n: number) => `Conflict · ${P(n, '{n} exercise', '{n} exercises')}`,
  sigNoSetsTitle: 'Only totals shared, no set data',
  sigNoSetsBody: 'Sessions are visible, sets and weights are not. Nothing is wrong.',
  sigNoSetsLine: (done: number | null) =>
    done == null ? 'Totals only' : `Sessions last week: ${done}`,
  sigNoDataTitle: 'No sessions are logged',
  sigNoDataBody: 'This client logs in the app, but no session shows up in the last 4 weeks.',
  sigNoDataLine: 'Nothing logged in 4 weeks',

  // Options (title by id, the description is generated from the diff)
  optVariation: 'Add a variation + 1 set',
  optDeload: 'Deload week',
  optStep: 'Add 2.5 kg',
  optSwap: 'Swap the exercise',
  optLighter: 'Two lighter weeks',
  optWait: 'Wait a week',
  optDismiss: 'Dismiss signal',
  opSets: (ex: string, from: number, to: number) => `${ex}: ${from} to ${to} sets.`,
  opAdd: (ex: string, sets: number, reps: number) => `Adds ${sets} × ${reps} ${ex}.`,
  opWeight: (ex: string, from: number, to: number) => `${ex}: ${from} to ${to} kg.`,
  opWeightUp: (ex: string, kg: number) => `${ex}: +${kg} kg.`,
  opDeload: (pct: number, weeks: number) =>
    `${pct}% less volume for ${P(weeks, '{n} week', '{n} weeks')}.`,
  opSwap: (from: string, to: string) => `Swaps ${from} for ${to}.`,
  opAltSafe: 'a restriction-safe alternative',
  opMessageDraft: (name: string, kind: string) => {
    switch (kind) {
      case 'stall':
        return `Hi ${name}, quick question: how are you sleeping and eating this week? Your lift has not moved for a month. I changed the program a little.`;
      case 'spike':
        return `Hi ${name}, last week was a lot more than usual. I lowered this week on purpose, so please keep it easy.`;
      case 'rhythm':
        return `Hi ${name}, I noticed fewer sessions lately. I made the next two weeks lighter. Tell me what gets in the way.`;
      case 'injury':
        return `Hi ${name}, I swapped an exercise that does not fit your restriction. Tell me if anything still hurts.`;
      case 'ready':
        return `Hi ${name}, your last sessions felt easy, so I added a little weight. Tell me how it feels.`;
      default:
        return `Hi ${name}, I updated your program. Tell me how it feels.`;
    }
  },

  // Result words on board cards
  resultLine: (result: string, before: string | null, after: string | null) =>
    before != null && after != null ? `${result} · Est. 1RM ${before} to ${after} kg` : result,
  measuringDay: (day: number, total: number) => `Measuring: day ${day} of ${total}`,
  waitUntil: (date: string) => `Back on ${date}`,
  decisionTitle: (ops: string) => ops,

  // Live widget (stub)
  liveTitle: 'Training now',
  liveSummary: (live: number, offline: number, finished: number) =>
    `${live} live · ${offline} offline · ${finished} finished`,
  liveNow: 'Live now',
  liveOffline: 'Offline',
  liveFinished: 'Finished',
  liveSinceLine: (time: string, gym: string) => `${gym} · since ${time}`,
  liveLost: 'Connection lost, reconnecting',
  liveFinishedLine: (sets: number, tonnes: string, gym: string) =>
    `${sets} sets · ${tonnes} t · ${gym}`,
  liveStatusNow: 'Training now',
  liveStatusOffline: 'Offline, paused',
  liveStatusDone: 'Finished',
  liveLastSeen: (s: number) => `Last seen ${s} s ago`,
  liveNone: 'Nobody is training right now.',
  liveClosedAria: (n: number) => `${n} live, open the list`,
  livePrivacy:
    'You see who is training and for how long. Sets and weights stay with the client until the session ends.',
  liveMinutes: (m: number) =>
    m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`,
};

export type TodayStrings = typeof todayEn;
