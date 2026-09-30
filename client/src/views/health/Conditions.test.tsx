import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  ConditionPage,
  ConditionsOnboardingRow,
  ConditionsProfileRow,
  ConditionsSection,
} from './Conditions';
import { setFlag } from '../../data/flags';
import { __getStateForTests } from '../../store';

afterEach(cleanup);

function Flow() {
  const [key, setKey] = useState<string | undefined>();
  return (
    <ConditionPage
      cond="new"
      condKey={key}
      web={false}
      onBack={() => undefined}
      onPickKey={setKey}
    />
  );
}

describe('conditions pages', () => {
  it('opens Add from the list', () => {
    let opened = '';
    render(<ConditionsSection onOpen={(c) => (opened = c)} />);
    fireEvent.click(screen.getByText(/^(Add a condition|Додати стан)$/));
    expect(opened).toBe('new');
  });

  it('searches the catalogue, picks one and saves it', async () => {
    render(<Flow />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'asthma' } });
    const hit = await screen.findAllByText(/asthma/i);
    fireEvent.click(hit[0]);
    fireEvent.click(screen.getByRole('button', { name: /^(Add condition|Додати стан)$/ }));
    expect(__getStateForTests().conditions.length).toBeGreaterThan(0);
  });

  it('profile row: hidden with the flag off, opens Health with it on', () => {
    setFlag('conditions', false);
    let n = 0;
    const { container } = render(<ConditionsProfileRow onOpen={() => n++} />);
    expect(container.textContent).toBe('');
    cleanup();
    setFlag('conditions', true);
    render(<ConditionsProfileRow onOpen={() => n++} />);
    fireEvent.click(screen.getByText(/^(Long-term conditions|Тривалі стани)$/));
    expect(n).toBe(1);
    setFlag('conditions', false);
  });

  it('onboarding row: optional, says it is private, opens the add flow', () => {
    setFlag('conditions', false);
    const off = render(<ConditionsOnboardingRow onOpen={() => undefined} />);
    expect(off.container.textContent).toBe('');
    cleanup();
    setFlag('conditions', true);
    let n = 0;
    render(<ConditionsOnboardingRow onOpen={() => n++} />);
    expect(screen.getByText(/encrypted|зашифровано/i)).toBeTruthy();
    fireEvent.click(screen.getByText(/long-term health conditions|тривалі проблеми/i));
    expect(n).toBe(1);
    setFlag('conditions', false);
  });
});
