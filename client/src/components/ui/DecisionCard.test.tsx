import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DecisionCard } from './DecisionCard';

afterEach(cleanup);

const base = { clientName: 'Maria Tkach', messageLabel: 'Message Maria', title: 'Squat stalled' };

describe('DecisionCard', () => {
  it('renders name, sub, title and body; title is an h2 by default', () => {
    render(<DecisionCard {...base} clientSub="Upper/Lower 4x" body="Flat for 4 weeks" />);
    expect(screen.getByText('Maria Tkach')).toBeTruthy();
    expect(screen.getByText('Upper/Lower 4x')).toBeTruthy();
    expect(screen.getByText('Flat for 4 weeks')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Squat stalled' })).toBeTruthy();
  });

  it('headingLevel 3 renders an h3', () => {
    render(<DecisionCard {...base} headingLevel={3} />);
    expect(screen.getByRole('heading', { level: 3 })).toBeTruthy();
  });

  it('uses id to label the section by its title', () => {
    render(<DecisionCard {...base} id="dc1" />);
    const section = screen.getByRole('region', { name: 'Squat stalled' });
    expect(section.id).toBe('dc1');
    expect(screen.getByRole('heading').id).toBe('dc1-title');
  });

  it('message button fires onMessage', () => {
    const onMessage = vi.fn();
    render(<DecisionCard {...base} onMessage={onMessage} />);
    fireEvent.click(screen.getByRole('button', { name: 'Message Maria' }));
    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  it('renders tags only when given', () => {
    const { container, rerender } = render(<DecisionCard {...base} tags={[]} />);
    expect(container.querySelector('.uidc-tags')).toBeNull();
    rerender(
      <DecisionCard {...base} tags={[{ label: 'Stall', tone: 'danger' }, { label: 'Lower' }]} />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Stall')).toBeTruthy();
  });

  it('shows hero and chart blocks only when provided', () => {
    const { container, rerender } = render(<DecisionCard {...base} />);
    expect(container.querySelector('.uidc-evid')).toBeNull();
    rerender(
      <DecisionCard
        {...base}
        hero={{ label: 'e1RM', value: '116', unit: 'kg' }}
        chart={<div data-testid="chart" />}
      />,
    );
    expect(container.querySelector('.uidc-evid')).not.toBeNull();
    expect(screen.getByText('116')).toBeTruthy();
    expect(screen.getByTestId('chart')).toBeTruthy();
  });

  it('primary action fires and shows the effect line', () => {
    const onClick = vi.fn();
    render(
      <DecisionCard
        {...base}
        primary={{ label: 'Add a deload', onClick }}
        effect="Checked in 2 weeks"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a deload' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Checked in 2 weeks')).toBeTruthy();
  });

  it('evidence link and others toggle expose aria-expanded and the panel', () => {
    const onEvidence = vi.fn();
    const onOthers = vi.fn();
    const { rerender } = render(
      <DecisionCard
        {...base}
        evidence={{ label: 'See evidence', onClick: onEvidence }}
        others={{ label: '2 other options', expanded: false, onClick: onOthers }}
        othersPanel={<div data-testid="panel" />}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /See evidence/ }));
    expect(onEvidence).toHaveBeenCalledTimes(1);
    const toggle = screen.getByRole('button', { name: /2 other options/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('panel')).toBeNull();
    fireEvent.click(toggle);
    expect(onOthers).toHaveBeenCalledTimes(1);
    rerender(
      <DecisionCard
        {...base}
        others={{ label: '2 other options', expanded: true, onClick: onOthers }}
        othersPanel={<div data-testid="panel" />}
      />,
    );
    expect(
      screen.getByRole('button', { name: /2 other options/ }).getAttribute('aria-expanded'),
    ).toBe('true');
    expect(screen.getByTestId('panel')).toBeTruthy();
  });

  it('uses a custom avatar instead of the default initials', () => {
    render(<DecisionCard {...base} avatar={<span data-testid="av" />} />);
    expect(screen.getByTestId('av')).toBeTruthy();
  });
});
