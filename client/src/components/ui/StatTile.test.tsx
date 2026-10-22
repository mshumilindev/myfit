import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { StatTile } from './StatTile';

afterEach(cleanup);

describe('StatTile', () => {
  it('renders label and value with neutral tone and no optional parts', () => {
    const { container } = render(<StatTile label="Readiness" value="82" />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('uistat');
    expect(root.className).toContain('uit--neutral');
    expect(root.className).not.toContain('uistat--big');
    expect(screen.getByText('Readiness').className).toBe('uistat-l');
    expect(screen.getByText('82').className).toBe('uistat-v');
    for (const c of ['.uistat-u', '.uistat-d', '.uistat-s', '.uistat-bar']) {
      expect(container.querySelector(c)).toBeNull();
    }
  });

  it('renders unit, delta and sub when given', () => {
    render(<StatTile label="Bench" value="100" unit="kg" delta="+2.5 kg" sub="2 recovering" />);
    expect(screen.getByText('kg').className).toBe('uistat-u');
    expect(screen.getByText('+2.5 kg').className).toBe('uistat-d');
    expect(screen.getByText('2 recovering').className).toBe('uistat-s');
  });

  it('keeps a zero value, unit and delta (only null/undefined are skipped)', () => {
    const { container } = render(<StatTile label="L" value={0} unit={0} delta={0} />);
    expect(screen.getByText('0', { selector: '.uistat-v' })).toBeTruthy();
    expect(container.querySelector('.uistat-u')).not.toBeNull();
    expect(container.querySelector('.uistat-d')).not.toBeNull();
  });

  it('big and tone map to classes; className and attributes pass through', () => {
    render(<StatTile label="L" value="1" big tone="danger" className="x" data-testid="t" id="i" />);
    const el = screen.getByTestId('t');
    expect(el.className).toContain('uistat--big');
    expect(el.className).toContain('uit--danger');
    expect(el.className).toContain('x');
    expect(el.id).toBe('i');
  });

  it.each([
    [50, '50%'],
    [0, '0%'],
    [150, '100%'],
    [-20, '0%'],
  ])('bar=%s is clamped to %s and hidden from AT', (bar, width) => {
    const { container } = render(<StatTile label="L" value="1" bar={bar} />);
    const track = container.querySelector('.uistat-bar') as HTMLElement;
    expect(track.getAttribute('aria-hidden')).toBe('true');
    expect((track.firstChild as HTMLElement).style.width).toBe(width);
  });
});
