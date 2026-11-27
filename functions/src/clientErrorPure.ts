/**
 * SPO-639 (G1): sanitising a client error report. Pure (no firebase-admin), so it is unit-testable.
 * The report must carry no personal data: values are masked, stacks keep only file and function names.
 */

export const ERROR_KINDS = ['render', 'unhandledrejection', 'error', 'chunk'] as const;
export type ErrorKind = (typeof ERROR_KINDS)[number];

export interface ClientErrorReport {
  kind: ErrorKind;
  message: string;
  stack: string;
  build: string;
  locale: string;
  route: string;
  online: boolean;
}

export const MAX_BODY_BYTES = 4096;
const MAX_MESSAGE = 200;
const MAX_STACK = 1200;

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const TOKEN_RE = /\b[A-Za-z0-9_-]{24,}\b/g;
const NUMBER_RE = /\d{4,}/g;
const URL_PARAMS_RE = /([?#][^\s)'"]*)/g;

/** Masks emails, long tokens, long numbers and URL query/hash parts; trims to `max`. */
export function maskText(text: unknown, max: number): string {
  return String(text ?? '')
    .replace(EMAIL_RE, '<email>')
    .replace(URL_PARAMS_RE, '')
    .replace(TOKEN_RE, '<token>')
    .replace(NUMBER_RE, '<n>')
    .slice(0, max);
}

/** Keeps `at fn (file.js:line:col)` frames as `fn file.js`, dropping origins, paths and arguments. */
export function maskStack(stack: unknown): string {
  return String(stack ?? '')
    .split('\n')
    .map((line) => {
      const m = /^\s*(?:at\s+)?([^\s(@]*)\s*[(@]?.*?([\w.-]+\.(?:js|mjs|ts|tsx))/.exec(line);
      return m ? `${m[1] || '<anon>'} ${m[2]}` : '';
    })
    .filter(Boolean)
    .join('\n')
    .slice(0, MAX_STACK);
}

/** Returns a clean report, or null when the payload is not a valid report (never throws). */
export function sanitizeReport(raw: unknown): ClientErrorReport | null {
  if (!raw || typeof raw !== 'object') return null;
  if (JSON.stringify(raw).length > MAX_BODY_BYTES) return null;
  const r = raw as Record<string, unknown>;
  if (!ERROR_KINDS.includes(r.kind as ErrorKind)) return null;
  const route = String(r.route ?? '').split(/[?#]/)[0];
  return {
    kind: r.kind as ErrorKind,
    message: maskText(r.message, MAX_MESSAGE),
    stack: maskStack(r.stack),
    build: maskText(r.build, 40),
    locale: /^[a-z]{2}$/.test(String(r.locale)) ? String(r.locale) : 'xx',
    route: maskText(route, 80),
    online: r.online === true,
  };
}
