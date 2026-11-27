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
const MAX_MESSAGE = 120;
const MAX_STACK = 1200;

const EMAIL_RE = /[^\s@]+(?:@|\s?\[at\]\s?)[^\s@]+/gi;
const QUOTED_RE = /"[^"]*"|'[^']*'|`[^`]*`/g;
const BRACES_RE = /\{[^}]*\}|\[[^\]]*\]/g;
const PATHISH_RE = /\S*\/\S*/g;
const TOKEN_RE = /\b[A-Za-z0-9_-]{16,}\b/g;
const DIGITS_RE = /\d+/g;
const MAX_LINES = 20;
const MAX_LINE = 200;
const SAFE_NAME_RE = /^[\w.$<>]{1,60}$/;
const FILE_EXT_RE = /\.(?:js|mjs|ts|tsx)$/;

/**
 * Best-effort masking (it cannot prove a free-text message holds no personal data): emails (also without a TLD), quoted
 * strings, bracketed/braced content, anything path-like, long tokens and every number. Every pattern is linear (no nested
 * quantifiers), and the input is cut to `max * 4` first, so a hostile string cannot cost CPU.
 */
export function maskText(text: unknown, max: number): string {
  return String(text ?? '')
    .slice(0, max * 4)
    .replace(EMAIL_RE, '<email>')
    .replace(QUOTED_RE, '<str>')
    .replace(BRACES_RE, '<obj>')
    .replace(PATHISH_RE, '<path>')
    .replace(TOKEN_RE, '<token>')
    .replace(DIGITS_RE, '<n>')
    .slice(0, max);
}

/** Linear-time stack masking: per line keep a safe function name and the file's base name; origins and paths are dropped. */
export function maskStack(stack: unknown): string {
  const lines = String(stack ?? '')
    .slice(0, MAX_LINES * MAX_LINE)
    .split('\n')
    .slice(0, MAX_LINES);
  const out: string[] = [];
  for (const line of lines) {
    const tokens = line
      .slice(0, MAX_LINE)
      .split(/[\s()@]+/)
      .filter(Boolean);
    if (tokens[0] === 'at') tokens.shift();
    let file = '';
    for (let i = tokens.length - 1; i >= 0 && !file; i -= 1) {
      const base =
        tokens[i]
          .replace(/(?::\d+)+$/, '')
          .split('/')
          .pop() ?? '';
      if (FILE_EXT_RE.test(base) && SAFE_NAME_RE.test(base.replace(/-/g, '_'))) file = base;
    }
    if (!file) continue;
    const first = tokens[0] ?? '';
    const fn = SAFE_NAME_RE.test(first) && !FILE_EXT_RE.test(first) ? first : '<anon>';
    out.push(`${fn} ${file}`);
  }
  return out.join('\n').slice(0, MAX_STACK);
}

/** Only the known top-level segment of a route survives; ids, names and anything else become `:x`. */
function maskRoute(route: string): string {
  const parts = route.split('/').filter(Boolean).slice(0, 4);
  return `/${parts.map((p, i) => (i === 0 && /^[a-z-]{1,20}$/.test(p) ? p : ':x')).join('/')}`;
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
    build: /^[\w.+-]{1,40}$/.test(String(r.build)) ? String(r.build) : 'unknown',
    locale: /^[a-z]{2}$/.test(String(r.locale)) ? String(r.locale) : 'xx',
    route: maskRoute(route),
    online: r.online === true,
  };
}
