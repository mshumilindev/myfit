import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GroupedList, ListPanel, ListRow } from './GroupedList';

afterEach(cleanup);

describe('GroupedList', () => {
  it('renders header, rows and footer; label names the section', () => {
    const { container } = render(
      <GroupedList header="Settings" footer="Footer" label="Prefs">
        <ListRow label="Row" />
      </GroupedList>,
    );
    expect(screen.getByRole('region', { name: 'Prefs' })).toBeTruthy();
    expect(container.querySelector('.uigl-h')?.textContent).toBe('Settings');
    expect(container.querySelector('.uigl-f')?.textContent).toBe('Footer');
    expect(screen.getByText('Row')).toBeTruthy();
  });

  it('omits header and footer when absent', () => {
    const { container } = render(
      <GroupedList>
        <ListRow label="Row" />
      </GroupedList>,
    );
    expect(container.querySelector('.uigl-h')).toBeNull();
    expect(container.querySelector('.uigl-f')).toBeNull();
  });

  it.each([
    ['raised', 'uigl--raised'],
    ['flat', 'uigl--flat'],
  ] as const)('surface %s adds %s', (surface, cls) => {
    const { container } = render(
      <GroupedList surface={surface} className="x">
        <ListRow label="Row" />
      </GroupedList>,
    );
    const cn = (container.firstChild as HTMLElement).className;
    expect(cn).toContain(cls);
    expect(cn).toContain('x');
  });

  it('list mode renders a labelled ul and moves the label off the section', () => {
    render(
      <GroupedList list label="Clients">
        <li>
          <ListRow label="A" />
        </li>
      </GroupedList>,
    );
    expect(screen.getByRole('list', { name: 'Clients' })).toBeTruthy();
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('rowsRole puts role, label and id on the rows container', () => {
    render(
      <GroupedList rowsRole="listbox" rowsId="rows1" label="Pick">
        <ListRow label="A" role="option" />
      </GroupedList>,
    );
    const box = screen.getByRole('listbox', { name: 'Pick' });
    expect(box.id).toBe('rows1');
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('footerError is an alert; notes render as extra footer lines', () => {
    const { container } = render(
      <GroupedList footer="Bad" footerError notes={['n1', 'n2']}>
        <ListRow label="A" />
      </GroupedList>,
    );
    expect(screen.getByRole('alert').className).toContain('is-error');
    expect(container.querySelectorAll('.uigl-f')).toHaveLength(3);
  });
});

describe('ListRow', () => {
  it('plain row is a div with label, sub and value', () => {
    const { container } = render(<ListRow label="Name" sub="Sub" value="Val" valueStrong />);
    const row = container.firstElementChild as HTMLElement;
    expect(row.tagName).toBe('DIV');
    expect(screen.getByText('Sub').className).toBe('uirow-s');
    expect(screen.getByText('Val').className).toContain('is-strong');
  });

  it('onClick renders a button, fires, and honours disabled', () => {
    const onClick = vi.fn();
    const { rerender } = render(<ListRow label="Go" onClick={onClick} aria-expanded={false} />);
    const btn = screen.getByRole('button', { name: 'Go' });
    expect(btn.getAttribute('type')).toBe('button');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<ListRow label="Go" onClick={onClick} disabled />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('as=label renders a label element', () => {
    const { container } = render(<ListRow label="Sw" as="label" />);
    expect(container.firstElementChild?.tagName).toBe('LABEL');
  });

  it('state flags map to classes', () => {
    const { container } = render(
      <ListRow label="x" selected dim dense strong icon={<i />} tone="danger" className="c" />,
    );
    const cn = (container.firstElementChild as HTMLElement).className;
    for (const c of [
      'has-icon',
      'is-selected',
      'is-dim',
      'uirow--dense',
      'uirow--strong',
      'uit--danger',
      'c',
    ])
      expect(cn).toContain(c);
    expect(cn).not.toContain('is-toned');
  });

  it('action row centres the label only and toned', () => {
    const { container } = render(
      <ListRow label="Delete" action tone="danger" sub="ignored" value="ignored" chevron />,
    );
    const row = container.firstElementChild as HTMLElement;
    expect(row.className).toContain('uirow--action');
    expect(row.className).toContain('is-toned');
    expect(screen.getByText('Delete').className).toBe('uirow-action');
    expect(screen.queryByText('ignored')).toBeNull();
    expect(row.querySelector('.uirow-chev')).toBeNull();
  });

  it('value tone, wrap, time, check and chevron render', () => {
    const { container } = render(
      <ListRow label="x" time="02:00" value="v" valueTone="ok" wrap check checkTone="ok" chevron />,
    );
    expect(container.querySelector('.uirow-time')?.textContent).toBe('02:00');
    const v = container.querySelector('.uirow-v') as HTMLElement;
    expect(v.className).toContain('uit--ok');
    expect(v.className).toContain('is-toned');
    expect(v.className).toContain('is-wrap');
    expect(container.querySelector('.uirow-check')?.className).toContain('uit--ok');
    expect(container.querySelector('.uirow-chev')).not.toBeNull();
  });

  it('labelFixed marks the label block', () => {
    const { container } = render(<ListRow label="x" labelFixed />);
    expect(container.querySelector('.uirow-lb')?.className).toContain('is-fixed');
  });
});

describe('ListPanel', () => {
  it('wraps children with the panel class', () => {
    const { container } = render(<ListPanel className="x">in</ListPanel>);
    expect((container.firstChild as HTMLElement).className).toBe('uirow-panel x');
  });
});
