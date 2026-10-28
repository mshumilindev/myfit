/**
 * The Atlas chat in the account (SPO-392) is private: its rules may only ever mention the person themselves. A static
 * check on the real `firestore.rules`, no emulator — a coach, manager, delegate or admin clause here fails the build.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const text = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');

function block(start: string): string {
  const i = text.indexOf(start);
  expect(i, `${start} exists`).toBeGreaterThan(-1);
  let depth = 0;
  for (let j = text.indexOf('{\n', i); j < text.length; j++) {
    if (text[j] === '{') depth++;
    if (text[j] === '}' && --depth === 0) return text.slice(i, j + 1);
  }
  throw new Error('unbalanced');
}

describe.each(['match /atlasChat/{msgId}', 'match /meta/atlasChatState'])('%s', (start) => {
  const b = block(start);
  it('lets only the owner in', () => {
    const allows = b.match(/allow [^;]+;/gs) ?? [];
    expect(allows.length).toBeGreaterThan(0);
    for (const a of allows) expect(a).toContain('isSelf(userId)');
  });
  it('has no coach, trainer, manager, delegate or admin clause', () => {
    expect(b).not.toMatch(/coach|trainer|manager|delegate|admin|isAdmin|grants/i);
  });
  it('accepts only sealed documents', () => {
    expect(b).toContain('dekEnc(');
  });
});
