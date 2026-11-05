/** Store kit icon paths (24x24 stroke icons), ported from the approved design. */
export const SK_ICON_PATHS = {
  disc: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  sync: 'M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3M18 3v4h-4M6 21v-4h4',
  down: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  alert: 'M12 4l9 16H3zM12 10v4M12 17.2v.1',
  apps: 'M8 4h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4zM15 12a3 3 0 1 0-6 0 3 3 0 0 0 6 0z',
  queue: 'M12 4v10M8 11l4 4 4-4M5.5 17h13a1.5 1.5 0 0 1 0 3h-13a1.5 1.5 0 0 1 0-3z',
  addons:
    'M6 4h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM15 4h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM6 13h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zM16.5 13v7M13 16.5h7',
  inst: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM8 12.5l3 3 5-6',
  search: 'M17.5 11a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0zM16 16l4 4',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  x: 'M6 6l12 12M18 6L6 18',
  bell: 'M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4',
  user: 'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM4 21c1-4 4-6 8-6s7 2 8 6',
  today:
    'M7 5h10a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3zM4 10h16M9 3v4M15 3v4',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  food: 'M7 3v8a2 2 0 0 0 2 2v8M11 3v8M7 7h4M17 21V3c-2 1-3 4-3 8h3',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  brush: 'M4 20c3 0 4-1 4-3 0-1.5 1-2 2-2l9-9a2.1 2.1 0 0 0-3-3l-9 9c0 1-.5 2-2 2-2 0-3 2-3 4z',
  users:
    'M12.5 8a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0zM2.5 20c.6-3.4 3-5 6.5-5s5.9 1.6 6.5 5M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .5 3.2 2 3.5 5',
  play: 'M8 5l11 7-11 7z',
} as const;
export type SkIconName = keyof typeof SK_ICON_PATHS;
