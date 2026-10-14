import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** The rules file under test (vitest runs from the repository root; `new URL` does not work under jsdom). */
export const RULES_SOURCE = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');
