import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// SPO-109: a ClientAvatar without `hasPhoto` can only ever show initials. Every use in the Coach UI passes the
// roster's flag (a client with no photo / without the app gets `false` from the server, so initials are the fallback).
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory()
      ? walk(p)
      : /\.tsx$/.test(f) && !/\.(test|stories)\./.test(f)
        ? [p]
        : [];
  });

describe('every ClientAvatar in the Coach UI gets hasPhoto', () => {
  const files = [...walk(join(__dirname)), ...walk(join(__dirname, '../today'))];
  const uses: { file: string; tag: string }[] = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/<ClientAvatar\b[\s\S]*?\/>/g)) uses.push({ file, tag: m[0] });
  }
  it('finds the uses (the guard is not vacuous)', () => expect(uses.length).toBeGreaterThan(15));
  it('none forgets the flag', () => {
    const missing = uses.filter((u) => !/hasPhoto=/.test(u.tag) && !/\{\.\.\./.test(u.tag));
    expect(missing.map((u) => u.file.split('/src/')[1])).toEqual([]);
  });
});
