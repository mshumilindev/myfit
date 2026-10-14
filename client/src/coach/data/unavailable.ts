/**
 * Stand-in ports for the REAL backend when it has not been installed (yet, or the install failed). They never invent data:
 * every read reports `unavailable` and every write rejects, so a screen that reaches one shows its error state instead of
 * sample people (there is no demo mode: sample data exists only as test doubles under `__fixtures__`, see `testHooks.ts`).
 */
import type { ChatPort } from '../chat/port';
import { ClientPortError } from '../client/data/types';
import type { ClientChatPort } from '../client/data/chatPort';
import type { ClientCoachPort } from '../client/data/port';
import type { LivePort } from '../screens/live/port';
import type { NotesPort } from '../notes/port';
import { SchedulePortError, type SchedulePort } from '../schedule/port';
import type { ShareSourcePort } from '../share/port';
import type { ProgramPort } from '../program/port';
import { ProgramPortError } from '../program/types';
import { PortError, type CoachWorldPort } from './port';

const no = () => Promise.reject(new PortError('unavailable'));
const noClient = () => Promise.reject(new ClientPortError('unavailable'));
/** Reports the failure asynchronously (never inside the caller's render) and returns a no-op unsubscribe. */
const failLater = (err: unknown, onError: (e: unknown) => void) => {
  queueMicrotask(() => onError(err));
  return () => undefined;
};

export function createUnavailableWorldPort(): CoachWorldPort {
  return { peek: () => null, load: no, save: no, now: () => Date.now() };
}

export function createUnavailableChatPort(): ChatPort {
  return {
    subscribeThreads: (_u, _t, onError) => failLater(new PortError('unavailable'), onError),
    subscribeMessages: (_c, _m, onError) => failLater(new PortError('unavailable'), onError),
    send: no,
    markRead: no,
    softDelete: no,
    undoDelete: no,
    commitDelete: no,
    clearChat: no,
    undoClear: no,
    now: () => Date.now(),
  };
}

export function createUnavailableClientPort(): ClientCoachPort {
  return {
    now: () => Date.now(),
    peek: () => null,
    subscribe: (_on, onError) => failLater(new ClientPortError('unavailable'), onError),
    getInvite: noClient,
    acceptInvite: noClient,
    declineInvite: noClient,
    setLevel: noClient,
    revoke: noClient,
    restore: noClient,
    leave: noClient,
    accessLog: noClient,
    ackProgram: noClient,
    setSelfCoachDays: noClient,
  };
}

export function createUnavailableClientChatPort(): ClientChatPort {
  return {
    now: () => Date.now(),
    subscribe: (_c, _on, onError) => failLater(new ClientPortError('unavailable'), onError),
    subscribeUnread: () => () => undefined,
    send: noClient,
    markRead: noClient,
    softDelete: noClient,
    undoDelete: noClient,
    commitDelete: noClient,
    clearChat: noClient,
    undoClear: noClient,
  };
}

const noSchedule = () => Promise.reject(new SchedulePortError('unavailable'));
const noProgram = () => Promise.reject(new ProgramPortError('unavailable'));

export function createUnavailableLivePort(): LivePort {
  return {
    subscribe: (_u, _on, onError) => failLater(new PortError('unavailable'), onError),
    now: () => Date.now(),
  };
}

export function createUnavailableSharePort(): ShareSourcePort {
  return { peek: () => null, load: no };
}

export function createUnavailableProgramPort(): ProgramPort {
  return {
    peek: () => null,
    load: noProgram,
    saveDraft: noProgram,
    send: noProgram,
    library: () => [],
    copyTo: noProgram,
  };
}

export function createUnavailableSchedulePort(): SchedulePort {
  return {
    now: () => Date.now(),
    peek: () => null,
    subscribe: (_on, onError) => failLater(new SchedulePortError('unavailable'), onError),
    saveDoc: noSchedule,
    createRequest: noSchedule,
    setStatus: noSchedule,
  };
}

export function createUnavailableNotesPort(): NotesPort {
  return {
    now: () => Date.now(),
    subscribe: (_c, _on, onError) => failLater(new PortError('unavailable'), onError),
    add: no,
    edit: no,
    setVis: no,
    remove: no,
  };
}
