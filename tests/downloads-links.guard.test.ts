import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * SPO-170: installer links come from client/src/downloads.ts only. A hard-coded tokenized Storage URL breaks the
 * moment the file is re-uploaded (new token), so no other source file may spell one out.
 */
const srcFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return srcFiles(p);
    return /\.(tsx?|css)$/.test(p) && !/\.test\.tsx?$/.test(p) ? [p] : [];
  });

describe('installer links have one source', () => {
  it('no source file except downloads.ts embeds a firebasestorage download URL', () => {
    const bad = srcFiles('client/src').filter(
      (f) =>
        !f.endsWith('downloads.ts') &&
        /firebasestorage\.googleapis\.com\/v0\/b\/[^'"`\s]+\/o\/downloads/i.test(
          readFileSync(f, 'utf8'),
        ),
    );
    expect(bad).toEqual([]);
  });
});
