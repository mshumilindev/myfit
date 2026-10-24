import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { captureToday, clearTodaySnapshot } from '../data/todaySnapshot';
import { ThemesView } from './ThemesView';
import { setTheme } from '../themes';

const capture = (width: number) => {
  const el = document.createElement('div');
  el.className = 'screen today-page';
  el.innerHTML = '<b>Today</b>';
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: width });
  captureToday(el);
};
const stubBox = (width: number) =>
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.classList.contains('thm-pv') ? width : 0;
  });

beforeEach(() => setLocale('en'));
afterEach(() => {
  cleanup();
  clearTodaySnapshot();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ThemesView with a captured Today', () => {
  it('shows an inert, aria-hidden copy of Today scaled to the preview box', () => {
    capture(400);
    stubBox(200);
    const { container } = render(<ThemesView onClose={vi.fn()} />);
    const pv = container.querySelector('.thm-pv-in') as HTMLElement;
    expect(pv.getAttribute('aria-hidden')).toBe('true');
    expect(pv.hasAttribute('inert')).toBe(true);
    expect(pv.innerHTML).toContain('<b>Today</b>');
    expect(pv.style.width).toBe('400px');
    expect(pv.style.transform).toBe('scale(0.5)');
    expect(pv.style.opacity).toBe('1');
    expect(screen.getByRole('img', { name: en.themesPreviewAlt })).toBeTruthy();
    expect(container.querySelector('.thm-pv .uitile, .thm-pv svg')).toBeNull();
  });

  it('a screen narrower than 320 px is captured at 320', () => {
    capture(100);
    stubBox(160);
    const { container } = render(<ThemesView onClose={vi.fn()} />);
    expect((container.querySelector('.thm-pv-in') as HTMLElement).style.width).toBe('320px');
    expect((container.querySelector('.thm-pv-in') as HTMLElement).style.transform).toBe(
      'scale(0.5)',
    );
  });

  it('re-fits when the preview box is resized and stops observing on unmount', () => {
    capture(400);
    let box = 200;
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.classList.contains('thm-pv') ? box : 0;
    });
    // the page has two observers now (the Today preview and the height of each other-theme frame):
    // only the preview's is driven here
    const seen: { el?: Element; cb: () => void; disconnect: () => void }[] = [];
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        rec: (typeof seen)[number];
        constructor(cb: () => void) {
          this.rec = { cb, disconnect };
          seen.push(this.rec);
        }
        observe(el: Element) {
          this.rec.el = el;
        }
        disconnect = () => this.rec.disconnect();
      },
    );
    const previewObs = () =>
      seen.filter((o) => (o.el as HTMLElement | undefined)?.classList.contains('thm-pv'));
    const fire = () => previewObs().forEach((o) => o.cb());
    const { container, unmount } = render(<ThemesView onClose={vi.fn()} />);
    expect((container.querySelector('.thm-pv-in') as HTMLElement).style.transform).toBe(
      'scale(0.5)',
    );
    box = 300;
    act(() => fire());
    expect((container.querySelector('.thm-pv-in') as HTMLElement).style.transform).toBe(
      'scale(0.75)',
    );
    expect(previewObs()).toHaveLength(1);
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it('hides the copy (opacity 0) until the box has a width', () => {
    capture(400);
    stubBox(0);
    const { container } = render(<ThemesView onClose={vi.fn()} />);
    expect((container.querySelector('.thm-pv-in') as HTMLElement).style.opacity).toBe('0');
  });
});

describe('ThemesView chrome', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  /** Another theme's card lives in its own document (an iframe), drawn in that theme. */
  const frameOf = async (title: string) => {
    const f = (await screen.findByTitle(title)) as HTMLIFrameElement;
    await waitFor(() => expect(f.contentDocument?.body.textContent).toContain(title));
    return within(f.contentDocument!.body);
  };

  it('back closes the page; the current theme is marked and applied, the others offer Apply', async () => {
    const onClose = vi.fn();
    render(<ThemesView onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: en.backAction }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByText(en.themesCurrent)).toBeTruthy();
    expect(screen.getByText('Brass Glass')).toBeTruthy();
    expect(screen.getByText(en.themeBrassSub)).toBeTruthy();
    const cyber = await frameOf('Cyberpunk');
    expect(cyber.getByText(en.themeCyberSub)).toBeTruthy();
    expect(cyber.getByText(en.themesApply)).toBeTruthy();
    // the card is drawn in ITS theme, not the page's
    const doc = (screen.getByTitle('Cyberpunk') as HTMLIFrameElement).contentDocument!;
    expect(doc.documentElement.getAttribute('data-theme')).toBe('cyberpunk');
    expect(
      (screen.getByText(en.themesApplied).closest('button') as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('Apply switches the theme and moves the Current mark to the tapped card', async () => {
    render(<ThemesView onClose={vi.fn()} />);
    const cyber = await frameOf('Cyberpunk');
    fireEvent.click(cyber.getByText(en.themesApply));
    expect(document.documentElement.getAttribute('data-theme')).toBe('cyberpunk');
    expect(localStorage.getItem('gym.theme')).toBe('cyberpunk');
    // the roles swap: Brass Glass is now the framed card with Apply, Cyberpunk the live one
    const glass = await frameOf('Brass Glass');
    expect(glass.getByText(en.themesApply)).toBeTruthy();
    const cur = screen.getByText(en.themesCurrent).closest('.uicard') ?? document.body;
    expect(cur.textContent).toContain('Cyberpunk');
    act(() => setTheme('glass'));
  });
});
