import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AcceptCheck, DocReadList } from './DocReadList';

afterEach(cleanup);

const docs = [
  { id: 'terms', label: 'Terms of Use' },
  { id: 'privacy', label: 'Privacy Policy' },
];
const strings = {
  notOpenedLabel: 'Not opened yet',
  readLabel: 'Read',
  lockedHint: 'Open both documents.',
};

describe('DocReadList', () => {
  it('marks each row Read / Not opened yet and shows the hint until all are read', () => {
    const { rerender } = render(
      <DocReadList
        docs={docs}
        opened={{ terms: true, privacy: false }}
        onOpen={vi.fn()}
        {...strings}
      />,
    );
    expect(screen.getByText('Read')).toBeTruthy();
    expect(screen.getByText('Not opened yet')).toBeTruthy();
    expect(screen.getByText('Open both documents.')).toBeTruthy();
    rerender(
      <DocReadList
        docs={docs}
        opened={{ terms: true, privacy: true }}
        onOpen={vi.fn()}
        {...strings}
      />,
    );
    expect(screen.queryByText('Open both documents.')).toBeNull();
  });
  it('a row press asks to open that document', () => {
    const onOpen = vi.fn();
    render(<DocReadList docs={docs} opened={{}} onOpen={onOpen} {...strings} />);
    fireEvent.click(screen.getByText('Privacy Policy'));
    expect(onOpen).toHaveBeenCalledWith('privacy');
  });
});

describe('AcceptCheck', () => {
  it('is a labelled checkbox that can be disabled', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <AcceptCheck checked={false} disabled onChange={onChange}>
        I am 18 or older.
      </AcceptCheck>,
    );
    const box = screen.getByRole('checkbox', { name: 'I am 18 or older.' }) as HTMLInputElement;
    expect(box.disabled).toBe(true);
    rerender(
      <AcceptCheck checked={false} onChange={onChange}>
        I am 18 or older.
      </AcceptCheck>,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'I am 18 or older.' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
