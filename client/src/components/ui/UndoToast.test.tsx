import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { UndoToast } from './UndoToast';

afterEach(cleanup);

const base = { text: 'x', undoLabel: 'Undo', countdownLabel: '8 s', onUndo: () => undefined };

describe('UndoToast tone (verify iter 15)', () => {
  it('a removal keeps the danger icon by default', () => {
    const { container } = render(<UndoToast {...base} />);
    expect(container.querySelector('.uit--danger')).toBeTruthy();
  });
  it('a confirmation such as "Shared with Maria" is not red', () => {
    const { container } = render(<UndoToast {...base} icon="check-circle" tone="ok" />);
    expect(container.querySelector('.uit--danger')).toBeNull();
    expect(container.querySelector('.uit--ok')).toBeTruthy();
  });
});
