import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ChatBubble, ChatMessage } from './ChatBubble';

afterEach(cleanup);

describe('ChatMessage below', () => {
  // SPO-100: answer chips placed next to the bubble (inside the flex row) squeezed it to a
  // narrow column. They must sit under the row, as a block of their own.
  it('renders `below` outside the bubble row', () => {
    const { container } = render(
      <ul>
        <ChatMessage side="them" below={<div data-testid="chips">chips</div>}>
          <ChatBubble side="them">Hello</ChatBubble>
        </ChatMessage>
      </ul>,
    );
    const row = container.querySelector('.uimsg-row');
    expect(row).not.toBeNull();
    expect(row!.contains(screen.getByTestId('chips'))).toBe(false);
    expect(row!.contains(container.querySelector('.uibub'))).toBe(true);
    expect(screen.getByTestId('chips').parentElement).toBe(row!.parentElement);
  });
});
