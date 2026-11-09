import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ProgramProgress } from './ProgramProgress';

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-theme');
});

describe('ProgramProgress', () => {
  it('draws the vessel of water in Studio', () => {
    document.documentElement.dataset.theme = 'studio';
    render(
      <ProgramProgress pct={67} label="Plan progress">
        <span>fallback</span>
      </ProgramProgress>,
    );
    expect(
      screen.getByRole('progressbar', { name: 'Plan progress' }).getAttribute('aria-valuenow'),
    ).toBe('67');
    expect(screen.queryByText('fallback')).toBeNull();
  });
  it('keeps the usual percentage and bar elsewhere', () => {
    document.documentElement.dataset.theme = 'glass';
    render(
      <ProgramProgress pct={67} label="Plan progress">
        <span>fallback</span>
      </ProgramProgress>,
    );
    expect(screen.getByText('fallback')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});
