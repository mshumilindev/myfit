import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { setLocale } from '../client/src/i18n';

process.env.GYM_DATA_DIR ??= fs.mkdtempSync(path.join(os.tmpdir(), 'gym-vitest-'));
process.env.GYM_JWT_SECRET ??= 'test-secret';
process.env.PORT ??= '0';

beforeEach(() => {
  localStorage.clear();
  setLocale('en');
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value: true,
  });
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
