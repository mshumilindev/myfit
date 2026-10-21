/**
 * SPO-236: the service worker puts the push payload's `url` on the notification and opens exactly that screen on tap
 * (the client's Spotter `#/trainer/spotter`, a trainer's / manager's `#/c/spotter`). Runs the real public/sw-push.js
 * in a sandbox with a fake worker scope.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

type Handler = (e: Record<string, unknown>) => void;
const ORIGIN = 'https://spotter.test';

function boot(wins: Array<{ focus: () => Promise<void>; navigate: (u: string) => Promise<void> }>) {
  const handlers: Record<string, Handler> = {};
  const shown: Array<{ title: string; opts: { data: { url: string }; tag?: string } }> = [];
  const openWindow = vi.fn(async () => undefined);
  const self = {
    location: { origin: ORIGIN },
    indexedDB: undefined,
    navigator: {},
    addEventListener: (n: string, h: Handler) => (handlers[n] = h),
    registration: {
      showNotification: async (title: string, opts: { data: { url: string }; tag?: string }) => {
        shown.push({ title, opts });
      },
    },
    clients: { matchAll: async () => wins, openWindow },
  };
  const src = readFileSync(join(__dirname, '../public/sw-push.js'), 'utf8');
  vm.runInNewContext(src, { self, URL, Date, Number, Promise });
  return { handlers, shown, openWindow };
}
const pushEvent = (data: unknown) => {
  let done: Promise<unknown> = Promise.resolve();
  return {
    e: {
      data: { json: () => ({ data }) },
      waitUntil: (p: Promise<unknown>) => (done = p),
    },
    done: () => done,
  };
};
const clickEvent = (url: string) => {
  let done: Promise<unknown> = Promise.resolve();
  return {
    e: {
      notification: { close: vi.fn(), data: { url } },
      waitUntil: (p: Promise<unknown>) => (done = p),
    },
    done: () => done,
  };
};

describe('push deep link (SPO-236)', () => {
  it.each(['/#/trainer/spotter', '/#/c/spotter'])(
    'keeps the payload url %s on the notification',
    async (url) => {
      const { handlers, shown } = boot([]);
      const p = pushEvent({ title: 'Spotter', body: 'x', tag: 'request', url });
      handlers.push(p.e);
      await p.done();
      expect(shown).toHaveLength(1);
      expect(shown[0].opts.data.url).toBe(url);
    },
  );

  it('a push without url opens the home page', async () => {
    const { handlers, shown } = boot([]);
    const p = pushEvent({ title: 'Spotter', body: 'x' });
    handlers.push(p.e);
    await p.done();
    expect(shown[0].opts.data.url).toBe('/');
  });

  it('a tap with no open window opens the Spotter hash', async () => {
    const { handlers, openWindow } = boot([]);
    const c = clickEvent('/#/trainer/spotter');
    handlers.notificationclick(c.e);
    await c.done();
    expect(openWindow).toHaveBeenCalledWith(`${ORIGIN}/#/trainer/spotter`);
  });

  it('a tap with an open window focuses it and navigates to the Spotter hash', async () => {
    const win = { focus: vi.fn(async () => undefined), navigate: vi.fn(async () => undefined) };
    const { handlers, openWindow } = boot([win]);
    const c = clickEvent('/#/c/spotter');
    handlers.notificationclick(c.e);
    await c.done();
    expect(win.focus).toHaveBeenCalled();
    expect(win.navigate).toHaveBeenCalledWith(`${ORIGIN}/#/c/spotter`);
    expect(openWindow).not.toHaveBeenCalled();
  });
});
