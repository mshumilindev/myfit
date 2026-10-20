import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { recordSignIn } from '../accounts/rememberedPeople';

const h = vi.hoisted(() => ({ uid: 'uA' as string | null }));
vi.mock('../api', () => ({ currentUid: () => h.uid }));

import { SignOutDialog } from './SignOutDialog';

beforeEach(() => {
  setLocale('en');
  localStorage.clear();
  h.uid = 'uA';
});
afterEach(cleanup);

const open = (queueLength = 0) => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(<SignOutDialog queueLength={queueLength} onConfirm={onConfirm} onCancel={onCancel} />);
  return { onConfirm, onCancel };
};
const box = () => screen.getByRole('checkbox', { name: en.signOutRemember }) as HTMLInputElement;
const confirm = () => fireEvent.click(screen.getAllByRole('button', { name: en.signOut }).at(-1)!);

describe('SignOutDialog', () => {
  it('starts ticked for a remembered person and keeps them (forget=false)', () => {
    recordSignIn(localStorage, { uid: 'uA', name: 'Anna', appName: '[DEFAULT]' }, true, 1);
    const { onConfirm } = open();
    expect(box().checked).toBe(true);
    confirm();
    expect(onConfirm).toHaveBeenCalledWith(false);
  });

  it('unticking makes the device forget the person (forget=true)', () => {
    recordSignIn(localStorage, { uid: 'uA', name: 'Anna', appName: '[DEFAULT]' }, true, 1);
    const { onConfirm } = open();
    fireEvent.click(box());
    confirm();
    expect(onConfirm).toHaveBeenCalledWith(true);
  });

  it('starts unticked for a person this device does not list', () => {
    const { onConfirm } = open();
    expect(box().checked).toBe(false);
    confirm();
    expect(onConfirm).toHaveBeenCalledWith(true);
  });

  it('warns about unsynced entries and cancels without signing out', () => {
    const { onCancel, onConfirm } = open(3);
    expect(screen.getByText(en.signOutQueueBody(3))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.cancel }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
