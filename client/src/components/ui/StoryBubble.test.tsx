import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StoryBubble, StoryDivider, StoryRow, STORY_FACE_PX, STORY_RING_PX } from './StoryBubble';

afterEach(cleanup);

describe('StoryBubble', () => {
  it('defaults to a large default-ring span with the label under it', () => {
    const { container } = render(<StoryBubble label="Anna" initial="anna" />);
    const el = container.firstChild as HTMLElement;
    expect(el.tagName).toBe('SPAN');
    expect(el.className).toContain('uistory--lg');
    expect(el.className).toContain('uistory--default');
    expect(screen.getByText('Anna').className).toContain('uistory-label');
    expect(screen.getByText('A')).toBeTruthy();
  });

  it('marks a bubble without a label as bare and shows no label', () => {
    const { container } = render(<StoryBubble initial="x" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('uistory--bare');
    expect(container.querySelector('.uistory-label')).toBeNull();
  });

  it.each(['xs', 'sm', 'md', 'lg'] as const)('size %s maps to a class', (size) => {
    const { container } = render(<StoryBubble size={size} label="a" />);
    expect((container.firstChild as HTMLElement).className).toContain(`uistory--${size}`);
  });

  it('ring variants map to classes; live adds a dot, others do not', () => {
    const { container, rerender } = render(<StoryBubble ring="live" label="a" />);
    expect((container.firstChild as HTMLElement).className).toContain('uistory--live');
    expect(container.querySelector('.uistory-live')).not.toBeNull();
    rerender(<StoryBubble ring="alert" label="a" />);
    expect((container.firstChild as HTMLElement).className).toContain('uistory--alert');
    expect(container.querySelector('.uistory-live')).toBeNull();
  });

  it('tone adds the toned class and the tone family', () => {
    const { container } = render(<StoryBubble tone="ok" label="a" />);
    const cls = (container.firstChild as HTMLElement).className;
    expect(cls).toContain('uistory--toned');
    expect(cls).toContain('uit--ok');
  });

  it('renders media instead of the initial', () => {
    render(<StoryBubble media={<img alt="face" src="x.png" />} initial="Z" label="a" />);
    expect(screen.getByAltText('face')).toBeTruthy();
    expect(screen.queryByText('Z')).toBeNull();
  });

  it('shows a numeric badge capped at 9+, a "!" alert badge, and none for 0', () => {
    const { container, rerender } = render(<StoryBubble badge={12} label="a" />);
    expect(container.querySelector('.uistory-badge')?.textContent).toBe('9+');
    rerender(<StoryBubble badge="!" label="a" />);
    expect(container.querySelector('.uistory-badge--alert')?.textContent).toBe('!');
    rerender(<StoryBubble badge={0} label="a" />);
    expect(container.querySelector('.uistory-badge')).toBeNull();
  });

  it('"more" renders +N in a more ring and ignores tone, ring dot and badge', () => {
    const { container } = render(
      <StoryBubble more={5} ring="live" tone="ok" badge={3} label="m" />,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('uistory--more');
    expect(el.className).not.toContain('uistory--toned');
    expect(screen.getByText('+5').className).toContain('uistory-face--more');
    expect(container.querySelector('.uistory-live')).toBeNull();
    expect(container.querySelector('.uistory-badge')).toBeNull();
  });

  it('is a button only when onClick is given, and fires it', () => {
    const onClick = vi.fn();
    const { rerender } = render(<StoryBubble label="a" aria-label="open a" onClick={onClick} />);
    const btn = screen.getByRole('button', { name: 'open a' });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<StoryBubble label="a" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('exports consistent ring/face sizes and row helpers', () => {
    for (const s of ['xs', 'sm', 'md', 'lg'] as const)
      expect(STORY_FACE_PX[s]).toBeLessThan(STORY_RING_PX[s]);
    const { container } = render(
      <StoryRow className="extra">
        <StoryDivider />
      </StoryRow>,
    );
    expect((container.firstChild as HTMLElement).className).toBe('uistory-row extra');
    expect(container.querySelector('.uistory-divider')?.getAttribute('aria-hidden')).toBe('true');
  });
});
