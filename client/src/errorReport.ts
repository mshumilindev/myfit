/**
 * SPO-639 (G2): anonymous crash reports. Sends `kind` + a message and stack the server masks again (functions/src/clientErrorPure.ts);
 * no uid, no storage contents. Never throws, never blocks: offline = dropped, at most one report per kind per minute.
 */
import type { ErrorKind } from '../../functions/src/clientErrorPure';

const THROTTLE_MS = 60_000;
const lastSent = new Map<ErrorKind, number>();

function isEngineError(e: unknown): e is Error {
  return (
    e instanceof TypeError ||
    e instanceof ReferenceError ||
    e instanceof RangeError ||
    e instanceof SyntaxError
  );
}

type Send = (payload: Record<string, unknown>) => Promise<void>;
const lazySend: Send = (payload) =>
  import('./errorReportTransport').then((m) => m.sendErrorReport(payload));

export function reportClientError(
  kind: ErrorKind,
  error: unknown,
  now = Date.now(),
  send: Send = lazySend,
): void {
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    if (now - (lastSent.get(kind) ?? 0) < THROTTLE_MS) return;
    lastSent.set(kind, now);
    const err = error as { message?: unknown; stack?: unknown } | undefined;
    const payload = {
      kind,
      // Only messages the JS engine itself writes (TypeError, ReferenceError, RangeError, SyntaxError) are sent: text the app or
      // a user put into `new Error(...)`, or a thrown string, may hold personal data.
      message: isEngineError(error) ? error.message : '',
      stack: String(err?.stack ?? ''),
      build: String(import.meta.env.VITE_APP_VERSION ?? 'dev'),
      locale: (document.documentElement.lang || 'en').slice(0, 2),
      online: true,
    };
    send(payload).catch(() => undefined);
  } catch {
    /* reporting must never break the app */
  }
}
