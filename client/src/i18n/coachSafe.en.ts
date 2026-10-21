/**
 * Coach safety and trust dictionary (iteration 14): not-configured notice, security code, re-authentication,
 * idle lock, share requests, quiet hours. Generated from one table; read through `useSafeT()` in `coachSafe.ts`.
 */
export const safeEn = {
  // Backend notices
  offTitle: 'Coach is not configured',
  offBody:
    'This build is not connected to the Coach backend, so no clients are shown. Ask the administrator to switch it on.',
  offBack: 'Back to my workouts',
  // My trainer: states
  retry: 'Try again',
  bkFailTitle: "Couldn't start Coach",
  bkFailBody: 'Your data is safe. Check the connection and try again.',
  // Why Coach could not load (real backend): offline / not deployed / denied / timeout / unknown
  pbOfflineTitle: 'No connection',
  pbOfflineBody: 'Your data is safe on this device. Reconnect and try again.',
  pbNotDeployedTitle: "Coach service isn't available on this project yet",
  pbNotDeployedBody:
    'Your data is safe. The Coach backend has not been switched on for this project, so there is nothing to load.',
  pbDeniedTitle: "Coach isn't available for this account",
  pbDeniedBody: 'The server refused access. Sign out and in again, or ask the administrator.',
  pbTimeoutTitle: 'Coach is taking too long',
  pbTimeoutBody: 'Your data is safe. The service did not answer in time. Try again.',
  pbUnknownTitle: "Couldn't load Coach",
  pbUnknownBody: 'Your data is safe. Something went wrong on our side. Try again.',
  pbDevHint:
    'Dev: the Coach callables, rules and indexes are probably not deployed to this Firebase project. See docs/COACH-BACKEND.md (deploy checklist).',
  mtFailTitle: "Couldn't load your trainer",
  mtFailBody: 'Your data is safe. Check the connection and try again.',
  mtNoneTitle: 'No trainer yet',
  mtNoneBody:
    'When a trainer invites you, the invite link opens here and you choose what to share. Nothing is shared until you say so.',
  mtNoneCta: 'Back to Today',
  // Security code (Part C.2 no. 5)
  scTitle: 'Security code',
  scMenu: 'Security code',
  scIntroTrainer: (a: string) =>
    `This code belongs to your encrypted chat key. Read it out in person or on a call; if it matches what the client (${a}) sees, nobody sits between you.`,
  scIntroClient: (a: string) =>
    `Compare this code with the one ${a} sees, in person or on a call. If they match, nobody can read your messages in between.`,
  scGroupsAria: (a: string) => `Security code: ${a}`,
  scCopy: 'Copy code',
  scCopied: 'Copied',
  scVerify: 'The codes match',
  scUnverify: 'Mark as not verified',
  scVerified: 'Verified',
  scNotVerified: 'Not verified yet',
  scClose: 'Close',
  scLoading: 'Loading the code',
  scNoKey: 'No security code yet. It appears once the encrypted chat is set up on both sides.',
  scChangedTitle: (a: string) => `${a}’s security code changed`,
  scChangedBody: (a: string) =>
    `Your messages stay encrypted: this device wrapped the chat key for the new key. If the change is unexpected, compare the new code with ${a}.`,
  scChangedReview: 'Review code',
  scChangedToast: (a: string) => `${a}’s security code changed`,
  scChangedReviewSub: 'Changed. Review the new code',
  // Re-authentication and idle lock
  raTitle: 'Confirm it is you',
  raBodyExport: 'Exporting copies client data out of the app. Enter your password to continue.',
  raBodyEnd:
    'Ending the relationship stops sharing in both directions. Enter your password to continue.',
  raBodyRevoke:
    'Withdrawing the invite switches its link off for everybody. Enter your password to continue.',
  raPassword: 'Password',
  raIdentifier: 'Username or email',
  raConfirm: 'Confirm',
  raCancel: 'Cancel',
  raWrong: 'That password is not right.',
  raLocked: 'Too many attempts. Try again in 15 minutes.',
  raOffline: 'No connection. Check your network and try again.',
  raError: 'Could not check the password. Try again.',
  // Roster export and invite withdrawal
  exScopeRoster: 'client list',
  invWithdrawFor: (a: string) => `Withdraw invite for ${a}`,
  invWithdrawTitle: (a: string) => `Withdraw the invite for ${a}?`,
  invWithdrawBody: 'Nothing has been shared yet. You can invite again at any time.',
  invWithdrawEffect: 'The link stops working for everybody.',
  invWithdrawConfirm: 'Withdraw invite',
  invResendFor: (a: string) => `Send a new invite to ${a}`,
  invResendDone: (a: string) => `New invite for ${a} is ready. The old link no longer works.`,
  invCopyLink: 'Copy link',
  invResendFailed: 'Could not send a new invite. Check the connection and try again.',
  invWithdrawFailed: 'Could not withdraw the invite. Check the connection and try again.',
  // End coaching (trainer side)
  ecMenu: (a: string) => `End coaching with ${a}`,
  ecTitle: (a: string) => `End coaching with ${a}?`,
  ecBody: 'Sharing stops in both directions. You can invite again later.',
  ecEffectSee: (a: string) => `You stop seeing ${a}’s data.`,
  ecEffectKeeps: (a: string) => `${a} keeps the chat and the program.`,
  ecEffectNotes: 'Your notes and decisions stay with you.',
  ecConfirm: 'End coaching',
  ecFailed: 'Could not end coaching. Check the connection and try again.',
  // Share requests, decision sharing
  askMsg: (what: string) => `Sharing request: ${what}`,
  askCardKind: 'Sharing request',
  askCardMine: (what: string) => `You asked to see: ${what}.`,
  askCardTheirs: (what: string) => `Your trainer asked to see: ${what}.`,
  askCardOpen: 'Open sharing settings',
  askFailed: 'Could not send the request. Check the connection and try again.',
  undo: 'Undo',
  undoCountdown: 'Undo is available for 8 seconds',
  dsUnsharedToast: (a: string) => `Stopped sharing with ${a}`,
  dsFailed: 'Could not change sharing. Check the connection and try again.',
  // Quiet hours (Q-17)
  qhTitle: 'Quiet hours',
  qhSub: (from: string, to: string) =>
    `No sound for your trainer’s messages from ${from} to ${to}. They still count as unread.`,
  qhFrom: 'From',
  qhTo: 'To',
  // Notification switches (SPO-237)
  pnRequests: 'Requests',
  pnReminders: 'Reminders',
  pnTeam: 'Team',
  pnSub:
    'Switch off a kind to stop its push. The message stays in Spotter. Quiet hours never hold requests.',
};
