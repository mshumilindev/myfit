import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StageBoard, type BoardStage } from './StageBoard';

afterEach(cleanup);

const stages: BoardStage[] = [
  {
    id: 'signal',
    label: 'Signal',
    icon: 'warning',
    cards: [
      {
        id: 'c1',
        name: 'Oleh',
        fullName: 'Oleh K',
        status: 'Urgent',
        tone: 'danger',
        title: 'Knee pain',
        line: 'Since Monday',
      },
      { id: 'c2', name: 'Ana', fullName: 'Ana B', status: 'Watch', tone: 'illness', title: 'Cold' },
    ],
  },
  { id: 'result', label: 'Result', icon: 'check', cards: [] },
];

const common = { stages, onOpen: () => {}, label: 'Stage board', emptyText: 'Nothing here' };

describe('StageBoard columns', () => {
  it('renders a scroll region and a column per stage with counts', () => {
    render(<StageBoard {...common} />);
    expect(screen.getByRole('region', { name: 'Stage board' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Signal/ })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Result/ })).toBeTruthy();
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
  });

  it('cards are buttons named by full name, status and title and fire onOpen', () => {
    const onOpen = vi.fn();
    render(<StageBoard {...common} onOpen={onOpen} />);
    const card = screen.getByRole('button', { name: 'Oleh K, Urgent: Knee pain' });
    expect(card.textContent).toContain('Since Monday');
    fireEvent.click(card);
    expect(onOpen).toHaveBeenCalledWith('c1');
  });

  it('shows the empty text for a stage without cards', () => {
    render(<StageBoard {...common} />);
    expect(screen.getByText('Nothing here').className).toBe('uistage-empty');
  });

  it('selectedId marks one card current', () => {
    render(<StageBoard {...common} selectedId="c2" />);
    const on = screen.getByRole('button', { name: 'Ana B, Watch: Cold' });
    expect(on.getAttribute('aria-current')).toBe('true');
    expect(on.className).toContain('is-on');
    expect(screen.getByRole('button', { name: /Oleh K/ }).hasAttribute('aria-current')).toBe(false);
  });

  it('uses renderAvatar when given and renders the footer', () => {
    render(
      <StageBoard
        {...common}
        renderAvatar={(c, size) => <i data-testid={`av-${c.id}`} data-size={size} />}
        footer={<span>Foot</span>}
      />,
    );
    expect(screen.getByTestId('av-c1').getAttribute('data-size')).toBe('28');
    expect(screen.getByText('Foot').parentElement?.className).toBe('uistage-foot');
  });

  it('has no fold buttons without foldLabel; with it a column folds and unfolds', () => {
    const foldLabel = (l: string, folded: boolean) => (folded ? `Expand ${l}` : `Fold ${l}`);
    const { rerender } = render(<StageBoard {...common} />);
    expect(screen.queryByRole('button', { name: /Fold/ })).toBeNull();
    rerender(<StageBoard {...common} foldLabel={foldLabel} />);
    const fold = screen.getByRole('button', { name: 'Fold Signal' });
    expect(fold.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(fold);
    expect(screen.queryByRole('button', { name: /Oleh K/ })).toBeNull();
    const expand = screen.getByRole('button', { name: 'Expand Signal' });
    expect(expand.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(expand);
    expect(screen.getByRole('button', { name: /Oleh K/ })).toBeTruthy();
  });

  it('defaultFolded starts a column folded', () => {
    const { container } = render(
      <StageBoard {...common} foldLabel={(l) => l} defaultFolded={['signal']} />,
    );
    expect(container.querySelector('.uistage-col.is-folded')).not.toBeNull();
    expect(container.querySelector('.uistage-cols')?.className).toContain('has-folded');
    expect(screen.queryByRole('button', { name: /Oleh K/ })).toBeNull();
  });
});

describe('StageBoard accordion', () => {
  it('starts collapsed with aria-expanded=false and no region', () => {
    render(<StageBoard {...common} accordion />);
    expect(screen.queryByRole('region')).toBeNull();
    const head = screen.getByRole('button', { name: /Signal/ });
    expect(head.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: /Oleh K/ })).toBeNull();
  });

  it('toggles a stage open and closed; only one is open at a time', () => {
    render(<StageBoard {...common} accordion />);
    const signal = screen.getByRole('button', { name: /Signal/ });
    fireEvent.click(signal);
    expect(signal.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: /Oleh K/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Result/ }));
    expect(signal.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByText('Nothing here')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Result/ }));
    expect(screen.queryByText('Nothing here')).toBeNull();
  });

  it('defaultOpen opens a stage and aria-controls points at its body', () => {
    const { container } = render(<StageBoard {...common} accordion defaultOpen="signal" />);
    const head = screen.getByRole('button', { name: /Signal/ });
    expect(head.getAttribute('aria-expanded')).toBe('true');
    const body = container.querySelector('.uistage-acc-body') as HTMLElement;
    expect(head.getAttribute('aria-controls')).toBe(body.id);
  });
});
