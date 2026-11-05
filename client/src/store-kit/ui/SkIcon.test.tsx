// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
afterEach(cleanup);
import { SK_ICON_PATHS } from './SkIcon.paths';
import { SkIcon } from './SkIcon';

describe('SkIcon', () => {
  it('is decorative by default', () => {
    const { container } = render(<SkIcon name="check" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.querySelector('path')!.getAttribute('d')).toBe(SK_ICON_PATHS.check);
  });
  it('small adds the small class', () => {
    const { container } = render(<SkIcon name="x" small />);
    expect(container.querySelector('svg')!.getAttribute('class')).toContain('sk-svg-s');
  });
  it('becomes an img with a label', () => {
    render(<SkIcon name="bell" label="Alerts" />);
    expect(screen.getByRole('img', { name: 'Alerts' })).toBeTruthy();
  });
});
