/**
 * Read log (R-FE-061 / S-31): every time the coach opens client data the read is logged and the client can see
 * it ("Reads are logged and visible to the client"). One entry per category per tab OPEN, never per render.
 *
 * The real adapter (`data/firestore/readLogPort.ts`) calls the `coachLogRead` callable. `localReadLog` keeps the
 * entries in memory (before the real adapter is installed, and in tests); nothing leaves the device.
 */
import { useEffect, useRef } from 'react';
import type { Category } from '../domain/types';

export type ReadVia = 'view' | 'export';
export interface ReadEntry {
  clientId: string;
  category: Category;
  via: ReadVia;
}

export interface ReadLogPort {
  /** Fire and forget: must never throw into the UI, never block it. */
  logRead(entry: ReadEntry): void;
}

export function createLocalReadLog(): ReadLogPort & { entries: readonly ReadEntry[] } {
  const entries: ReadEntry[] = [];
  return {
    entries,
    logRead(e) {
      entries.push(e);
    },
  };
}

/** Session-wide default port (replaced by the real adapter via `configureReadLog`). */
export const localReadLog = createLocalReadLog();
let active: ReadLogPort | null = null;
/** Install the real adapter (`firestore/readLogPort.ts`); pass null to go back to the local one. */
export function configureReadLog(p: ReadLogPort | null): void {
  active = p;
}

/**
 * Logs the categories once when `key` (client + tab) changes, i.e. once per tab open. `skip` = nothing was read
 * (locked / program-only), so nothing is logged.
 */
export function useReadLog(
  port: ReadLogPort | undefined,
  clientId: string,
  tab: string,
  categories: readonly Category[],
  skip = false,
): void {
  const done = useRef<string>('');
  const key = `${clientId}|${tab}`;
  const cats = categories.join(',');
  useEffect(() => {
    if (skip || done.current === `${key}|${cats}`) return;
    done.current = `${key}|${cats}`;
    const p = port ?? active ?? localReadLog;
    try {
      for (const c of cats.split(',').filter(Boolean)) {
        p.logRead({ clientId, category: c as Category, via: 'view' });
      }
    } catch {
      /* the log must never break the screen */
    }
  }, [port, key, cats, clientId, skip]);
}
