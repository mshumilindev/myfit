import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ChatPage, ChatShell } from './ChatShell';

afterEach(cleanup);

const css = readFileSync(join(__dirname, 'ChatShell.css'), 'utf8');
const rule = (sel: string) => {
  const m = css.match(new RegExp(`(?:^|\\n)${sel.replace('.', '\\.')} \\{([^}]*)\\}`));
  return m ? m[1] : '';
};

describe('chat layout contract (SPO-115 / SPO-120)', () => {
  it('the shell draws the composer in its own .chs-foot, nothing else pads it', () => {
    const { container } = render(
      <ChatShell head={<i />} foot={<b data-testid="c" />}>
        <p />
      </ChatShell>,
    );
    const foot = container.querySelector('.chs-foot')!;
    expect(foot.firstElementChild?.getAttribute('data-testid')).toBe('c');
  });

  it('composer room is set once: sides, bottom and the phone safe area', () => {
    expect(rule('.chs-foot')).toMatch(/padding:\s*var\(--s-12\) var\(--s-16\) var\(--s-16\)/);
    expect(css).toMatch(
      /\.chs-foot \{\s*padding: var\(--s-8\) var\(--s-8\) calc\(var\(--s-8\) \+ env\(safe-area-inset-bottom/,
    );
  });

  it('ChatPage owns the desktop gutter on all four sides (bottom included) and none on a phone', () => {
    expect(css).toMatch(/@media \(min-width: 720px\) \{\s*\.chs-page \{\s*padding: var\(--s-16\);/);
    expect(rule('.chs-page')).not.toMatch(/padding/);
    const { container } = render(
      <ChatPage className="x">
        <i />
      </ChatPage>,
    );
    expect(container.firstElementChild?.className).toBe('chs-page x');
  });

  it('every screen chat uses the kit: Atlas and the client wrap in ChatPage, none restyles the frame', () => {
    const src = (p: string) => readFileSync(join(__dirname, p), 'utf8');
    for (const f of ['../../views/CoachView.tsx', '../../coach/client/screens/ClientChat.tsx']) {
      expect(src(f)).toContain('<ChatPage');
    }
    const atlasCss = src('../../styles.css');
    expect(atlasCss).not.toMatch(/\.atl-thread\s+\.chs-(foot|wrap|body)\s*\{/);
    expect(src('../../coach/chat/core/ThreadParts.tsx')).not.toContain('ch-comp');
  });

  it('the Coach shell is a phone up to 767: its chat is edge to edge there, not a card in a gutter', () => {
    expect(css).toMatch(
      /@media \(min-width: 720px\) and \(max-width: 767px\) \{[^@]*\.chs--coach\.uicard[^@]*border-radius: 0/,
    );
    const { container } = render(
      <ChatShell breakpoint="coach" head={<i />}>
        <p />
      </ChatShell>,
    );
    expect(container.querySelector('.chs')?.classList.contains('chs--coach')).toBe(true);
    const chatCss = readFileSync(join(__dirname, '../../coach/chat/Chat.css'), 'utf8');
    expect(chatCss).toMatch(/@media \(max-width: 767px\) \{\s*\.co-main:has\(\.ch-page--thread\)/);
  });
});
