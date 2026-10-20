/**
 * Client-side trainer strings (M7). Own dictionary; read through `useClientT()` in `coachClient.ts`. Every key is
 * mirrored in uk / pl / lt / et (enforced by `typeof clientEn`). Functions take ONE argument (a first name, a
 * preformatted date or a count); the parity test calls each with a name and with numbers.
 */
import { plural } from './coachPlural';

const sharedOf = (n: number) => `${n} of 6 shared`;

export const clientEn = {
  /* ---- common ---- */
  ccBack: 'Back',
  ccRetry: 'Try again',
  ccLoading: 'Loading',
  ccTrainer: 'Trainer',
  ccDone: 'Done',
  ccUndo: 'Undo',
  ccSaveFailed: 'Could not save. Nothing changed. Try again.',
  ccUnreadAria: (n: number) =>
    plural('en', n, { one: '{n} unread message', other: '{n} unread messages' }),

  /* ---- levels + the six settings (S-26, S-29, S-32) ---- */
  lvOff: 'Off',
  lvEffects: 'Effects only',
  lvFull: 'Full',
  catTotals: 'Workout totals',
  catSets: 'Sets and weights',
  catBody: 'Body weight',
  catSleep: 'Sleep',
  catInjury: 'Injuries and restrictions',
  catNutrition: 'Nutrition',
  seesTotalsOff: 'Nothing about your sessions.',
  seesTotalsEffects: 'How many sessions you did and how long they were.',
  seesTotalsFull: 'Each session: days, length and total weight lifted.',
  seesSetsOff: 'No sets or weights.',
  seesSetsEffects: 'Your best set and estimated one-rep max for each lift.',
  seesSetsFull: 'Every set: exercise, weight, reps and RPE (how hard it felt, 1 to 10).',
  seesBodyOff: 'No body data.',
  seesBodyEffects: 'Only the direction your weight is moving.',
  seesBodyFull: 'Exact weight and measurements. Photos are never shared.',
  seesSleepOff: 'Nothing about your sleep.',
  seesSleepEffects: 'Your weekly average and whether it is going up or down.',
  seesSleepFull: 'How long and how well you slept, every night.',
  seesInjuryOff: 'Nothing shared. Your program may include moves that hurt.',
  seesInjuryEffects: 'Which movements to avoid. No diagnosis.',
  seesInjuryFull: 'Injury details and rehab notes.',
  seesNutritionOff: 'Nothing about food.',
  seesNutritionEffects: 'Whether your calories are on track for your target.',
  seesNutritionFull: 'Calories, protein, carbs and fat for every day.',
  lvSheetSees: (first: string) => `What ${first} sees`,
  lvSheetLabel: 'Sharing level',

  /* ---- presets (S-26) ---- */
  presetLabel: 'Sharing preset',
  presetTraining: 'Training only',
  presetTrainingSub: 'Workout totals and sets with weights.',
  presetRecovery: 'Training and recovery',
  presetRecoverySub: 'Adds sleep and body weight as summaries.',
  presetAll: 'Everything',
  presetAllSub: 'Adds nutrition. Injuries still start Off.',

  /* ---- invite pages (S-25 .. S-28) ---- */
  invTitle: (first: string) => `${first} invited you`,
  invBody:
    'Your trainer wants to write your program here and follow how it goes. Nothing is shared until you choose it on the next step.',
  invInviter: (name: string) => `${name} · personal trainer`,
  invInviterAt: (org: string) => `Personal trainer at ${org}`,
  invAccept: 'Accept invite',
  invDecline: 'Decline invite',
  invUntil: (date: string) => `This invite works until ${date} · one use`,
  invStep: 'Step 2 of 2',
  invStepName: 'Share',
  invStep1Aria: 'Step 1 of 2',
  invStep2Aria: 'Step 2 of 2',
  invShareTitle: (first: string) => `What should ${first} see?`,
  invShareBody: 'Pick a starting point. You can change every row later in Privacy and sharing.',
  invWouldSee: (first: string) => `${first} would see`,
  invShareNote: (first: string) =>
    `Injuries and restrictions start Off. ${first} can keep private notes about you. They are not part of what you share.`,
  invSave: 'Save and continue',
  invNothing: 'Share nothing for now',
  invSaveFailed: 'Could not connect. Nothing was shared. Try again.',
  invOkTitle: (first: string) => `You are connected to ${first}`,
  invOkBody: (name: string) =>
    `${name} is now your trainer. Your trainer is preparing your program and will message you when it is ready. You can change what they see at any time.`,
  invOkTagFull: (n: number) => `Full: ${n}`,
  invOkTagEffects: (n: number) => `Effects only: ${n}`,
  invOkTagNone: 'Sharing: nothing yet',
  invOkInjuryOff: 'Injuries: off',
  invOkWaiting: (first: string) => `Waiting for ${first}'s app to turn sharing on`,
  invOkWaitingBody:
    'This happens once, when your trainer next opens Spotter. Your choices are saved.',
  invGoToday: 'Go to Today',
  invMessage: (first: string) => `Message ${first}`,
  invChange: 'Change what they see',
  invExpTitle: 'This invite expired',
  invExpBody: (name: string) =>
    `The link from ${name} stopped working. Ask for a new one. Nothing was shared.`,
  invExpAsk: (first: string) => `Ask ${first} for a new invite`,
  invExpContinue: 'Continue without a trainer',
  invAskText: (first: string) =>
    `Hi ${first}, my invite to Spotter expired. Could you send me a new one?`,
  invAskCopy: 'Copy message',
  invAskCopied: 'Copied',
  invAskSheet: 'Ask for a new invite',
  invAskHint: 'Copy this message and send it to your trainer.',
  invUsedTitle: 'This invite was already used',
  invUsedBody: 'Nothing changes. You can ask your trainer for a new link if you need one.',
  invDeclinedTitle: 'You declined this invite',
  invDeclinedBody: (first: string) =>
    `Nothing was shared. ${first} only sees that the invite was declined.`,
  invOfflineTitle: 'Needs the network',
  invOfflineBody: 'Opening an invite checks it with the server. Try again when you are online.',
  invLoadingAria: 'Checking the invite',

  /* ---- sharing block on Privacy and sharing (S-29 .. S-34) ---- */
  shSees: (first: string) => `What ${first} sees`,
  shSeesWaiting: (first: string) => `What ${first} will see once sharing is on`,
  shNothing: (first: string) => `${first} sees nothing.`,
  shEffectsOnly: 'Effects only:',
  shFullLabel: 'Full:',
  shRest: 'Nothing else. Private notes about you are not part of this.',
  shYourTrainer: 'Your trainer',
  shSince: (date: string) => `Since ${date}`,
  shOfSix: sharedOf,
  shActive: 'Active',
  shWaiting: 'Waiting',
  shNotShared: 'Not shared',
  shNoneSub: 'Nothing is shared yet',
  shWaitingSub: (first: string) => `Waiting for ${first} to turn sharing on`,
  shCaption: (first: string) =>
    `You can stop sharing at any time. What ${first} already saw stays in their records.`,
  shWaitingNote: (first: string) =>
    `Waiting for ${first}'s app to turn sharing on. This happens once, when they next open Spotter. Until then they only see that you trained. Your choices below are saved.`,
  shNoneNote: (first: string) =>
    `You are not sharing anything yet. ${first} sees nothing until you do.`,
  shStart: 'Start sharing',
  shHead: (first: string) => `Share with ${first}`,
  shFoot:
    'Each setting applies right away. Conditions, nicotine, alcohol and supplements have their own settings below.',
  shLog: 'Who saw what and when',
  shLogSub: (first: string) => `A list of every time ${first} opened your data`,
  shStop: (first: string) => `Stop sharing with ${first}`,
  shRevokeTitle: (first: string) => `Stop sharing with ${first}?`,
  shRevokeBody: (first: string) =>
    `${first} will no longer see your new workouts, sleep or anything else you shared. What was already seen stays in their records. Their notes and your chat stay. You can share again later.`,
  shKeep: 'Keep sharing',
  shStopConfirm: 'Stop sharing',
  shStopped: 'Sharing stopped',
  shRevokedNote: (first: string) => `You stopped sharing with ${first}. They see nothing new.`,

  /* ---- access log (S-31) ---- */
  lgTitle: 'Who saw your data',
  lgInfo: (first: string) =>
    `Each time ${first} opens something you share, it is listed here. Only you can see this list. Private notes are not listed.`,
  lgTimes: (n: number) => `${n} times that day`,
  lgKept: 'Kept for 90 days',
  lgKeptSub: 'Older entries are deleted automatically',
  lgNotShared: (names: string) =>
    `Not shared, so it cannot be opened and never appears here: ${names}.`,
  lgEmpty: (first: string) => `${first} has not opened anything yet`,
  lgEmptyBody: 'When your trainer opens something you share, it shows up here.',
  lgFailed: 'Could not load the list.',
  lgWeek: 'Opened your week',
  lgSession: 'Opened your session',
  lgHistory: 'Looked at an exercise history',
  lgSummary: 'Opened a weekly summary',
  lgLive: 'Followed your live session',

  /* ---- My trainer page ---- */
  mtTitle: 'My trainer',
  mtSince: (date: string) => `Your trainer since ${date}`,
  mtChat: 'Chat',
  mtMigratedNote: (first: string) =>
    `${first} was already your trainer in Spotter. Nothing is shared with ${first} until you choose what to share.`,
  mtSharing: 'Sharing settings',
  mtLegacyRole: 'Your trainer',
  mtLegacyNote: 'Your trainer card and what you share stay as they are.',
  mtProgramHead: (first: string) => `Program from ${first}`,
  mtProgramSub: (v: string) => `Version ${v}`,
  mtProgramNew: 'New',
  mtNotesHead: 'Notes shared with me',
  mtNotesFoot: (first: string) =>
    `${first} chooses which notes to share with you. Private notes do not show here.`,
  mtNotesOpen: 'Open notes',
  mtNotesNone: 'No notes shared with you yet',
  mtPrivacy: 'Privacy and sharing',
  mtPrivacySub: (first: string) => `Change what ${first} sees`,
  mtLeave: 'Leave this trainer',
  mtLeaveTitle: (first: string) => `Leave ${first}?`,
  mtLeaveBody: (first: string) =>
    `${first} will no longer see your workouts and can no longer change your program. Your workout history, the program and your chat stay with you. Sharing turns off. Private notes stay with the trainer.`,
  mtLeaveConfirm: 'Leave trainer',
  mtLeaveKeep: 'Keep trainer',
  mtUpcomingHead: (first: string) => `Upcoming sessions with ${first}`,
  mtUpcomingFoot: (first: string) =>
    `${first} sees the time you ask for. Session times are stored encrypted, like your chat.`,
  mtUpcomingGroupFoot:
    'In split and group sessions you see how many people come, not who. Session times are stored encrypted, like your chat.',
  mtMove: 'Move',
  mtWaiting: 'Waiting',
  mtYouAsked: (when: string) => `You asked for ${when}`,
  mtShowAll: (n: number) => `Show all ${n}`,
  mtNoSessions: 'No sessions with your trainer are planned.',
  mtPeople: (n: number) => plural('en', n, { one: '{n} person', other: '{n} people' }),
  mtSessionWith: (first: string) => `Session with ${first}`,
  mtSplit: (first: string) => `Split session with ${first}`,
  mtGroup: (title: string) => `Group · ${title}`,

  /* ---- reschedule form in the client's voice ---- */
  rqTitle: 'Request a new time',
  rqSub: (first: string) =>
    `${first} gets a request in the chat and answers there. The session stays where it is until then.`,
  rqSent: 'Request sent',
  rqSentB: (first: string) => `${first} sees it in the chat. It expires if nobody answers.`,
  rqNoSessionsB: 'When your trainer plans a session, you can ask to move it here.',

  /* ---- Today tile + next session (S-35 / section 6) ---- */
  tdWithTag: (time: string) => `With your trainer · ${time}`,
  tdNextKind: (first: string) => `Next session with ${first}`,
  tdNextGroupKind: (first: string) => `Next group session with ${first}`,
  tdRequest: 'Request reschedule',
  tdWaitingTag: (first: string) => `Waiting for ${first}`,
  tdWaitingBody: (day: string) => `The session stays on ${day} until it is accepted.`,
  tdCancelReq: 'Cancel request',
  tdCounterTag: (first: string) => `${first} suggested another time`,
  tdCounterBody: (when: string) => `They suggest ${when}. The session stays until you answer.`,
  tdAccept: 'Accept',
  tdDecline: 'Decline',
  tdCoachDaysHead: 'Coach days',
  tdCoachDaysFoot: 'Your coach is not in Spotter. Marking days only changes how Today looks.',
  tdCoachDaysRow: 'Days with my coach',
  tdCoachTag: (days: string) => `With my coach · ${days}`,

  /* ---- chat with the trainer (S-35) ---- */
  chRole: (seen: string) => `Trainer · ${seen}`,
  chSeen: (time: string) => `last seen ${time}`,
  chSeesBtn: (first: string) => `What ${first} sees`,
  chNotesBtn: 'Notes from my trainer',
  chNotesAria: (n: number) => `Notes from my trainer, ${n}`,
  chProgramUpdated: 'Program updated',
  chOpenProgram: 'Open program',
  chPlaceholder: (first: string) => `Message ${first}`,
  chMenuTrainer: 'My trainer',
  chNoteFrom: (first: string) => `Note from ${first}`,

  /* ---- programs / session / calendar (section 6) ---- */
  pgWithTrainer: 'With your trainer',
  pgDaysNote: (first: string) =>
    `Days with ${first} are set by them. To move one, send a request in chat.`,
  pgActivityNote: (first: string) =>
    `Activities are added by ${first}. They show on Today after the lifts.`,
  pgBareNote: 'No numbers for these exercises. You choose the sets and weight in the session.',
  pgUpdated: (first: string) => `${first} updated your program`,
  pgUpdatedV: (v: string) => `Version ${v}`,
  pgAck: 'Got it',
  seTarget: (first: string) => `${first}'s target`,
  seRest: (v: string) => `rest ${v}`,
  seDropLast: 'last set: drop set',
  seBodyweight: 'Bodyweight',
  calMarkerLegend: 'Session with my trainer',
  calMarkerDay: (first: string) => `session with ${first}`,

  /* ---- notifications ---- */
  nfMessage: (first: string) => `New message from ${first}`,
  nfProgram: (first: string) => `${first} changed your program`,
  nfResched: (first: string) => `${first} asked to move a session`,
  nfReschedAnswer: (first: string) => `${first} answered your request`,
  mtTeamRow: 'Your trainer’s team',
  mtTeamRowSub: 'Who works with your trainer',
  tmgTitle: 'Your trainer’s team',
  tmgPeople: 'People in the team',
  tmgRoleTrainer: 'Trainer',
  tmgRoleManager: 'Manager',
  tmgCan:
    'Team members can see your schedule, your name and your contact details. They can propose a new time; you answer.',
  tmgCannot: 'They do not see your workouts, health, nutrition, notes or messages.',
  tmgActionsHead: 'What managers did with your schedule',
  tmgActionsNone: 'Nothing yet',
  tmgFailed: 'Could not load the team.',
  tmgKind: {
    'move-request': 'Proposed a new time',
    'move-cancel': 'Withdrew a proposed time',
    'session-done': 'Marked a session done',
    'session-missed': 'Marked a session missed',
    'session-cancelled': 'Cancelled a session',
    'session-edited': 'Changed your schedule',
  } as Record<string, string>,
};
