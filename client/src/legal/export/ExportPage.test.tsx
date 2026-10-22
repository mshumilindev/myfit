import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setViewport } from '../../coach/testViewport';
import {
  forgetReauth,
  markReauthed,
  type ReauthPort,
  type ReauthResult,
} from '../../coach/security/reauth';
import { sources } from './fixtures.testutil';

const h = vi.hoisted(() => ({ download: vi.fn(), read: vi.fn() }));
vi.mock('./download', () => ({ downloadBlob: h.download }));
vi.mock('./readSources', () => ({ readExportSources: h.read }));

import { ExportPage } from './ExportPage';

const btn = (name: string | RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement;
const sw = (name: string) => screen.getByRole('switch', { name }) as HTMLInputElement;

function port(result: ReauthResult = 'ok') {
  const check = vi.fn(async () => result);
  const p: ReauthPort = { knowsIdentifier: () => true, check };
  return { p, check };
}
function setup(result: ReauthResult = 'ok', extra: Partial<Parameters<typeof ExportPage>[0]> = {}) {
  const { p, check } = port(result);
  const onBack = vi.fn();
  render(<ExportPage onBack={onBack} consents={[]} hasTrainer={false} port={p} {...extra} />);
  return { check, onBack };
}
async function confirmPassword() {
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pw' } });
  fireEvent.click(btn('Confirm'));
}

beforeEach(() => {
  setViewport(1280);
  forgetReauth();
  h.download.mockReset();
  h.read.mockReset();
  h.read.mockResolvedValue(sources());
});
afterEach(cleanup);

describe('Download a copy', () => {
  it('lists the parts (all on), the unencrypted warning and the network note', () => {
    setup();
    for (const l of [
      'Account, sign-in and consent history',
      'Training',
      'Health, body, sleep and nutrition',
      'Atlas chat',
      'Trainer sharing and messages',
    ])
      expect(sw(l).checked).toBe(true);
    expect(screen.getByText(/not encrypted and contains health data/)).toBeTruthy();
    expect(screen.getByText(/password is checked online/)).toBeTruthy();
  });

  it('with every part off there is nothing to prepare', () => {
    setup();
    for (const s of screen.getAllByRole('switch')) fireEvent.click(s);
    expect(screen.getByText('Turn on at least one part.')).toBeTruthy();
    fireEvent.click(screen.getByText('Prepare my copy'));
    expect(screen.queryByText('Confirm it is you')).toBeNull();
    expect(h.read).not.toHaveBeenCalled();
  });

  it('asks for the password first; nothing is read or built before it is right', async () => {
    const { check } = setup('wrong');
    fireEvent.click(screen.getByText('Prepare my copy'));
    expect(screen.getByText('Confirm it is you')).toBeTruthy();
    expect(h.read).not.toHaveBeenCalled();
    await confirmPassword();
    await screen.findByText('That password is not right.');
    expect(check).toHaveBeenCalledTimes(1);
    expect(h.read).not.toHaveBeenCalled();
    expect(screen.queryByText('Preparing your copy')).toBeNull();
  });

  it('offline: the step-up says so and nothing is built', async () => {
    setup('offline');
    fireEvent.click(screen.getByText('Prepare my copy'));
    await confirmPassword();
    await screen.findByText('No connection. Check your network and try again.');
    expect(h.read).not.toHaveBeenCalled();
  });

  it('after the password: builds the chosen parts, then offers the file and downloads it', async () => {
    setup();
    fireEvent.click(sw('Atlas chat'));
    fireEvent.click(screen.getByText('Prepare my copy'));
    await confirmPassword();
    await screen.findByText('Ready');
    expect(h.read).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Health data in this file is not encrypted/)).toBeTruthy();
    expect(screen.getByText(/^spotter-export-\d{4}-\d{2}-\d{2}\.zip$/)).toBeTruthy();
    // the server-held and not-loaded gaps are shown, with the reason
    expect(screen.getByText('Not included here')).toBeTruthy();
    expect(screen.getByText('Kept on our servers only')).toBeTruthy();
    fireEvent.click(screen.getByText(/^spotter-export-/));
    expect(h.download).toHaveBeenCalledTimes(1);
    const [blob, name] = h.download.mock.calls[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(name).toMatch(/^spotter-export-\d{4}-\d{2}-\d{2}\.zip$/);
  });

  it('a password confirmed a moment ago is not asked again', async () => {
    markReauthed();
    setup();
    fireEvent.click(screen.getByText('Prepare my copy'));
    expect(screen.queryByText('Confirm it is you')).toBeNull();
    await screen.findByText('Ready');
  });

  it('shows per-part progress while it works', async () => {
    markReauthed();
    let release: (v: ReturnType<typeof sources>) => void = () => undefined;
    h.read.mockReturnValue(new Promise((r) => (release = r)));
    setup();
    fireEvent.click(screen.getByText('Prepare my copy'));
    expect((await screen.findAllByText('Preparing your copy')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Waiting').length).toBeGreaterThan(0);
    await act(async () => release(sources()));
    await screen.findByText('Ready');
  });

  it('cancel while working goes back to the choice; no file is offered', async () => {
    markReauthed();
    h.read.mockReturnValue(new Promise(() => undefined));
    setup();
    fireEvent.click(screen.getByText('Prepare my copy'));
    fireEvent.click(await screen.findByText('Cancel'));
    await screen.findByText('What to include');
    expect(h.download).not.toHaveBeenCalled();
  });

  it('a failure is said plainly and the choice stays', async () => {
    markReauthed();
    h.read.mockRejectedValue(new Error('boom'));
    setup();
    fireEvent.click(screen.getByText('Prepare my copy'));
    await screen.findByText('Could not make the copy. Nothing was saved. Try again.');
    expect(screen.getByText('What to include')).toBeTruthy();
  });

  it('the "copy first" ready page offers to go on to the deletion', async () => {
    markReauthed();
    const onContinueDelete = vi.fn();
    setup('ok', { onContinueDelete });
    fireEvent.click(screen.getByText('Prepare my copy'));
    await screen.findByText('Ready');
    fireEvent.click(screen.getByText('Continue to delete my account'));
    expect(onContinueDelete).toHaveBeenCalledTimes(1);
  });

  it('no deletion row when the copy is not part of a deletion', async () => {
    markReauthed();
    setup();
    fireEvent.click(screen.getByText('Prepare my copy'));
    await screen.findByText('Ready');
    expect(screen.queryByText('Continue to delete my account')).toBeNull();
    await waitFor(() => expect(h.read).toHaveBeenCalled());
  });
});
