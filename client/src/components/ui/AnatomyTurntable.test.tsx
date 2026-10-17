import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AnatomyTurntable, type TurnCamera } from './AnatomyTurntable';

// jsdom has no canvas 2d context and no createImageBitmap, so the frame pipeline never starts
// (the component skips it by design). This file is a smoke render of the DOM contract: the stage,
// its a11y, the caption/hint and the rotatable switch.

afterEach(cleanup);

const camera: TurnCamera = { yaw: 0, y: 0.5, zoom: 1, n: 0 };

describe('AnatomyTurntable (smoke, no canvas pipeline in jsdom)', () => {
  it('renders a labelled image stage with a canvas and no caption or hint by default', () => {
    const { container } = render(<AnatomyTurntable label="Spine" camera={camera} />);
    const stage = screen.getByRole('img', { name: 'Spine' });
    expect(stage.className).toContain('uiturn-stage');
    expect(stage.querySelector('canvas.uiturn-canvas')).toBeTruthy();
    expect(container.querySelector('.uiturn-caption')).toBeNull();
    expect(container.querySelector('.uiturn-hint')).toBeNull();
  });

  it('rotatable (default) is keyboard focusable and shows the hint and caption', () => {
    render(
      <AnatomyTurntable label="Spine" camera={camera} hint="Drag to rotate" caption="Lumbar" />,
    );
    const stage = screen.getByRole('img');
    expect(stage.className).toContain('rot');
    expect(stage.getAttribute('tabindex')).toBe('0');
    expect(screen.getByText('Drag to rotate').className).toContain('uiturn-hint');
    expect(screen.getByText('Lumbar').className).toContain('uiturn-caption');
  });

  it('rotatable=false is not focusable and hides the hint but keeps the caption', () => {
    render(
      <AnatomyTurntable
        label="Spine"
        camera={camera}
        rotatable={false}
        hint="Drag to rotate"
        caption="Lumbar"
      />,
    );
    const stage = screen.getByRole('img');
    expect(stage.className).not.toContain('rot');
    expect(stage.getAttribute('tabindex')).toBe('-1');
    expect(screen.queryByText('Drag to rotate')).toBeNull();
    expect(screen.getByText('Lumbar')).toBeTruthy();
  });

  it('arrow keys are consumed when rotatable and ignored otherwise; other keys pass', () => {
    const { rerender } = render(<AnatomyTurntable label="x" camera={camera} />);
    let stage = screen.getByRole('img');
    // fireEvent returns false when preventDefault was called
    expect(fireEvent.keyDown(stage, { key: 'ArrowLeft' })).toBe(false);
    expect(fireEvent.keyDown(stage, { key: 'ArrowRight' })).toBe(false);
    expect(fireEvent.keyDown(stage, { key: 'a' })).toBe(true);
    rerender(<AnatomyTurntable label="x" camera={camera} rotatable={false} />);
    stage = screen.getByRole('img');
    expect(fireEvent.keyDown(stage, { key: 'ArrowLeft' })).toBe(true);
  });

  it('accepts bases, organs, marks and a changed camera without throwing', () => {
    const { rerender } = render(
      <AnatomyTurntable
        label="x"
        camera={camera}
        base="muscles"
        organs={['heart', 'lungs']}
        activeOrgans={['heart']}
        marks={[{ layer: 'knee_l', tone: 'danger' }]}
      />,
    );
    rerender(
      <AnatomyTurntable label="x" camera={{ yaw: 180, y: 0.3, zoom: 2.5, n: 1 }} base="bones" />,
    );
    expect(screen.getByRole('img', { name: 'x' })).toBeTruthy();
  });
});
