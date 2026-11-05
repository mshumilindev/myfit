// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
afterEach(cleanup);
import { SkBadge } from './SkBadge';

describe('SkBadge', () => {
  it.each(['app', 'add', 'soon', 'ok', 'warn', 'new'] as const)('kind %s maps to a class', (k) => {
    render(<SkBadge kind={k}>{k}</SkBadge>);
    expect(screen.getByText(k).className).toContain(`sk-bd-${k}`);
  });
});
