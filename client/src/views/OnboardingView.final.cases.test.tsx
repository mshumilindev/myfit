import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { emptyState, freezeClock, NOW, seed, setDesktop } from './__fixtures__/viewKit';
import {
  goto,
  m,
  open,
  place,
  resetOnboardingMocks,
  TOKEN,
  typeInto,
} from './__fixtures__/onboardingMocks';

beforeEach(() => {
  freezeClock(NOW);
  setLocale('en');
  setDesktop(false);
  resetOnboardingMocks();
  seed(emptyState());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('OnboardingView: step 4 body', () => {
  it('Continue needs both height and weight above zero', async () => {
    await goto(4);
    const cont = () => screen.getByText(en.onbContinue).closest('button') as HTMLButtonElement;
    const ins = () => screen.getAllByPlaceholderText('—');
    expect(cont().disabled).toBe(true);
    fireEvent.change(ins()[0], { target: { value: '180' } });
    expect(cont().disabled).toBe(true);
    fireEvent.change(ins()[1], { target: { value: '0' } });
    expect(cont().disabled).toBe(true);
    fireEvent.change(ins()[1], { target: { value: 'abc' } });
    expect(cont().disabled).toBe(true);
    fireEvent.change(ins()[1], { target: { value: '80' } });
    expect(cont().disabled).toBe(false);
    expect(document.querySelectorAll('.onb-bm-req')).toHaveLength(2);
  });

  it('saves metrics (comma decimals accepted, optional ones null) and logs the weight', async () => {
    await goto(4);
    const ins = screen.getAllByPlaceholderText('—');
    fireEvent.change(ins[0], { target: { value: '181,5' } });
    fireEvent.change(ins[1], { target: { value: '80,5' } });
    fireEvent.change(ins[2], { target: { value: '75' } });
    fireEvent.change(ins[3], { target: { value: '18' } });
    fireEvent.click(screen.getByText(en.onbContinue));
    expect(m.updateBody).toHaveBeenCalledWith({
      heightCm: 181.5,
      goalWeightKg: 75,
      bodyFatPct: 18,
      muscleKg: null,
    });
    expect(m.addWeight).toHaveBeenCalledWith(80.5, NOW);
    expect(screen.getByText(en.onbReady)).toBeTruthy();
  });

  it('optional fields left empty are stored as null', async () => {
    await goto(4);
    const ins = screen.getAllByPlaceholderText('—');
    fireEvent.change(ins[0], { target: { value: '170' } });
    fireEvent.change(ins[1], { target: { value: '60' } });
    fireEvent.click(screen.getByText(en.onbContinue));
    expect(m.updateBody).toHaveBeenCalledWith({
      heightCm: 170,
      goalWeightKg: null,
      bodyFatPct: null,
      muscleKg: null,
    });
  });
});

describe('OnboardingView: final step', () => {
  it('greets the user by name and starts the first workout, clearing progress', async () => {
    const { onDone } = await goto(5);
    expect(screen.getByText(en.onbWow)).toBeTruthy();
    expect(screen.getByText(en.onbWowBodyNoGym)).toBeTruthy();
    expect(document.querySelector('.onb-me .n')?.textContent).toBe('Ana');
    expect(document.querySelector('.onb-me .s')?.textContent).toBe(`${en.roleAdmin} · Coach Kim`);
    fireEvent.click(screen.getByText(en.onbStartTraining));
    expect(m.startWorkout).toHaveBeenCalledWith(null);
    expect(onDone).toHaveBeenCalledWith('w-1');
    expect(localStorage.getItem(`onb.${TOKEN}`)).toBeNull();
  });

  it('with a chosen gym shows it in the header, the lead and the backdrop, and starts there', async () => {
    m.pos.mockResolvedValue({ lat: 54.7, lng: 25.3, accuracy: 10 });
    m.nearby.mockResolvedValue([place()]);
    const out = await open();
    fireEvent.click(screen.getByText(en.onbStart));
    typeInto(en.firstName, 'Ana');
    typeInto(en.username, 'ana');
    typeInto(en.passwordMin, 'secret1');
    m.callFn.mockImplementation(async (n: string) =>
      n === 'claim' ? { token: 'jwt' } : m.inviteResult,
    );
    await act(async () => {
      fireEvent.click(screen.getByText(en.onbContinue));
    });
    fireEvent.click(screen.getByText(en.onbSkipInitials));
    await act(async () => {});
    fireEvent.click(document.querySelector('.onb-gym-card') as HTMLElement);
    const ins = screen.getAllByPlaceholderText('—');
    fireEvent.change(ins[0], { target: { value: '180' } });
    fireEvent.change(ins[1], { target: { value: '80' } });
    fireEvent.click(screen.getByText(en.onbContinue));
    expect(document.querySelector('.onb-ready')?.textContent).toContain('Iron Works');
    expect(screen.getByText(en.onbWowBody('Iron Works'))).toBeTruthy();
    expect(document.querySelector('.onb-final-bg [data-testid="thumb"]')?.textContent).toBe(
      'Iron Works',
    );
    fireEvent.click(screen.getByText(en.onbStartTraining));
    expect(m.startWorkout).toHaveBeenCalledWith('g-1');
    expect(out.onDone).toHaveBeenCalledWith('w-1');
  });

  it('does not finish when the workout cannot be started', async () => {
    m.startWorkout.mockReturnValue(null);
    const { onDone } = await goto(5);
    fireEvent.click(screen.getByText(en.onbStartTraining));
    expect(onDone).not.toHaveBeenCalled();
  });

  it('"just the app" finishes without a workout and clears progress', async () => {
    const { onDone } = await goto(5);
    fireEvent.click(screen.getByText(en.onbJustApp));
    expect(onDone).toHaveBeenCalledWith();
    expect(m.startWorkout).not.toHaveBeenCalled();
    expect(localStorage.getItem(`onb.${TOKEN}`)).toBeNull();
  });

  it('the health rows open their screens and Back returns to the final card', async () => {
    await goto(5);
    fireEvent.click(screen.getByText('row-cond'));
    expect(screen.getByTestId('cond-page')).toBeTruthy();
    expect(screen.queryByText(en.onbWow)).toBeNull();
    fireEvent.click(screen.getByText('pick-cond'));
    expect(screen.getByText('key:back_lumbar_disc')).toBeTruthy();
    fireEvent.click(screen.getByText('cond-back'));
    expect(screen.getByText(en.onbWow)).toBeTruthy();
    fireEvent.click(screen.getByText('row-cond'));
    expect(screen.getByText('key:none')).toBeTruthy();
    fireEvent.click(screen.getByText('cond-back'));

    fireEvent.click(screen.getByText('row-nic'));
    fireEvent.click(screen.getByText('nic-back'));
    fireEvent.click(screen.getByText('row-alc'));
    fireEvent.click(screen.getByText('alc-back'));
    expect(screen.getByText(en.onbWow)).toBeTruthy();
  });

  it('supplement quick start can close, or go to the full list and back', async () => {
    await goto(5);
    fireEvent.click(screen.getByText('row-sup'));
    fireEvent.click(screen.getByText('quick-close'));
    expect(screen.queryByTestId('sup-quick')).toBeNull();
    fireEvent.click(screen.getByText('row-sup'));
    fireEvent.click(screen.getByText('quick-more'));
    expect(screen.queryByTestId('sup-quick')).toBeNull();
    fireEvent.click(screen.getByText('sup-back'));
    expect(screen.getByText(en.onbWow)).toBeTruthy();
  });

  it('Back from the final step returns to the body step', async () => {
    await goto(5);
    fireEvent.click(screen.getByRole('button', { name: en.onbBack }));
    expect(screen.getByText(en.onbBodyLead)).toBeTruthy();
  });
});
