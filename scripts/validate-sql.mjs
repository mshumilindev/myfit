// Validates every SQL statement in server/src against the real schema,
// using Node's built-in node:sqlite (no deps needed). Extracts db.exec(`...`)
// schema from db.ts and every db.prepare('...' | `...`) from the source files.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(here, '..', 'server', 'src');

const dbTs = fs.readFileSync(path.join(srcDir, 'db.ts'), 'utf8');
const schemaMatch = dbTs.match(/db\.exec\(`([\s\S]*?)`\)/);
if (!schemaMatch) throw new Error('schema not found in db.ts');

const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON');
db.exec(schemaMatch[1]);
console.log('schema: OK');

let total = 0,
  failed = 0;
for (const file of fs.readdirSync(srcDir).filter((f) => f.endsWith('.ts'))) {
  const src = fs.readFileSync(path.join(srcDir, file), 'utf8');
  // db.prepare('...') | db.prepare("...") | db.prepare(`...`)
  const re = /\.prepare\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`([\s\S]*?)`)\s*,?\s*\)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const sql = (m[1] ?? m[2] ?? m[3]).replace(/\\'/g, "'");
    total++;
    try {
      db.prepare(sql);
    } catch (err) {
      failed++;
      console.error(
        `FAIL ${file}: ${err.message}\n  SQL: ${sql.replace(/\s+/g, ' ').slice(0, 120)}`,
      );
    }
  }
}
console.log(`prepared statements: ${total} checked, ${failed} failed`);
process.exit(failed ? 1 : 0);
