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

/** `file.js:12:5` (line and column are required, so a bare word that happens to end in .js is never taken for a frame). */
const FILE_AT_RE = /^(.*?)(?::\d+){1,2}$/;

/** Base name of a `url:line:col` token, or '' when it is not one. Linear: no nested quantifiers. */
function frameFile(token: string): string {
  if (!/:\d+(?::\d+)?$/.test(token)) return '';
  const base = (FILE_AT_RE.exec(token)?.[1] ?? '').split('/').pop() ?? '';
  return FILE_EXT_RE.test(base) && SAFE_NAME_RE.test(base.replace(/-/g, '_')) ? base : '';
}

/**
 * Linear-time stack masking. Only real engine frames are kept: V8 `at fn (url:line:col)` / `at url:line:col`, and Firefox/Safari
 * `fn@url:line:col`. Anything else (the message lines of a stack, free text) is dropped. A frame keeps a safe function name and the
 * file's base name; origins and paths never leave.
 */
export function maskStack(stack: unknown): string {
  const lines = String(stack ?? '')
    .slice(0, MAX_LINES * MAX_LINE)
    .split('\n')
    .slice(0, MAX_LINES);
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim().slice(0, MAX_LINE);
    let fn = '';
    let loc: string;
    if (line.startsWith('at ')) {
      const rest = line.slice(3);
      const open = rest.lastIndexOf('(');
      if (open >= 0 && rest.endsWith(')')) {
        fn = rest.slice(0, open).trim();
        loc = rest.slice(open + 1, -1);
      } else loc = rest;
    } else if (line.includes('@')) {
      const at = line.indexOf('@');
      fn = line.slice(0, at);
      loc = line.slice(at + 1);
    } else continue;
    const file = frameFile(loc.split(/\s+/).pop() ?? '');
    if (!file) continue;
    out.push(`${SAFE_NAME_RE.test(fn) ? fn : '<anon>'} ${file}`);
  }
  return out.join('\n').slice(0, MAX_STACK);
}

/** Returns a clean report, or null when the payload is not a valid report (never throws). */
export function sanitizeReport(raw: unknown): ClientErrorReport | null {
  if (!raw || typeof raw !== 'object') return null;
  if (JSON.stringify(raw).length > MAX_BODY_BYTES) return null;
  const r = raw as Record<string, unknown>;
  if (!ERROR_KINDS.includes(r.kind as ErrorKind)) return null;
  return {
    kind: r.kind as ErrorKind,
    message: maskText(r.message, MAX_MESSAGE),
    stack: maskStack(r.stack),
    build: /^[\w.+-]{1,40}$/.test(String(r.build)) ? String(r.build) : 'unknown',
    locale: /^[a-z]{2}$/.test(String(r.locale)) ? String(r.locale) : 'xx',
    online: r.online === true,
  };
}
