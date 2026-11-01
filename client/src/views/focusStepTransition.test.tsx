import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FADE_MS,
  SLIDE_DIM,
  SLIDE_GAP,
  SLIDE_MS,
  SLIDE_SCALE,
  stepKeyframes,
  stepMode,
  useFocusStepTransition,
} from './focusStepTransition';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (Element.prototype as { animate?: unknown }).animate;
});

describe('stepKeyframes', () => {
  it('Next sends the old card left and brings the new one from the right, both shrunk and dimmed', () => {
    const kf = stepKeyframes('slide', 1, 300);
    const dx = 300 + SLIDE_GAP;
    expect(kf.out[1]).toMatchObject({
      transform: `translateX(${-dx}px) scale(${SLIDE_SCALE})`,
      opacity: SLIDE_DIM,
    });
    expect(kf.in[0]).toMatchObject({
      transform: `translateX(${dx}px) scale(${SLIDE_SCALE})`,
      opacity: SLIDE_DIM,
    });
    expect(kf.in[1]).toMatchObject({ transform: 'none', opacity: 1 });
    expect(kf.options.duration).toBe(SLIDE_MS);
  });

  it('Back mirrors the direction', () => {
    const kf = stepKeyframes('slide', -1, 300);
    expect(kf.out[1].transform).toContain('translateX(316px)');
    expect(kf.in[0].transform).toContain('translateX(-316px)');
  });

  it('stays inside the 250-450 ms budget of SPO-323', () => {
    expect(SLIDE_MS).toBeGreaterThanOrEqual(250);
    expect(SLIDE_MS).toBeLessThanOrEqual(450);
  });

  it('the fade variant only touches opacity and is shorter', () => {
    const kf = stepKeyframes('fade', 1, 300);
    expect(JSON.stringify(kf)).not.toContain('transform');
    expect(kf.options.duration).toBe(FADE_MS);
  });
});

describe('stepMode', () => {
  it('reduced motion or a static motion tier gets the cross-fade, everything else slides', () => {
    expect(stepMode(true, 'full')).toBe('fade');
    expect(stepMode(false, 'static')).toBe('fade');
    expect(stepMode(false, 'full')).toBe('slide');
    expect(stepMode(false, 'pending')).toBe('slide');
  });
});

function Harness({ onGo }: { onGo?: (dir: 1 | -1) => void }) {
  const stage = useRef<HTMLDivElement>(null);
  const live = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const tr = useFocusStepTransition(stage, live, step);
  const go = (to: number) => {
    onGo?.(to > step ? 1 : -1);
    tr.prepare(to > step ? 1 : -1);
    setStep(to);
  };
  const jump = (to: number) => setStep(to);
  return (
    <div data-testid="scroller">
      <div className="focus-stage" ref={stage} data-testid="stage">
        <div className="focus-live" ref={live}>
          <input id="reps" name="reps" defaultValue="5" />
          <span>step {step}</span>
        </div>
      </div>
      <button onClick={() => go(step + 1)}>next</button>
      <button onClick={() => go(step - 1)}>back</button>
      <button onClick={() => jump(step + 2)}>jump</button>
    </div>
  );
}

function stubAnimate() {
  const cancels: ReturnType<typeof vi.fn>[] = [];
  const animate = vi.fn(function (this: Element) {
    const cancel = vi.fn();
    cancels.push(cancel);
    return { cancel, finished: new Promise<void>(() => undefined) } as unknown as Animation;
  });
  (Element.prototype as { animate?: unknown }).animate = animate;
  return { animate, cancels };
}

describe('useFocusStepTransition', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
  });

  it('on Next it lays an inert, id-free snapshot of the old card over the new one and animates both', () => {
    const { animate } = stubAnimate();
    const { getByText, getByTestId } = render(<Harness />);
    fireEvent.click(getByText('next'));
    const ghost = getByTestId('stage').querySelector('.focus-ghost') as HTMLElement;
    expect(ghost).toBeTruthy();
    expect(ghost.getAttribute('aria-hidden')).toBe('true');
    expect(ghost.hasAttribute('inert')).toBe(true);
    expect(ghost.textContent).toContain('step 0'); // the OLD card
    expect(ghost.querySelector('[id]')).toBeNull();
    expect(ghost.querySelector('[name]')).toBeNull();
    expect(getByTestId('stage').querySelector('.focus-live')?.textContent).toContain('step 1');
    expect(animate).toHaveBeenCalledTimes(2);
    // the stage's parent is the scroller: it must not grow a horizontal scroll while the cards travel
    expect(getByTestId('scroller').classList.contains('focus-moving')).toBe(true);
  });

  it('a second tap cancels the running animation and removes the old snapshot', () => {
    const { cancels } = stubAnimate();
    const { getByText, getByTestId } = render(<Harness />);
    fireEvent.click(getByText('next'));
    fireEvent.click(getByText('next'));
    expect(cancels[0]).toHaveBeenCalled();
    expect(cancels[1]).toHaveBeenCalled();
    expect(getByTestId('stage').querySelectorAll('.focus-ghost')).toHaveLength(1);
    expect(getByTestId('stage').querySelector('.focus-ghost')?.textContent).toContain('step 1');
  });

  it('reduced motion cross-fades instead of sliding', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never;
    const { animate } = stubAnimate();
    const { getByText } = render(<Harness />);
    fireEvent.click(getByText('next'));
    const [frames, options] = animate.mock.calls[0] as unknown as [
      Keyframe[],
      KeyframeAnimationOptions,
    ];
    expect(JSON.stringify(frames)).not.toContain('transform');
    expect(options.duration).toBe(FADE_MS);
  });

  it('a jump that did not come from Back/Next swaps the card without animating', () => {
    const { animate } = stubAnimate();
    const { getByText, getByTestId } = render(<Harness />);
    fireEvent.click(getByText('jump'));
    expect(animate).not.toHaveBeenCalled();
    expect(getByTestId('stage').querySelector('.focus-ghost')).toBeNull();
  });

  it('without Element.animate the card just swaps', () => {
    const { getByText, getByTestId } = render(<Harness />);
    fireEvent.click(getByText('next'));
    expect(getByTestId('stage').querySelector('.focus-ghost')).toBeNull();
    expect(getByTestId('stage').textContent).toContain('step 1');
  });

  it('removes the snapshot and the class when it unmounts mid-flight', () => {
    stubAnimate();
    const { getByText, getByTestId, unmount } = render(<Harness />);
    fireEvent.click(getByText('next'));
    const stage = getByTestId('stage');
    act(() => unmount());
    expect(stage.querySelector('.focus-ghost')).toBeNull();
  });
});
