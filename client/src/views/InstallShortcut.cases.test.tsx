import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { InstallShortcut } from './InstallShortcut';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { setDesktop } from './__fixtures__/viewKit';

const UA = {
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile',
  desktop: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120',
};
function agent(ua: string, platform = 'Linux x86_64') {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
  Object.defineProperty(navigator, 'platform', { value: platform, configurable: true });
}

beforeEach(() => {
  setLocale('en');
  setDesktop(false);
});
afterEach(() => {
  cleanup();
  agent(UA.desktop);
});

describe('InstallShortcut', () => {
  it('renders nothing on a desktop browser that cannot install', () => {
    agent(UA.desktop);
    const { container } = render(<InstallShortcut />);
    expect(container.innerHTML).toBe('');
  });

  it('SPO-163: hides the CTA inside the desktop shell, shows it in a plain Mac browser', () => {
    const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130';
    agent(mac, 'MacIntel');
    const browser = render(<InstallShortcut />);
    expect(screen.queryByRole('button', { name: en.createShortcut })).not.toBeNull();
    browser.unmount();
    agent(`${mac} Spotter/0.1.0 Electron/33.0.0`, 'MacIntel');
    const shell = render(<InstallShortcut />);
    expect(shell.container.innerHTML).toBe('');
  });

  it('renders nothing when the app already runs standalone', () => {
    agent(UA.ios, 'iPhone');
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    const { container } = render(<InstallShortcut />);
    expect(container.innerHTML).toBe('');
    Object.defineProperty(navigator, 'standalone', { value: false, configurable: true });
  });

  it('on iOS opens the three-step Add to Home Screen guide and closes it with Got it', async () => {
    agent(UA.ios, 'iPhone');
    render(<InstallShortcut />);
    fireEvent.click(screen.getByRole('button', { name: en.createShortcut }));
    expect(screen.getByText(en.installIosTitle)).toBeTruthy();
    expect(screen.getByText(en.installIosStep1)).toBeTruthy();
    expect(screen.getByText(en.installIosStep3)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.installGotIt }));
    await waitFor(() => expect(screen.queryByText(en.installIosTitle)).toBeNull());
  });

  it('on Android without a deferred prompt shows the menu guide', () => {
    agent(UA.android);
    render(<InstallShortcut />);
    fireEvent.click(screen.getByRole('button', { name: en.createShortcut }));
    expect(screen.getByText(en.installAndroidTitle)).toBeTruthy();
    expect(screen.getByText(en.installAndroidStep2)).toBeTruthy();
  });

  it('on a Mac Safari shows the two-step guide', () => {
    agent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15', 'MacIntel');
    render(<InstallShortcut />);
    fireEvent.click(screen.getByRole('button', { name: en.createShortcut }));
    expect(screen.getByText(en.installMacTitle)).toBeTruthy();
    expect(screen.queryByText(en.installIosStep3)).toBeNull();
  });

  it('with a beforeinstallprompt event on desktop Chrome the button calls the native prompt', async () => {
    agent(UA.desktop);
    render(<InstallShortcut />);
    const prompt = vi.fn(async () => undefined);
    const ev = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'dismissed' as const }),
    });
    act(() => {
      window.dispatchEvent(ev);
    });
    expect(ev.defaultPrevented).toBe(true);
    fireEvent.click(await screen.findByRole('button', { name: en.createShortcut }));
    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    // a dismissed prompt does not open the manual guide
    expect(screen.queryByText(en.installAndroidTitle)).toBeNull();
  });

  it('when the native prompt throws on Android it falls back to the manual guide', async () => {
    agent(UA.android);
    render(<InstallShortcut />);
    const ev = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: vi.fn(async () => {
        throw new Error('blocked');
      }),
      userChoice: new Promise(() => undefined),
    });
    act(() => {
      window.dispatchEvent(ev);
    });
    fireEvent.click(await screen.findByRole('button', { name: en.createShortcut }));
    expect(await screen.findByText(en.installAndroidTitle)).toBeTruthy();
  });
});
