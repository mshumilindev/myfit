/**
 * Daily job (SPO-408): refreshes the refused areas of Ukraine that the edge Worker reads from Cloudflare KV
 * (logic and checks in `occupiedSyncCore.ts`). Off until configured: with no source URL it does nothing.
 *
 * Setup (owner): params `OCCUPIED_SOURCE_URL`, `CLOUDFLARE_ACCOUNT_ID`, `OCCUPIED_KV_NAMESPACE_ID` (not secret) and the
 * secret `CLOUDFLARE_KV_TOKEN` (token limited to Workers KV Storage: Edit). The secret must exist before this function
 * is deployed. Steps: docs/plans/SPO-408-dev-plan.md.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret, defineString } from 'firebase-functions/params';
import { db } from './lib';
import {
  syncOccupied,
  type JournalEntry,
  type OccupiedPorts,
  type Stats,
} from './occupiedSyncCore';

const CLOUDFLARE_KV_TOKEN = defineSecret('CLOUDFLARE_KV_TOKEN');
const SOURCE_URL = defineString('OCCUPIED_SOURCE_URL', { default: '' });
const SOURCE_NAME_PATTERN = defineString('OCCUPIED_NAME_PATTERN', { default: '' });
const ACCOUNT_ID = defineString('CLOUDFLARE_ACCOUNT_ID', { default: '' });
const NAMESPACE_ID = defineString('OCCUPIED_KV_NAMESPACE_ID', { default: '' });

/** Same key the Worker reads (`edge/geo-block/src/config.ts`). */
const KV_KEY = 'occupied-geojson';
const STATE = 'system/occupiedAreas';
const FETCH_TIMEOUT_MS = 20_000;

export interface OccupiedConfig {
  sourceUrl: string;
  namePattern: string;
  accountId: string;
  namespaceId: string;
  token: string;
}

export const configured = (c: OccupiedConfig): boolean =>
  Boolean(c.sourceUrl && c.accountId && c.namespaceId && c.token);

export function kvValueUrl(accountId: string, namespaceId: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/storage/kv/namespaces/${encodeURIComponent(namespaceId)}/values/${KV_KEY}`;
}

export function occupiedPorts(c: OccupiedConfig, doFetch: typeof fetch = fetch): OccupiedPorts {
  return {
    namePattern: c.namePattern || undefined,
    async fetchSource() {
      const r = await doFetch(c.sourceUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!r.ok) throw new Error(`source-${r.status}`);
      return r.text();
    },
    async current() {
      const s = (await db.doc(STATE).get()).data() as { hash?: string; stats?: Stats } | undefined;
      return s?.hash && s.stats ? { hash: s.hash, stats: s.stats } : null;
    },
    async publish(raw) {
      const r = await doFetch(kvValueUrl(c.accountId, c.namespaceId), {
        method: 'PUT',
        headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
        body: raw,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!r.ok) throw new Error(`kv-${r.status}`);
    },
    async record(e: JournalEntry) {
      const id = String(e.at);
      const entry = JSON.parse(JSON.stringify(e)) as JournalEntry;
      await db.doc(`${STATE}/versions/${id}`).set(entry);
      const state: Record<string, unknown> = { lastRunAt: e.at, lastOutcome: e.outcome };
      if (e.outcome !== 'rejected') {
        state.lastOkAt = e.at;
        if (e.outcome === 'accepted') Object.assign(state, { hash: e.hash, stats: e.stats });
      }
      await db.doc(STATE).set(state, { merge: true });
    },
    async lastOk() {
      const s = (await db.doc(STATE).get()).data() as { lastOkAt?: number } | undefined;
      return typeof s?.lastOkAt === 'number' ? s.lastOkAt : null;
    },
    alert: (m) => console.error(m),
  };
}

export const syncOccupiedAreas = onSchedule(
  { schedule: 'every 24 hours', secrets: [CLOUDFLARE_KV_TOKEN], timeoutSeconds: 120 },
  async () => {
    const cfg: OccupiedConfig = {
      sourceUrl: SOURCE_URL.value(),
      namePattern: SOURCE_NAME_PATTERN.value(),
      accountId: ACCOUNT_ID.value(),
      namespaceId: NAMESPACE_ID.value(),
      token: CLOUDFLARE_KV_TOKEN.value(),
    };
    if (!configured(cfg)) {
      console.log('[occupied] not configured, skipped');
      return;
    }
    const r = await syncOccupied(occupiedPorts(cfg), Date.now());
    console.log(`[occupied] ${r.outcome}${r.reason ? ` (${r.reason})` : ''}`);
  },
);
