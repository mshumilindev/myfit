import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ShareCard, ShareCardPhoto, type ShareCardProps } from './ShareCard';

afterEach(cleanup);

const base: ShareCardProps = {
  state: 'ok',
  typeIcon: 'barbell',
  typeLabel: 'Program',
  ariaLabel: 'Shared program',
  title: 'Push Pull Legs',
};

describe('ShareCard', () => {
  it('ok without onOpen is a labelled group with title, subtitle, chips and tag', () => {
    const { container } = render(
      <ShareCard
        {...base}
        subtitle="4 weeks"
        chips={['Strength', 'Gym']}
        tag={{ label: 'With trainer', icon: 'user' }}
      />,
    );
    const root = screen.getByRole('group', { name: 'Shared program' });
    expect(root.className).toContain('is-ok');
    expect(root.className).toContain('uishc--bubble');
    expect(screen.getByText('Push Pull Legs').className).toContain('uishc-title');
    expect(screen.getByText('4 weeks')).toBeTruthy();
    expect(container.querySelectorAll('.uishc-chips > *')).toHaveLength(2);
    expect(screen.getByText('With trainer')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('onOpen makes the whole card a button that fires; open label shows in the footer', () => {
    const onOpen = vi.fn();
    render(
      <ShareCard
        {...base}
        onOpen={onOpen}
        caption="Updates with the program"
        openLabel="Open in Programs"
      />,
    );
    const btn = screen.getByRole('button', { name: 'Shared program' });
    fireEvent.click(btn);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Open in Programs').className).toContain('uishc-open');
    expect(screen.getByText('Updates with the program')).toBeTruthy();
  });

  it('the open label is hidden without onOpen', () => {
    render(<ShareCard {...base} caption="Cap" openLabel="Open in Programs" />);
    expect(screen.queryByText('Open in Programs')).toBeNull();
    expect(screen.getByText('Cap')).toBeTruthy();
  });

  it('renders rows with meta, facts and limited text', () => {
    const { container } = render(
      <ShareCard
        {...base}
        state="limited"
        rows={[
          { name: 'Squat', meta: '4 x 8 . 70 kg' },
          { name: 'Plank', image: 'x.png' },
        ]}
        facts={[{ label: 'Weeks', value: '4' }]}
        limitedText="Totals only"
      />,
    );
    expect(screen.getByRole('group').className).toContain('is-limited');
    expect(container.querySelectorAll('.uishc-row')).toHaveLength(2);
    expect(screen.getByText('4 x 8 . 70 kg').className).toContain('uishc-rm');
    expect(container.querySelectorAll('.uishc-rm')).toHaveLength(1);
    expect(container.querySelector('img.is-img')).not.toBeNull();
    expect(screen.getByText('Weeks')).toBeTruthy();
    expect(screen.getByText('Totals only').className).toContain('uishc-lim');
  });

  it.each(['locked', 'removed'] as const)(
    '%s shows reason and dead tag, hides content, and is never a link',
    (state) => {
      const onOpen = vi.fn();
      const { container } = render(
        <ShareCard
          {...base}
          state={state}
          onOpen={onOpen}
          reason="No longer shared"
          deadTag="Locked"
          tag={{ label: 'With trainer' }}
          chips={['A']}
          rows={[{ name: 'Row' }]}
          openLabel="Open"
        />,
      );
      expect(screen.getByRole('group', { name: 'Shared program' }).className).toContain(
        `is-${state}`,
      );
      expect(screen.queryByRole('button')).toBeNull();
      expect(screen.getByText('No longer shared').className).toContain('uishc-reason');
      expect(screen.getByText('Locked')).toBeTruthy();
      expect(screen.queryByText('With trainer')).toBeNull();
      expect(container.querySelector('.uishc-rows')).toBeNull();
      expect(container.querySelector('.uishc-chips')).toBeNull();
      expect(screen.queryByText('Open')).toBeNull();
    },
  );

  it('loading is a busy status named by loadingLabel (falling back to ariaLabel)', () => {
    const { container, rerender } = render(
      <ShareCard {...base} state="loading" loadingLabel="Loading program" onOpen={() => {}} />,
    );
    const status = screen.getByRole('status', { name: 'Loading program' });
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelectorAll('.uisk').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('Push Pull Legs')).toBeNull();
    rerender(<ShareCard {...base} state="loading" />);
    expect(screen.getByRole('status', { name: 'Shared program' })).toBeTruthy();
  });

  it('density maps to a class and media / trend / extra slots render', () => {
    const { rerender } = render(
      <ShareCard
        {...base}
        density="peek"
        media={<i data-testid="m" />}
        trend={<i data-testid="t" />}
        extra={<i data-testid="e" />}
      />,
    );
    expect(screen.getByRole('group').className).toContain('uishc--peek');
    for (const id of ['m', 't', 'e']) expect(screen.getByTestId(id)).toBeTruthy();
    rerender(<ShareCard {...base} density="dock" className="x" />);
    const cls = screen.getByRole('group').className;
    expect(cls).toContain('uishc--dock');
    expect(cls).toContain('x');
  });
});

describe('ShareCardPhoto', () => {
  it('prefers children, then src, then an icon', () => {
    const { container, rerender } = render(
      <ShareCardPhoto src="a.png">
        <b>node</b>
      </ShareCardPhoto>,
    );
    expect(container.querySelector('.is-node')).not.toBeNull();
    expect(container.querySelector('img')).toBeNull();
    rerender(<ShareCardPhoto src="a.png" />);
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('a.png');
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('loading')).toBe('lazy');
    rerender(<ShareCardPhoto />);
    expect(container.querySelector('.is-icon .ui-icon')).not.toBeNull();
  });
});
