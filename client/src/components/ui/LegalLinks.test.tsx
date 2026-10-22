import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AiTag } from './AiTag';
import { LegalLinks } from './LegalLinks';

afterEach(cleanup);

describe('LegalLinks', () => {
  it('is a named nav with the hash-route defaults, overridable for clean paths', () => {
    const { rerender } = render(
      <LegalLinks label="Legal" privacyLabel="Privacy Policy" termsLabel="Terms of Use" />,
    );
    const nav = screen.getByRole('navigation', { name: 'Legal' });
    expect(nav.querySelector('a[href="#/privacy"]')?.textContent).toBe('Privacy Policy');
    expect(nav.querySelector('a[href="#/terms"]')?.textContent).toBe('Terms of Use');
    rerender(
      <LegalLinks
        label="Legal"
        privacyLabel="P"
        termsLabel="T"
        privacyHref="/privacy"
        termsHref="/terms"
        align="start"
      />,
    );
    expect(screen.getByRole('link', { name: 'P' }).getAttribute('href')).toBe('/privacy');
    expect(screen.getByRole('link', { name: 'T' }).getAttribute('href')).toBe('/terms');
  });
});

describe('AiTag', () => {
  it('shows the given word', () => {
    render(<AiTag label="AI" />);
    expect(screen.getByText('AI')).toBeTruthy();
  });
});
