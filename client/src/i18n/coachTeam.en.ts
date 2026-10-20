/**
 * Coach team strings (SPO-196): the Team page, add / member sheets, leave / remove confirms. Own dictionary like
 * coachChat; read through `useTeamT()` in `coachTeam.ts`. Every key is mirrored in uk / pl / lt / et
 * (enforced by `typeof teamEn`). Copy is gender-neutral: it uses the person's name, never "she" / "he".
 */
import { plural } from './coachPlural';

const peopleN = (n: number) => plural('en', n, { one: '{n} person', other: '{n} people' });
const daysAgo = (n: number) => plural('en', n, { one: '{n} day ago', other: '{n} days ago' });

export const teamEn = {
  tmTitle: 'Team',
  tmSubTrainer: (n: number) => `${peopleN(n)}. You add managers, a manager adds trainers.`,
  tmSubManager: (n: number) =>
    `${peopleN(n)}. You add trainers. Only a trainer can remove a manager.`,
  tmAddManager: 'Add a manager',
  tmAddTrainer: 'Add a trainer',
  tmMembers: 'Members',
  tmPending: 'Pending invites',
  tmYou: 'You',
  tmRoleTrainer: 'Trainer',
  tmRoleManager: 'Manager',
  tmPendingTag: 'Pending',
  tmRevoke: 'Revoke',
  tmRevokeFor: (email: string) => `Revoke invite for ${email}`,
  tmActiveNow: 'Active now',
  tmLastActive: (when: string) => `Last active ${when}`,
  tmAdded: (date: string) => `Added ${date}`,
  tmWhenToday: 'today',
  tmWhenYesterday: 'yesterday',
  tmInviteSent: (role: string, ago: string) => `${role} invite sent ${ago}`,
  tmAgoToday: 'today',
  tmAgoYesterday: 'yesterday',
  tmAgoDays: (n: number) => daysAgo(n),
  tmActivityLog: 'Activity log',
  tmActivityLogSub: 'Who did what, by day',
  tmRoles: 'What each role can do',
  tmRolesSub: 'Fixed access, same for everyone',
  tmLeave: 'Leave team',
  tmLeaveNoteTrainer: 'Managers lose access to your clients. Your clients and data stay with you.',
  tmLeaveNoteManager: 'Your clients and data stay as they are. You can be invited again.',
  tmOpenMember: (name: string) => `Open ${name}`,
  tmMembersLabel: 'Team members',
  tmPendingLabel: 'Pending invites',

  // add sheet
  tmAddManagerTitle: 'Add a manager',
  tmAddManagerBody:
    'A manager runs your schedule and client list. They cannot see workouts, health, nutrition, notes or chat, and cannot add other managers.',
  tmAddTrainerTitle: 'Add a trainer',
  tmAddTrainerBody:
    'A trainer coaches their own clients. They join the team you manage and appear in your Clients and Schedule.',
  tmEmail: 'Email',
  tmEmailHint:
    'They get an invite link by email. It works for 7 days and one person. Access starts when they accept.',
  tmSendInvite: 'Send invite',
  tmCancel: 'Cancel',
  tmErrInvalidEmail: 'Enter a valid email address.',
  tmErrExists: 'This person is already in the team or has an open invite.',
  tmErrOffline: 'You are offline. Try again when you are back online.',
  tmErrGeneric: 'Could not send the invite. Try again.',
  tmInviteSentSnack: (email: string) => `Invite sent to ${email}`,
  tmLinkTitle: 'Share the invite link',
  tmLinkBody: (email: string) => `Send this link to ${email}. It works once and expires in 7 days.`,
  tmCopyLink: 'Copy link',
  tmLinkCopied: 'Link copied',
  tmDone: 'Done',

  // member sheet
  tmMemberTitle: 'Team member',
  tmRole: 'Role',
  tmEmailRow: 'Email',
  tmAddedRow: 'Added',
  tmLastActiveRow: 'Last active',
  tmScheduleAccess: 'Schedule access',
  tmScheduleReady: (ready: number, total: number) => `${ready} of ${total} clients ready`,
  tmPermissions: 'Permissions',
  tmSeeAll: 'See all team activity',
  tmSeeAllOff: (name: string) =>
    `Off: ${name} sees only their own actions in the log. On: ${name} sees every trainer’s and manager’s actions.`,
  tmRemoveFromTeam: 'Remove from team',
  tmRemoveNote: (name: string) =>
    `${name} loses access at once. Their past actions stay in the log.`,
  tmClose: 'Close',

  // confirms
  tmRemoveTitle: (name: string) => `Remove ${name} from the team?`,
  tmRemoveBody: (name: string) => `${name} will lose access to your clients and schedule.`,
  tmRemoveEffect1: 'Access ends at once on every device.',
  tmRemoveEffect2: (name: string) => `Session keys are renewed so ${name} cannot read new data.`,
  tmRemoveEffect3: 'Past actions stay in the activity log.',
  tmRemoveKeep: (name: string) => `Keep ${name}`,
  tmRemoveConfirm: 'Remove',
  tmLeaveManagerTitle: (owner: string) => `Leave ${owner}’s team?`,
  tmLeaveManagerBody: 'You will lose access to the schedule and clients.',
  tmLeaveManagerEffect1: 'Clients and sessions stay with their trainers.',
  tmLeaveManagerEffect2: 'A trainer can invite you again.',
  tmLeaveManagerEffect3: 'Your past actions stay in the activity log.',
  tmLeaveStay: 'Stay',
  tmLeaveConfirm: 'Leave team',
  tmLeaveTrainerTitle: 'Leave the team?',
  tmLeaveTrainerBody: 'Managers will lose access to your clients.',
  tmLeaveTrainerEffect1: 'Your clients and data stay with you.',
  tmLeaveTrainerEffect2: 'Session keys are renewed for your clients.',
  tmLeaveTrainerEffect3: 'You can be invited again.',

  // states
  tmLoadFailed: 'The team could not be loaded.',
  tmRetry: 'Try again',
  tmOfflineStale: 'Offline. Showing the last saved team.',
  tmEmptyMembers: 'Only you so far.',
  tmEmptyInvites: 'No open invites.',
};
