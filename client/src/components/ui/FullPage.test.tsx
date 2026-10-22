import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { FullPage } from './FullPage';

afterEach(cleanup);

describe('FullPage', () => {
  it('is a modal dialog with the given name, in its own layer on the body', () => {
    render(
      <FullPage label="Terms" top={<i>top</i>} actions={<button>Go</button>}>
        <p>content</p>
      </FullPage>,
    );
    const d = screen.getByRole('dialog', { name: 'Terms' });
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(d.closest('.portal-layer')?.parentElement).toBe(document.body);
    expect(screen.getByText('top')).toBeTruthy();
    expect(screen.getByText('content')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Go' }).closest('.uifp-bar')).toBeTruthy();
  });

  it('makes the app behind it inert and gives it back on unmount', () => {
    const app = document.createElement('div');
    document.body.appendChild(app);
    const { unmount } = render(<FullPage label="Terms">x</FullPage>);
    expect(app.hasAttribute('inert')).toBe(true);
    unmount();
    expect(app.hasAttribute('inert')).toBe(false);
    app.remove();
  });

  it('has no action bar without actions, and renders aside beside the page', () => {
    render(
      <FullPage label="Terms" aside={<span>dialogs</span>}>
        x
      </FullPage>,
    );
    expect(document.querySelector('.uifp-bar')).toBeNull();
    expect(screen.getByText('dialogs').closest('.uifp')).toBeNull();
  });
});
