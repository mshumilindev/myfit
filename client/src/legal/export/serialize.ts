/** Turns an export file into text in slices, giving the UI a turn between slices (a long history must not freeze the page). */
import { csvLine } from './csv';
import type { ExportContent } from './exportModel';

export type Tick = () => Promise<void>;

/** Lets the browser paint and handle input. */
export const nextTurn: Tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const SLICE = 400;

export async function contentToText(c: ExportContent, tick: Tick = nextTurn): Promise<string> {
  if (c.kind === 'json') {
    const v = c.value;
    if (!Array.isArray(v) || v.length <= SLICE) return `${JSON.stringify(v, null, 2)}\n`;
    const parts: string[] = [];
    for (let i = 0; i < v.length; i += SLICE) {
      parts.push(
        v
          .slice(i, i + SLICE)
          .map((x) => JSON.stringify(x))
          .join(',\n'),
      );
      await tick();
    }
    return `[\n${parts.join(',\n')}\n]\n`;
  }
  const lines: string[] = [csvLine(c.header)];
  for (let i = 0; i < c.rows.length; i += SLICE) {
    for (const r of c.rows.slice(i, i + SLICE)) lines.push(csvLine(r));
    if (i + SLICE < c.rows.length) await tick();
  }
  return `${lines.join('\r\n')}\r\n`;
}
