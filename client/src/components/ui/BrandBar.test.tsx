import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BellButton, BrandBar, BrandIconButton } from './BrandBar';

afterEach(cleanup);

describe('BrandBar', () => {
  it('renders the wordmark, the app switcher button and a compact language selector', () => {
    const onApp = vi.fn();
    const { container } = render(<BrandBar app="Gym" onApp={onApp} appLabel="Switch app" />);
    const bar = screen.getByLabelText('Spotter');
    expect(bar.tagName).toBe('DIV');
    expect(bar.className).toContain('uibrand');
    expect(bar.className).not.toContain('apex-head');
    expect(screen.getByText('spotter')).toBeTruthy();
    const app = screen.getByRole('button', { name: 'Switch app' });
    expect(app.textContent).toBe('Gym');
    fireEvent.click(app);
    expect(onApp).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.lang.compact')).toBeTruthy();
  });

  it('header renders a <header> with the sub-app class; className is appended', () => {
    render(<BrandBar app="Apex" onApp={vi.fn()} appLabel="Switch" header className="mine" />);
    const bar = screen.getByLabelText('Spotter');
    expect(bar.tagName).toBe('HEADER');
    expect(bar.className).toContain('apex-head');
    expect(bar.className).toContain('mine');
  });

  it('actions come before the language selector, the avatar is last', () => {
    const { container } = render(
      <BrandBar
        app="Gym"
        onApp={vi.fn()}
        appLabel="Switch"
        actions={<i data-testid="act" />}
        avatar={<i data-testid="av" />}
      />,
    );
    const kids = Array.from(container.querySelector('.uibrand-actions')?.children ?? []);
    expect(kids[0]).toBe(screen.getByTestId('act'));
    expect(kids[1].className).toContain('lang');
    expect(kids[2]).toBe(screen.getByTestId('av'));
  });
});

describe('BellButton', () => {
  it('is a labelled button with no badge at zero and fires onClick', () => {
    const onClick = vi.fn();
    const { container } = render(<BellButton label="Notifications" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.uibell-badge')).toBeNull();
  });

  it('shows the count, capped at 9+', () => {
    const { container, rerender } = render(<BellButton label="N" onClick={vi.fn()} count={3} />);
    expect(container.querySelector('.uibell-badge')?.textContent).toBe('3');
    rerender(<BellButton label="N" onClick={vi.fn()} count={40} />);
    expect(container.querySelector('.uibell-badge')?.textContent).toBe('9+');
  });

  it('active switches the bell glyph to a filled weight', () => {
    const { container, rerender } = render(<BellButton label="N" onClick={vi.fn()} />);
    const regular = container.querySelector('svg')?.innerHTML;
    rerender(<BellButton label="N" onClick={vi.fn()} active />);
    expect(container.querySelector('svg')?.innerHTML).not.toBe(regular);
  });
});

describe('BrandIconButton', () => {
  it('is named and titled by its label and fires onClick', () => {
    const onClick = vi.fn();
    render(<BrandIconButton label="Health" icon="heart" onClick={onClick} />);
    const b = screen.getByRole('button', { name: 'Health' });
    expect(b.getAttribute('title')).toBe('Health');
    expect(b.className).not.toContain('is-chronic');
    fireEvent.click(b);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('tone chronic adds the colour class', () => {
    render(<BrandIconButton label="Health" icon="heart" tone="chronic" onClick={vi.fn()} />);
    expect(screen.getByRole('button').className).toContain('is-chronic');
  });
});
