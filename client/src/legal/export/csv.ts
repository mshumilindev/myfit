/** CSV text for the export (RFC 4180 quoting). Cells that a spreadsheet would run as a formula are neutralised. */
const FORMULA = /^[=+\-@\t\r]/;

export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  let s = typeof v === 'string' ? v : JSON.stringify(v);
  if (FORMULA.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const csvLine = (cells: readonly unknown[]): string => cells.map(csvCell).join(',');

export function toCsv(header: readonly string[], rows: readonly (readonly unknown[])[]): string {
  return `${[csvLine(header), ...rows.map(csvLine)].join('\r\n')}\r\n`;
}

/** ISO 8601 UTC time of an epoch-ms value; empty for a missing or invalid one. */
export function isoTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '';
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}
