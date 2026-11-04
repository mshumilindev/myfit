import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // One emulator, shared state: the suites call clearFirestore() and must not run at the same time.
    fileParallelism: false,
    include: ['tests/rules/coach.rules.test.ts', 'tests/rules/ownerData.emulator.test.ts'],
  },
});
