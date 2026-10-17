import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ANATOMY_FOCUS, AnatomyMap, TURN_FRAMES, TURN_STEP, file } from './AnatomyMap';

afterEach(cleanup);

const layers = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>('.uianat-layer'));

describe('anatomy file helpers', () => {
  it('turn constants make a full circle', () => {
    expect(TURN_STEP * TURN_FRAMES).toBe(360);
  });

  it('file() builds a side path for a named view and a turn path for an angle', () => {
    expect(file('bones', 'front')).toMatch(/anatomy\/bones\.front\.webp$/);
    expect(file('bones', 'left')).toMatch(/anatomy\/bones\.left\.webp$/);
    expect(file('heart', 90)).toMatch(/anatomy\/turn\/heart\/90\.webp$/);
  });

  it('every focus box is a non-empty rectangle inside the canvas', () => {
    for (const [x0, y0, x1, y1] of Object.values(ANATOMY_FOCUS)) {
      expect(x1).toBeGreaterThan(x0);
      expect(y1).toBeGreaterThan(y0);
      expect(Math.min(x0, y0)).toBeGreaterThanOrEqual(0);
      expect(Math.max(x1, y1)).toBeLessThanOrEqual(1);
    }
  });
});

describe('AnatomyMap', () => {
  it('is a labelled image with just the bones layer by default', () => {
    const { container } = render(<AnatomyMap label="Whole skeleton" />);
    const root = screen.getByRole('img', { name: 'Whole skeleton' });
    expect(root.className).toBe('uianat');
    const ls = layers(container);
    expect(ls).toHaveLength(1);
    expect(ls[0].className).toContain('uianat-bones');
    expect(ls[0].getAttribute('style')).toContain('bones.front.webp');
  });

  it('muscles base adds a muscles layer under the bones', () => {
    const { container } = render(<AnatomyMap label="x" base="muscles" view="back" />);
    const ls = layers(container);
    expect(ls.map((l) => l.className.split(' ')[1])).toEqual(['uianat-muscles', 'uianat-bones']);
    expect(ls[0].getAttribute('style')).toContain('muscles.back.webp');
  });

  it('draws organs between the bones and the marks, and marks in the chronic tone by default', () => {
    const { container } = render(
      <AnatomyMap
        label="x"
        organs={['heart', 'lungs']}
        marks={[{ layer: 'knee_l' }, { layer: 'hip_r', tone: 'danger' }]}
      />,
    );
    const ls = layers(container);
    expect(ls.map((l) => l.className.split(' ')[1])).toEqual([
      'uianat-bones',
      'uianat-organ',
      'uianat-organ',
      'uianat-mark',
      'uianat-mark',
    ]);
    expect(ls[1].getAttribute('style')).toContain('heart.front.webp');
    expect(ls[3].className).toContain('uit--chronic');
    expect(ls[4].className).toContain('uit--danger');
    expect(ls[4].getAttribute('style')).toContain('hip_r.front.webp');
  });

  it('a numeric view uses the turntable frames', () => {
    const { container } = render(<AnatomyMap label="x" view={45} marks={[{ layer: 'skull' }]} />);
    const styles = layers(container).map((l) => l.getAttribute('style'));
    expect(styles[0]).toContain('turn/bones/45.webp');
    expect(styles[1]).toContain('turn/skull/45.webp');
  });

  it('focus sets the crop variables as fractions of the canvas', () => {
    const { rerender } = render(<AnatomyMap label="x" />);
    let root = screen.getByRole('img');
    const [x0, y0, x1, y1] = ANATOMY_FOCUS.full;
    expect(root.style.getPropertyValue('--am-x0')).toBe(String(x0));
    expect(root.style.getPropertyValue('--am-y0')).toBe(String(y0));
    expect(Number(root.style.getPropertyValue('--am-w'))).toBeCloseTo(x1 - x0);
    expect(Number(root.style.getPropertyValue('--am-h'))).toBeCloseTo(y1 - y0);
    rerender(<AnatomyMap label="x" focus="knees" />);
    root = screen.getByRole('img');
    expect(root.style.getPropertyValue('--am-x0')).toBe(String(ANATOMY_FOCUS.knees[0]));
  });

  it('className is appended to the root', () => {
    render(<AnatomyMap label="x" className="mine" />);
    expect(screen.getByRole('img').className).toBe('uianat mine');
  });
});
