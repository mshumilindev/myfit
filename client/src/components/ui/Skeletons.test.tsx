import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ProfileSkeleton, RowListSkeleton, ScreenSkeleton } from './Skeletons';

afterEach(cleanup);

describe('ScreenSkeleton', () => {
  it('is a polite labelled status with the Today-shaped blocks', () => {
    const { container } = render(<ScreenSkeleton label="Loading today" />);
    const root = screen.getByRole('status', { name: 'Loading today' });
    expect(root.getAttribute('aria-live')).toBe('polite');
    expect(container.querySelectorAll('.skel-week .uisk')).toHaveLength(7);
    expect(container.querySelectorAll('.skel-recent-row')).toHaveLength(3);
    expect(container.querySelector('.skel-cta')).not.toBeNull();
  });

  it('works without a label', () => {
    render(<ScreenSkeleton />);
    expect(screen.getByRole('status').hasAttribute('aria-label')).toBe(false);
  });
});

describe('RowListSkeleton', () => {
  it('defaults to 3 people rows with avatar and meta, hidden from AT', () => {
    const { container } = render(<RowListSkeleton />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.getAttribute('role')).toBe('presentation');
    expect(container.querySelectorAll('.row-list-skel-item')).toHaveLength(3);
    expect(container.querySelectorAll('.row-list-skel-avatar')).toHaveLength(3);
    expect(container.querySelectorAll('.row-list-skel-line')).toHaveLength(3);
    expect(container.querySelectorAll('.row-list-skel-meta')).toHaveLength(6);
  });

  it('withAvatar={false} drops the avatars', () => {
    const { container } = render(<RowListSkeleton rows={2} withAvatar={false} />);
    expect(container.querySelectorAll('.row-list-skel-item')).toHaveLength(2);
    expect(container.querySelector('.row-list-skel-avatar')).toBeNull();
  });

  it('withMeta={false} is the avatar-row shape with a body and a fixed-size avatar', () => {
    const { container } = render(<RowListSkeleton rows={2} withMeta={false} className="c" />);
    expect((container.firstChild as HTMLElement).className).toContain('c');
    expect(container.querySelectorAll('.row-list-skel-body')).toHaveLength(2);
    expect(container.querySelector('.row-list-skel-line')).toBeNull();
    const avatar = container.querySelector('.row-list-skel-avatar') as HTMLElement;
    expect(avatar.style.width).toBe('44px');
  });
});

describe('ProfileSkeleton', () => {
  it('renders the profile blocks hidden from assistive tech', () => {
    const { container } = render(<ProfileSkeleton />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toBe('profile-skel');
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.profile-skel-card')).not.toBeNull();
    expect(container.querySelectorAll('.uisk').length).toBeGreaterThan(15);
  });
});
