import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgreementBlock, useAgreementGate, type AgreementStrings } from './AgreementBlock';

afterEach(cleanup);

const docs = [
  { id: 'terms', label: 'Terms of Use' },
  { id: 'privacy', label: 'Privacy Policy' },
];
const strings: AgreementStrings = {
  header: 'Before you continue',
  lockedHint: 'Open both documents.',
  notOpenedLabel: 'Not opened yet',
  readLabel: 'Read',
  ageLabel: 'I am 18 or older.',
  agreeLabel: 'I agree.',
};

function Harness({ onOpen }: { onOpen: (id: string) => void }) {
  const gate = useAgreementGate(['terms', 'privacy']);
  return (
    <>
      <AgreementBlock docs={docs} gate={gate} onOpen={onOpen} strings={strings} />
      <button disabled={!gate.canContinue}>Continue</button>
    </>
  );
}
const box = (name: string) => screen.getByRole('checkbox', { name }) as HTMLInputElement;
const cont = () => screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;

describe('AgreementBlock', () => {
  it('starts blocked: both rows unopened, boxes disabled, Continue disabled', () => {
    render(<Harness onOpen={vi.fn()} />);
    expect(screen.getAllByText('Not opened yet')).toHaveLength(2);
    expect(screen.getByText('Open both documents.')).toBeTruthy();
    expect(box('I am 18 or older.').disabled).toBe(true);
    expect(box('I agree.').disabled).toBe(true);
    expect(cont().disabled).toBe(true);
  });

  it('opening one document is not enough', () => {
    const onOpen = vi.fn();
    render(<Harness onOpen={onOpen} />);
    fireEvent.click(screen.getByText('Terms of Use'));
    expect(onOpen).toHaveBeenCalledWith('terms');
    expect(screen.getByText('Read')).toBeTruthy();
    expect(box('I am 18 or older.').disabled).toBe(true);
    expect(cont().disabled).toBe(true);
  });

  it('Continue unlocks only when both documents are opened AND both boxes are ticked', () => {
    render(<Harness onOpen={vi.fn()} />);
    fireEvent.click(screen.getByText('Terms of Use'));
    fireEvent.click(screen.getByText('Privacy Policy'));
    expect(screen.queryByText('Open both documents.')).toBeNull();
    expect(box('I am 18 or older.').disabled).toBe(false);
    expect(cont().disabled).toBe(true);
    fireEvent.click(box('I am 18 or older.'));
    expect(cont().disabled).toBe(true);
    fireEvent.click(box('I agree.'));
    expect(cont().disabled).toBe(false);
    fireEvent.click(box('I am 18 or older.')); // un-tick: locked again
    expect(cont().disabled).toBe(true);
  });
});

describe('useAgreementGate', () => {
  it('canContinue needs all four conditions, in any order of the boxes', () => {
    const { result } = renderHook(() => useAgreementGate(['terms', 'privacy']));
    act(() => {
      result.current.setAge(true);
      result.current.setAgree(true);
    });
    expect(result.current.canContinue).toBe(false); // boxes without reading
    act(() => result.current.markOpened('terms'));
    expect(result.current.canContinue).toBe(false);
    act(() => result.current.markOpened('privacy'));
    expect(result.current.canContinue).toBe(true);
  });
});

describe('useAgreementGate when the set of documents changes', () => {
  it('forgets the ticks (they were for other text); opened marks follow the read-gate', () => {
    const { result, rerender } = renderHook(({ ids }) => useAgreementGate(ids), {
      initialProps: { ids: ['terms', 'privacy'] },
    });
    act(() => {
      result.current.setAge(true);
      result.current.setAgree(true);
    });
    expect(result.current.age && result.current.agree).toBe(true);
    rerender({ ids: ['terms', 'privacy', 'trainer-terms'] });
    expect(result.current.age).toBe(false);
    expect(result.current.agree).toBe(false);
    act(() => result.current.setAgree(true));
    rerender({ ids: ['terms', 'privacy', 'trainer-terms'] }); // same set: kept
    expect(result.current.agree).toBe(true);
  });
});
