#!/usr/bin/env node
/* global document, getComputedStyle, innerWidth */
/**
 * Chat layout contract (SPO-115 / SPO-120): the trainer's, the client's and Atlas's chat are ONE frame, so at every width
 * they must have the same composer room, the composer and its send button fully inside the frame, messages that are not
 * squeezed into a narrow column, and no sideways scroll. Measures real geometry in Storybook (not a screenshot).
 *
 *   npm run build-storybook && npx http-server client/storybook-static -p 6006 &
 *   npm run audit:chat -- --url http://127.0.0.1:6006 --widths 320,390,768,1440
 * Exit code 1 on any violation.
 */
import { chromium } from '@playwright/test';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const url = arg('url', 'http://127.0.0.1:6006');
const widths = arg('widths', '320,360,390,768,1024,1440,1920').split(',').map(Number);
const locales = arg('locales', 'en,uk,pl,lt,et').split(',');
const STORIES = [
  'pages-coach-chat--thread-phone', // trainer (thread open at every width)
  'pages-coach-client--chat', // client
  'pages-coach-client--chat-notes',
  'pages-atlas-chat--merciless', // Atlas, three tempers
  'pages-atlas-chat--blunt',
  'pages-atlas-chat--warm',
  'pages-atlas-chat--one-chip',
  'pages-atlas-chat--five-chips',
];

const probe = () => {
  const r = (el) => el?.getBoundingClientRect();
  const foot = document.querySelector('.chs-foot');
  const shell = document.querySelector('.chs');
  const body = document.querySelector('.chs-body');
  const comp = document.querySelector('.uicomp');
  const send = comp?.querySelector('button:last-of-type');
  if (!foot || !shell || !comp) return { missing: true };
  const f = r(foot);
  const c = r(comp);
  const s = r(send);
  const cs = getComputedStyle(foot);
  const bodyW = r(body).width;
  const bubbles = [...document.querySelectorAll('.uibub')].map((b) => r(b).width);
  return {
    pad: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map((v) =>
      Math.round(parseFloat(v)),
    ),
    gapL: Math.round(c.left - f.left),
    gapR: Math.round(f.right - c.right),
    gapB: Math.round(f.bottom - c.bottom),
    sendInside: !!s && s.right <= c.right + 0.5 && s.left >= c.left - 0.5,
    shellGutter: [Math.round(r(shell).left), Math.round(innerWidth - r(shell).right)],
    widest: Math.round(Math.max(0, ...bubbles)),
    bodyW: Math.round(bodyW),
    // action buttons (share, reschedule...) live in the composer row, never in a row of their own above the field
    actionAbove: comp.querySelectorAll('.uicomp-chips > .uibtn').length,
    rowTops: [...comp.querySelectorAll('.uicomp-row .uibtn, .uicomp-row .uicomp-field')].map((e) =>
      Math.round(r(e).bottom),
    ),
    // the long first message keeps a real bubble width (chips beside it used to squeeze it to a quarter)
    firstW: (() => {
      const b = document.querySelector('.uimsg .uibub');
      return b && b.textContent.length > 40 ? Math.round(r(b).width) : null;
    })(),
    // anything under a message row (chips, rating) sits below the bubble, not beside it
    belowBeside: [...document.querySelectorAll('.uimsg')].some((li) => {
      const row = li.querySelector('.uimsg-row');
      return [...li.children].some(
        (k) =>
          k !== row &&
          !k.matches('.uimsg-who, .uimsg-time') &&
          r(k).height > 0 &&
          r(k).top < r(row).bottom - 1,
      );
    }),
    hscroll: document.documentElement.scrollWidth - innerWidth,
  };
};

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] }
    : {},
);
const problems = [];
for (const w of widths) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: 800 },
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  for (const loc of locales) {
    const results = {};
    for (const id of STORIES) {
      await page.goto(`${url}/iframe.html?id=${id}&viewMode=story&globals=locale:${loc}`, {
        waitUntil: 'load',
      });
      await page.waitForSelector('.chs-foot, .uicomp', { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(500);
      const m = await page.evaluate(probe);
      results[id] = m;
      const at = `${id} @${w}px ${loc}`;
      if (m.actionAbove)
        problems.push(
          `${at}: an action button sits in a row above the field, not in the composer row`,
        );
      if (m.rowTops && Math.max(...m.rowTops) - Math.min(...m.rowTops) > 2)
        problems.push(`${at}: composer buttons and field are not on one line (${m.rowTops})`);
      if (m.belowBeside) problems.push(`${at}: chips / extras sit beside the bubble, not under it`);
      if (m.firstW !== null && m.firstW < Math.min(0.5 * m.bodyW, 200))
        problems.push(`${at}: first message squeezed to ${m.firstW}px in a ${m.bodyW}px list`);
      if (m.missing) {
        problems.push(`${at}: no .chs-foot / .uicomp (the chat did not render)`);
        continue;
      }
      if (m.hscroll > 0) problems.push(`${at}: page scrolls sideways by ${m.hscroll}px`);
      if (!m.sendInside) problems.push(`${at}: the send button sticks out of the composer`);
      if (m.gapL < m.pad[3] - 1 || m.gapR < m.pad[1] - 1)
        problems.push(
          `${at}: composer closer to the side than the frame padding (${m.gapL}/${m.gapR} < ${m.pad})`,
        );
      if (m.gapB < Math.min(m.pad[2], 8) - 1)
        problems.push(`${at}: no room under the composer (${m.gapB}px)`);
      if (m.widest < Math.min(0.6 * m.bodyW, 280))
        problems.push(`${at}: messages squeezed (widest ${m.widest}px in a ${m.bodyW}px list)`);
    }
    // the three chats share one frame: same composer room and shell gutter at this width
    const ref = results[STORIES[1]];
    for (const id of STORIES) {
      const m = results[id];
      if (m.missing || ref.missing) continue;
      if (JSON.stringify(m.pad) !== JSON.stringify(ref.pad))
        problems.push(
          `${id} @${w}px ${loc}: composer padding ${m.pad} differs from the client chat ${ref.pad}`,
        );
      if (
        id.startsWith('pages-atlas') &&
        JSON.stringify(m.shellGutter) !== JSON.stringify(ref.shellGutter)
      )
        problems.push(
          `${id} @${w}px ${loc}: frame gutter ${m.shellGutter} differs from the client chat ${ref.shellGutter}`,
        );
    }
  }
  await ctx.close();
}
await browser.close();
console.log(
  `chat layout: ${STORIES.length} stories x ${locales.length} locales x ${widths.length} widths, ${problems.length} problems`,
);
for (const p of problems.slice(0, 60)) console.log(` - ${p}`);
process.exit(problems.length ? 1 : 0);
