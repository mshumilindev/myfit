/**
 * Unread messages across all of the coach's clients — the ONE source for the rail Chat badge, the phone tab bar
 * Chat badge and the dock FAB (R-FE-011, R-FE-102). Nothing else may keep its own total.
 *
 * The implementation lives in `data/` (`useCoachUnread` reads the open `unread{<uid>}` map of the trainer's
 * conversations through the chat data port); this module is the stable import path the shell uses.
 */
export { useCoachUnread, useCoachUnreadState } from './data/useCoachUnread';
export { sumUnread, NO_UNREAD, type CoachUnread } from './data/unreadStore';
