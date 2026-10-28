import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { setViewport } from '../coach/testViewport';
import { forgetReauth, type ReauthPort, type ReauthResult } from '../coach/security/reauth';
import { DeleteAccountFlow } from './DeleteAccountFlow';

vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  signOut: vi.fn(),
}));

beforeEach(() => {
  setViewport(1280);
  forgetReauth();
});
afterEach(cleanup);

const dlg = () => screen.getByRole('alertdialog');
const btn = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

function setup(result: ReauthResult | ((pw: string) => ReauthResult) = 'ok') {
  const check = vi.fn(async ({ password }: { password: string }) =>
    typeof result === 'function' ? result(password) : result,
  );
  const port: ReauthPort = { knowsIdentifier: () => true, check };
  const finish = vi.fn();
  const onCancel = vi.fn();
  const onDownloadCopy = vi.fn();
  render(
    <DeleteAccountFlow
      port={port}
      finish={finish}
      onCancel={onCancel}
      onDownloadCopy={onDownloadCopy}
    />,
  );
  return { check, finish, onCancel, onDownloadCopy };
}
function toLastStep() {
  fireEvent.click(btn('Continue'));
  fireEvent.click(btn('Continue'));
}

describe('delete account flow', () => {
  it('step 1 says what goes and offers a copy first; step 2 says what changes for trainers and teams', () => {
    setup();
    expect(dlg().textContent).toContain('Delete your account?');
    expect(dlg().textContent).toContain('Step 1 of 3');
    expect(dlg().textContent).toContain('You can download a copy of your data first');
    fireEvent.click(btn('Continue'));
    expect(dlg().textContent).toContain('Step 2 of 3');
    expect(dlg().textContent).toContain('Your trainer no longer has you as a client');
    expect(dlg().textContent).toContain('If you own a team');
    expect(dlg().textContent).toContain('Programs you created, and their assignments, disappear');
    expect(dlg().textContent).toContain('has not synced yet is discarded');
  });

  it('"Download a copy first" asks the host to open the copy and deletes nothing', () => {
    const { check, finish, onDownloadCopy } = setup();
    fireEvent.click(btn('Download a copy first'));
    expect(onDownloadCopy).toHaveBeenCalledTimes(1);
    expect(check).not.toHaveBeenCalled();
    expect(finish).not.toHaveBeenCalled();
  });

  it('the final button stays disabled until DELETE is typed; nothing is called before', () => {
    const { check, finish } = setup();
    toLastStep();
    expect(btn('Delete account').disabled).toBe(true);
    fireEvent.click(btn('Delete account'));
    fireEvent.change(screen.getByLabelText('Type DELETE'), { target: { value: 'DELET' } });
    expect(btn('Delete account').disabled).toBe(true);
    expect(screen.queryByText('Confirm it is you')).toBeNull();
    expect(check).not.toHaveBeenCalled();
    expect(finish).not.toHaveBeenCalled();
  });

  it('after DELETE: asks for the password; the correct one calls the delete and then leaves the device', async () => {
    const { check, finish } = setup('ok');
    toLastStep();
    fireEvent.change(screen.getByLabelText('Type DELETE'), { target: { value: 'DELETE' } });
    fireEvent.click(btn('Delete account'));
    expect(await screen.findByText('Confirm it is you')).toBeTruthy();
    expect(dlg().textContent).toContain('Deleting your account cannot be undone');
    expect(finish).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
    fireEvent.click(btn('Confirm'));
    await waitFor(() => expect(finish).toHaveBeenCalledTimes(1));
    expect(check).toHaveBeenCalledWith({ password: 'secret', identifier: undefined });
  });

  it('a wrong password keeps the person here and does not leave the device', async () => {
    const { finish } = setup('wrong');
    toLastStep();
    fireEvent.change(screen.getByLabelText('Type DELETE'), { target: { value: 'DELETE' } });
    fireEvent.click(btn('Delete account'));
    fireEvent.change(await screen.findByLabelText('Password'), { target: { value: 'nope' } });
    fireEvent.click(btn('Confirm'));
    expect(await screen.findByText('That password is not right.')).toBeTruthy();
    expect(finish).not.toHaveBeenCalled();
  });

  it('offline: a clear message, nothing is done, the device keeps its data', async () => {
    const { finish } = setup('offline');
    toLastStep();
    fireEvent.change(screen.getByLabelText('Type DELETE'), { target: { value: 'DELETE' } });
    fireEvent.click(btn('Delete account'));
    fireEvent.change(await screen.findByLabelText('Password'), { target: { value: 'pw' } });
    fireEvent.click(btn('Confirm'));
    expect(await screen.findByText(/No connection/i)).toBeTruthy();
    expect(finish).not.toHaveBeenCalled();
  });

  it('Keep my account closes at any step without a call', () => {
    const { check, finish, onCancel } = setup();
    fireEvent.click(btn('Continue'));
    fireEvent.click(btn('Keep my account'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(check).not.toHaveBeenCalled();
    expect(finish).not.toHaveBeenCalled();
  });

  it('by default leaving the device is a sign-out that forgets the person (it runs the device wipe)', async () => {
    const { signOut } = await import('../api');
    const check = vi.fn(async () => 'ok' as ReauthResult);
    render(
      <DeleteAccountFlow
        port={{ knowsIdentifier: () => true, check }}
        onCancel={() => undefined}
      />,
    );
    toLastStep();
    fireEvent.change(screen.getByLabelText('Type DELETE'), { target: { value: 'DELETE' } });
    fireEvent.click(btn('Delete account'));
    fireEvent.change(await screen.findByLabelText('Password'), { target: { value: 'pw' } });
    fireEvent.click(btn('Confirm'));
    await waitFor(() =>
      expect(signOut).toHaveBeenCalledWith({ forget: true, discardUnsynced: true }),
    );
  });
});
