import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ConditionPage, ConditionsSection } from './Conditions';
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
});
