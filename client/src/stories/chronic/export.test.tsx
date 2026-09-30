import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { writeFileSync, mkdirSync } from 'node:fs';
import { test, vi } from 'vitest';

vi.mock('react-dom', async (orig) => ({
  ...(await orig<typeof import('react-dom')>()),
  createPortal: (c: unknown) => c,
}));

const OUT = process.env.CHRONIC_OUT ?? '/tmp/chronic-out';
test('export', async () => {
  mkdirSync(OUT, { recursive: true });
  const mods = await Promise.all([import('./flow')]);
  for (const m of mods) {
    for (const [name, fn] of Object.entries(m)) {
      if (typeof fn !== 'function') continue;
      const host = document.createElement('div');
      document.body.appendChild(host);
      const root = createRoot(host);
      flushSync(() => root.render((fn as () => import('react').ReactElement)()));
      writeFileSync(`${OUT}/${name}.html`, host.innerHTML);
      root.unmount();
      host.remove();
    }
  }
});
