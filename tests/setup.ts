import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

process.env.GYM_DATA_DIR ??= fs.mkdtempSync(path.join(os.tmpdir(), 'gym-vitest-'));
process.env.GYM_JWT_SECRET ??= 'test-secret';
process.env.PORT ??= '0';

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value: true,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
