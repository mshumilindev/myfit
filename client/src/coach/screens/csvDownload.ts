import { csvText } from '../domain/csv';

/** Browser download of a CSV (UTF-8 with BOM so spreadsheets read accents). Never throws into the UI. */
export function downloadCsv(
  filename: string,
  header: readonly string[],
  rows: readonly (readonly string[])[],
): void {
  try {
    const blob = new Blob(['﻿', csvText(header, rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    /* download is best effort (jsdom / blocked) */
  }
}

/** File-name safe first name: lower case, ascii letters and digits only. */
export const fileSlug = (s: string): string =>
  s
    .normalize('NFKD')
    .replace(/[^\w]+/g, '')
    .toLowerCase() || 'client';
