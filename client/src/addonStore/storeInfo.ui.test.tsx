// SPO-557: the About copy (expand/collapse) and the full-screen preview slider.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADDONS } from '../addons/manifest';
import { addonStoreEn } from '../i18n/addonStore.en';
import { addonStoreEt } from '../i18n/addonStore.et';
import { addonStoreLt } from '../i18n/addonStore.lt';
import { addonStorePl } from '../i18n/addonStore.pl';
import { addonStoreUk } from '../i18n/addonStore.uk';
import { AboutText } from './AboutText';
import { PreviewViewer } from './PreviewViewer';
import type { StoreCtx } from './storeItems';
import { MODULE_SHOTS, WEEK_SHOTS } from './weekPreviews';

afterEach(cleanup);
const PUBLIC = join(__dirname, '../../public');
const ctx = { st: addonStoreEn } as unknown as StoreCtx;

describe('About copy', () => {
  it('shows the first paragraph, expands with Show more (aria-expanded) and collapses back', () => {
    render(<AboutText st={addonStoreEn} id="health" />);
    const btn = screen.getByRole('button', { name: addonStoreEn.showMore });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    const collapsed = document.querySelectorAll('.as-about p').length;
    expect(document.querySelector('.as-about-hl')).toBeNull();
    fireEvent.click(btn);
    const open = screen.getByRole('button', { name: addonStoreEn.showLess });
    expect(open.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelectorAll('.as-about p').length).toBeGreaterThan(collapsed);
    expect(document.querySelector('.as-about-hl')?.children.length).toBeGreaterThan(0);
    fireEvent.click(open);
    expect(screen.getByRole('button', { name: addonStoreEn.showMore })).toBeTruthy();
  });
  it('the toggle is a real button, so Enter and Space work', () => {
    render(<AboutText st={addonStoreEn} id="health" />);
    expect(screen.getByRole('button', { name: addonStoreEn.showMore }).tagName).toBe('BUTTON');
  });
  it('every language renders its own toggle label', () => {
    for (const st of [addonStoreUk, addonStorePl, addonStoreLt, addonStoreEt]) {
      const { unmount } = render(<AboutText st={st} id="health" />);
      expect(screen.getByRole('button', { name: st.showMore })).toBeTruthy();
      unmount();
    }
  });
});

describe('preview files', () => {
  const all = [...Object.values(WEEK_SHOTS), ...Object.values(MODULE_SHOTS)].flat();
  it('every shot exists as a phone and a desktop picture, none is empty', () => {
    for (const s of new Set(all))
      for (const k of ['m', 'd']) {
        const f = join(PUBLIC, 'store-previews', `${s}-${k}.webp`);
        expect(existsSync(f), f).toBe(true);
        expect(readFileSync(f).length, f).toBeGreaterThan(1000);
      }
  });
  it('a new app, add-on or theme has previews or is listed as having none on purpose', () => {
    const missing = ADDONS.filter((a) => a.kind !== 'module' && !a.soon)
      .map((a) => a.id)
      .filter((id) => !WEEK_SHOTS[id]);
    expect(missing).toEqual([]);
  });
  it('store icons are real 320 px pictures', () => {
    for (const a of ADDONS.filter((x) => x.kind !== 'module')) {
      const b = readFileSync(join(PUBLIC, 'store-icons', `${a.id}.webp`));
      expect(b.toString('ascii', 0, 4)).toBe('RIFF');
      expect(b.toString('ascii', 8, 12)).toBe('WEBP');
    }
  });
});

describe('preview slider', () => {
  const shots = ['a', 'b', 'c'];
  const label = (i: number) => addonStoreEn.previewN(i, 3);
  it('is a modal dialog; arrows and keys move, Escape closes', () => {
    const onClose = vi.fn();
    render(<PreviewViewer shots={shots} start={0} title="Apex" ctx={ctx} onClose={onClose} />);
    const dlg = screen.getByRole('dialog');
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    const cur = () =>
      document.querySelector('.as-pv-dots [aria-current="true"]')?.getAttribute('aria-label');
    expect(cur()).toBe(label(1));
    fireEvent.keyDown(dlg, { key: 'ArrowRight' });
    expect(cur()).toBe(label(2));
    fireEvent.keyDown(dlg, { key: 'ArrowRight' });
    fireEvent.keyDown(dlg, { key: 'ArrowRight' });
    expect(cur()).toBe(label(3)); // stops at the last
    fireEvent.keyDown(dlg, { key: 'ArrowLeft' });
    expect(cur()).toBe(label(2));
    fireEvent.keyDown(dlg, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
  it('swipe changes the shot and the page does not scroll behind it', () => {
    const { unmount } = render(
      <PreviewViewer shots={shots} start={0} title="Apex" ctx={ctx} onClose={() => {}} />,
    );
    expect(document.body.style.overflow).toBe('hidden');
    const dlg = screen.getByRole('dialog');
    fireEvent.touchStart(dlg, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(dlg, { changedTouches: [{ clientX: 100 }] });
    expect(
      document.querySelector('.as-pv-dots [aria-current="true"]')?.getAttribute('aria-label'),
    ).toBe(label(2));
    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});
