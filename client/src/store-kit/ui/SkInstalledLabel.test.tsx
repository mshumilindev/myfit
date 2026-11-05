// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
afterEach(cleanup);
import { SkInstalledLabel } from './SkInstalledLabel';

describe('SkInstalledLabel', () => {
  it('is a status, not a button', () => {
    render(<SkInstalledLabel>Installed</SkInstalledLabel>);
    expect(screen.getByRole('status').textContent).toBe('Installed');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
