import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Banner } from './Banner';

afterEach(cleanup);

const root = (c: HTMLElement) => c.firstChild as HTMLElement;

describe('Banner', () => {
  it('renders only the title and sheen with the accent tone by default', () => {
    const { container } = render(<Banner title="Week 3" />);
    expect(root(container).className).toContain('uibanner--accent');
    expect(screen.getByText('Week 3').className).toContain('uibanner-title');
    expect(container.querySelector('.uibanner-sheen')).toBeTruthy();
    for (const c of ['icon', 'kicker', 'body', 'dots', 'acts'])
      expect(container.querySelector(`.uibanner-${c}`)).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it.each(['accent', 'rest', 'danger', 'ok', 'sport', 'conditioning'] as const)(
    'tone %s maps to a class',
    (tone) => {
      const { container } = render(<Banner tone={tone} title="t" />);
      expect(root(container).className).toContain(`uibanner--${tone}`);
    },
  );

  it('sheen can be turned off', () => {
    const { container } = render(<Banner title="t" sheen={false} />);
    expect(container.querySelector('.uibanner-sheen')).toBeNull();
  });

  it('shows kicker, body, dots, icon and children when given', () => {
    const { container } = render(
      <Banner title="t" icon="bell" kicker="Next up" body="Legs" dots={<i data-testid="dots" />}>
        <em data-testid="kid" />
      </Banner>,
    );
    expect(screen.getByText('Next up').className).toContain('uibanner-kicker');
    expect(screen.getByText('Legs').className).toContain('uibanner-body');
    expect(container.querySelector('.uibanner-dots')?.contains(screen.getByTestId('dots'))).toBe(
      true,
    );
    expect(container.querySelector('.uibanner-icon')).toBeTruthy();
    expect(screen.getByTestId('kid')).toBeTruthy();
  });

  it('primary and skip actions fire their handlers; a disabled primary does not', () => {
    const onGo = vi.fn();
    const onSkip = vi.fn();
    const { rerender } = render(
      <Banner
        title="t"
        primaryAction={{ label: 'Start', onClick: onGo }}
        skipAction={{ label: 'Skip', onClick: onSkip }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onGo).toHaveBeenCalledTimes(1);
    expect(onSkip).toHaveBeenCalledTimes(1);
    rerender(
      <Banner title="t" primaryAction={{ label: 'Start', onClick: onGo, disabled: true }} />,
    );
    const go = screen.getByRole('button', { name: 'Start' }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.click(go);
    expect(onGo).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
  });

  it('blend of several families takes the first as tone and paints a gradient', () => {
    const { container } = render(<Banner title="t" tone="danger" blend={['sport', 'rest']} />);
    const el = root(container);
    expect(el.className).toContain('uibanner--sport');
    expect(el.className).toContain('uibanner--blend');
    expect(el.className).not.toContain('uibanner--danger');
    expect(el.getAttribute('style')).toContain('linear-gradient');
  });

  it('a single-family blend sets the tone without the blend gradient', () => {
    const { container } = render(<Banner title="t" blend={['rest']} />);
    const el = root(container);
    expect(el.className).toContain('uibanner--rest');
    expect(el.className).not.toContain('uibanner--blend');
    expect(el.getAttribute('style')).toBeNull();
  });
});
