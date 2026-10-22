/**
 * SPO-146: the edge back-swipe out of the Atlas chat (an overlay over Today) must show the destination ONCE, and the page
 * must sit at x = 0 when the gesture is over. Drives real touch events through CDP on the production build.
 * Needs a built client (see today-layout-shift.e2e.ts for E2E_TODAY_URL / E2E_TODAY_DIST).
 */
import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { arm, makeHarness, passProfileGate, type Stub } from './helpers/layout-shift';

const harness = makeHarness(4178);
const BASE = harness.base;

test.beforeAll(async () => {
  await harness.start();
});
test.afterAll(() => harness.stop());

interface Snap {
  hash: string;
  scrollX: number;
  docScrollLeft: number;
  todayPages: { left: number; width: number; visible: boolean }[];
  over: string | null;
  under: string | null;
  overRect: number | null;
  underRect: number | null;
  stageSwipe: boolean;
  atlas: number;
}
const snap = (page: Page): Promise<Snap> =>
  page.evaluate(() => {
    const el = (s: string) => document.querySelector<HTMLElement>(s);
    const over = el('.over-layer');
    const under = el('.under-layer');
    return {
      hash: location.hash,
      scrollX: window.scrollX,
      docScrollLeft: document.scrollingElement?.scrollLeft ?? 0,
      todayPages: [...document.querySelectorAll<HTMLElement>('.today-page')].map((n) => {
        const r = n.getBoundingClientRect();
        return { left: Math.round(r.left), width: Math.round(r.width), visible: r.width > 0 };
      }),
      over: over ? over.style.transform : null,
      under: under ? under.style.transform : null,
      overRect: over ? Math.round(over.getBoundingClientRect().left) : null,
      underRect: under ? Math.round(under.getBoundingClientRect().left) : null,
      stageSwipe: !!el('.screen-stage[data-back-swipe]'),
      atlas: document.querySelectorAll('.atl-chat, .coach-view, [class*="atl-"]').length,
    };
  });

async function touch(
  cdp: CDPSession,
  type: 'touchStart' | 'touchMove' | 'touchEnd',
  x: number,
  y: number,
) {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }],
  });
}

for (const route of ['#/coach', '#/trainer/chat'])
  test(`edge back-swipe out of ${route}`, async ({ page, context }, info) => {
    test.setTimeout(160_000);
    const stub: Stub = { delayMs: 0, assignment: false };
    await arm(page, stub, BASE, 'en');
    await page.goto(BASE + '/');
    await passProfileGate(page);
    await page.evaluate((r) => {
      location.hash = r;
    }, route);
    await page.waitForTimeout(1500);
    const before = await snap(page);
    console.log('OPENED', JSON.stringify(before));
    await page.screenshot({ path: info.outputPath('0-open.png') });

    const cdp = await context.newCDPSession(page);
    const y = 400;
    await touch(cdp, 'touchStart', 4, y);
    for (const x of [10, 24, 50, 90, 140, 190]) {
      await touch(cdp, 'touchMove', x, y);
      await page.waitForTimeout(40);
    }
    const mid = await snap(page);
    console.log('MID', JSON.stringify(mid));
    await page.screenshot({ path: info.outputPath('1-mid.png') });
    await touch(cdp, 'touchEnd', 190, y);
    await page.waitForTimeout(900);
    const after = await snap(page);
    console.log('AFTER', JSON.stringify(after));
    await page.screenshot({ path: info.outputPath('2-after.png') });

    expect(after.scrollX).toBe(0);
    expect(after.docScrollLeft).toBe(0);
    expect(after.stageSwipe).toBe(false);
    expect(after.todayPages.filter((p) => p.visible).length).toBe(1);
    expect(after.todayPages[0]?.left).toBe(0);
    expect(mid.todayPages.filter((p) => p.visible).length).toBeLessThanOrEqual(1);
  });
