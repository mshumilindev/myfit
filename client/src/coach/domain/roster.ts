/**
 * Roster rows and the counts every screen shows. ONE derivation, so Roster, Today and Week cannot disagree
 * (R-FE-102, S-17 AC "counts equal Today and Week counts").
 */
import type { CoachClient, RosterStatus, Signal } from './types';

export interface RosterRow {
  client: CoachClient;
  status: RosterStatus;
  /** the top open signal of this client */
  topSignalKey: string | null;
  signalCount: number;
}

const ORDER: Record<RosterStatus, number> = { urgent: 0, watch: 1, good: 2, none: 3 };

export function statusOf(signals: readonly Signal[]): RosterStatus {
  if (signals.some((s) => s.severity === 'urgent')) return 'urgent';
  if (signals.some((s) => s.severity === 'watch')) return 'watch';
  if (signals.length) return 'good';
  return 'none';
}

/** Needs attention first; then by name for a stable order. Pending invites go last. */
export function buildRoster(
  clients: readonly CoachClient[],
  openSignals: readonly Signal[],
): RosterRow[] {
  const rows = clients.map((client): RosterRow => {
    const mine = openSignals.filter((s) => s.clientId === client.id);
    return {
      client,
      status: statusOf(mine),
      topSignalKey: mine[0]?.key ?? null,
      signalCount: mine.length,
    };
  });
  return rows.sort(
    (a, b) =>
      Number(!!a.client.invite) - Number(!!b.client.invite) ||
      ORDER[a.status] - ORDER[b.status] ||
      a.client.name.localeCompare(b.client.name),
  );
}

export interface RosterCounts {
  clients: number;
  needAttention: number;
  needDecision: number;
  weekDone: number;
  weekPlanned: number;
  live: number;
  pendingInvites: number;
}
export function countRoster(rows: readonly RosterRow[]): RosterCounts {
  const active = rows.filter((r) => !r.client.invite);
  return {
    clients: active.length,
    needAttention: active.filter((r) => r.status === 'urgent' || r.status === 'watch').length,
    needDecision: active.filter((r) => r.status === 'urgent').length,
    weekDone: active.reduce((a, r) => a + r.client.done, 0),
    weekPlanned: active.reduce((a, r) => a + r.client.planned, 0),
    live: active.filter((r) => r.client.live).length,
    pendingInvites: rows.length - active.length,
  };
}
