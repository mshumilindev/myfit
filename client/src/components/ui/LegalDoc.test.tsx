import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DocTable, LegalDoc } from './LegalDoc';

afterEach(cleanup);

const sections = [
  { id: 'a1', title: 'Who we are', body: <p>First body</p> },
  { id: 'a2', title: 'Your rights', body: <p>Second body</p> },
];

function setup(over: Partial<React.ComponentProps<typeof LegalDoc>> = {}) {
  const onPrint = vi.fn();
  render(
    <LegalDoc
      title="Spotter Privacy Policy"
      versionLabel="Version 2026-10-21"
      updatedLabel="Last updated 21 October 2026"
      sections={sections}
      brand={<span>spotter</span>}
      brandLabel="Spotter home"
      headerEnd={<button type="button">EN</button>}
      contentsLabel="Contents"
      saveLabel="Save as PDF"
      printLabel="Print"
      saveHint="Both open the print dialog."
      onPrint={onPrint}
      footer={<a href="#/terms">Terms of Use</a>}
      {...over}
    />,
  );
  return { onPrint };
}

describe('LegalDoc', () => {
  it('shows title, version and date, numbered sections with anchors', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Spotter Privacy Policy');
    expect(screen.getAllByText('Version 2026-10-21').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Last updated 21 October 2026').length).toBeGreaterThan(0);
    const h2 = screen.getAllByRole('heading', { level: 2 });
    expect(h2.map((h) => h.textContent)).toEqual(['1. Who we are', '2. Your rights']);
    expect(document.getElementById('a1')?.tagName).toBe('SECTION');
    expect(document.getElementById('a2')?.contains(h2[1])).toBe(true);
  });

  it('contents entries link to the section ids and scroll instead of navigating', () => {
    setup();
    const nav = screen.getByRole('navigation', { name: 'Contents' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['#a1', '#a2']);
    const target = document.getElementById('a2') as HTMLElement;
    const scroll = vi.fn();
    target.scrollIntoView = scroll;
    // preventDefault is honoured: the URL hash (the app's route) is not touched
    expect(fireEvent.click(links[1])).toBe(false);
    expect(scroll).toHaveBeenCalledTimes(1);
  });

  it('Save as PDF and Print both open the print dialog, and the hint says so', () => {
    const { onPrint } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Save as PDF' }));
    fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(onPrint).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Both open the print dialog.')).toBeTruthy();
  });

  it('has the language slot, the brand link and the footer, and no Contact link', () => {
    setup();
    expect(screen.getByRole('button', { name: 'EN' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Spotter home' }).getAttribute('href')).toBe('#/');
    expect(screen.getByRole('link', { name: 'Terms of Use' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /contact/i })).toBeNull();
  });

  it('shows the back control in the header only when given one, and calls it', () => {
    setup();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    cleanup();
    const onBack = vi.fn();
    setup({ backLabel: 'Back', onBack });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('marks the chrome as not printed and prints the version line once in the body', () => {
    setup();
    const noPrint = document.querySelectorAll('.uild-noprint');
    expect(noPrint.length).toBeGreaterThanOrEqual(3); // header, contents, footer
    expect(document.querySelector('.uild-print-meta')?.textContent).toContain('Version 2026-10-21');
  });

  it('shows a note only when given', () => {
    setup({ note: 'The English text is shown.' });
    expect(screen.getByText('The English text is shown.')).toBeTruthy();
  });

  it('DocTable renders head cells as column headers', () => {
    cleanup();
    render(<DocTable head={['What', 'Why']} rows={[['A', 'B']]} />);
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['What', 'Why']);
    expect(screen.getByRole('cell', { name: 'A' })).toBeTruthy();
  });
});
