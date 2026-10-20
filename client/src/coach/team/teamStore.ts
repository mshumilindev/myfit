import { TeamPortError, type TeamErrorCode, type TeamPort } from './port';
import { inviteeRole, isEmail, type ActivityScope, type TeamData } from './types';

export type TeamStatus = 'loading' | 'ready' | 'failed';

export interface TeamState {
  status: TeamStatus;
  data: TeamData | null;
  /** why the last load failed (the screen shows it with Retry); a stale snapshot stays visible */
  error: TeamErrorCode | null;
  /** an action is running */
  busy: boolean;
}

export interface TeamStore {
  getState(): TeamState;
  subscribe(fn: () => void): () => void;
  load(): Promise<void>;
  invite(email: string): Promise<{ ok: true; url: string } | { ok: false; error: TeamErrorCode }>;
  revokeInvite(id: string): Promise<void>;
  removeMember(uid: string): Promise<void>;
  leave(): Promise<void>;
  setActivityScope(uid: string, scope: ActivityScope): Promise<void>;
}

const codeOf = (e: unknown): TeamErrorCode => (e instanceof TeamPortError ? e.code : 'unavailable');

/**
 * Offline-first store: it starts from the cached snapshot (`peek`), refreshes in the background and never blocks the
 * screen. Writes apply optimistically to the local snapshot and are rolled back by the next load when refused.
 */
export function createTeamStore(port: TeamPort): TeamStore {
  const cached = port.peek();
  let state: TeamState = {
    status: cached ? 'ready' : 'loading',
    data: cached,
    error: null,
    busy: false,
  };
  const subs = new Set<() => void>();
  const set = (p: Partial<TeamState>) => {
    state = { ...state, ...p };
    subs.forEach((f) => f());
  };
  const now = () => port.now?.() ?? Date.now();

  async function load() {
    try {
      const data = await port.load();
      set({ status: 'ready', data, error: null });
    } catch (e) {
      set({ status: state.data ? 'ready' : 'failed', error: codeOf(e) });
    }
  }

  async function run(fn: () => Promise<void>) {
    set({ busy: true });
    try {
      await fn();
    } finally {
      set({ busy: false });
    }
    await load();
  }

  return {
    getState: () => state,
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    load,
    async invite(raw) {
      const email = raw.trim().toLowerCase();
      if (!isEmail(email)) return { ok: false, error: 'invalid-email' };
      const d = state.data;
      if (
        d &&
        (d.invites.some((i) => i.email === email) || d.members.some((m) => m.email === email))
      )
        return { ok: false, error: 'exists' };
      set({ busy: true });
      let url: string;
      try {
        ({ url } = await port.invite(email));
      } catch (e) {
        set({ busy: false });
        return { ok: false, error: codeOf(e) };
      }
      if (d)
        set({
          data: {
            ...d,
            invites: [
              ...d.invites,
              { id: `local-${email}`, email, role: inviteeRole(d.me.role), sentAt: now(), url },
            ],
          },
        });
      set({ busy: false });
      void load();
      return { ok: true, url };
    },
    revokeInvite: (id) =>
      run(async () => {
        const d = state.data;
        if (d) set({ data: { ...d, invites: d.invites.filter((i) => i.id !== id) } });
        await port.revokeInvite(id);
      }),
    removeMember: (uid) =>
      run(async () => {
        const d = state.data;
        if (d) set({ data: { ...d, members: d.members.filter((m) => m.uid !== uid) } });
        await port.removeMember(uid);
      }),
    leave: () => run(() => port.leave()),
    setActivityScope: (uid, scope) =>
      run(async () => {
        const d = state.data;
        if (d)
          set({
            data: {
              ...d,
              members: d.members.map((m) => (m.uid === uid ? { ...m, activityScope: scope } : m)),
            },
          });
        await port.setActivityScope(uid, scope);
      }),
  };
}
