/**
 * SPO-392: the chat history in the account is for showing the same chat on every device. It is never part of what is
 * sent to an AI model. A static guard: the modules that build or send AI requests must not import the chat log or the
 * account sync.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const AI_MODULES = ['chatFacts.ts', 'puter.ts', 'useAtlasAi.ts', 'aiConsent.ts'];

describe('the Atlas chat history stays out of AI requests', () => {
  for (const f of AI_MODULES) {
    const p = resolve(__dirname, f);
    it(f, () => {
      if (!existsSync(p)) return;
      const src = readFileSync(p, 'utf8');
      expect(src).not.toMatch(/from ['"]\.\/chatLog['"]/);
      expect(src).not.toMatch(/from ['"]\.\/chatSync/);
      expect(src).not.toMatch(/AtlasHistoryHost/);
    });
  }
});
