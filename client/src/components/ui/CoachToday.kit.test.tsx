import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChoiceList } from './ChoiceList';
import { DecisionCard } from './DecisionCard';
import { EvidenceChart } from './EvidenceChart';
import { LiveWidget } from './LiveWidget';
import { RequestCard } from './RequestCard';
import { ClientRow } from './RosterRows';
import { StageBoard } from './StageBoard';
import { StepList } from './StepList';

afterEach(cleanup);

const pts = [111, 113, 116, 116, 115].map((v, i) => ({ label: `w${i}`, value: v }));

describe('EvidenceChart', () => {
  it('has a text alternative: role img with the summary, and the table in the DOM', () => {
    render(
      <EvidenceChart
        points={pts}
        xStart="4 weeks ago"
        xEnd="This week"
        unit="Estimated 1RM, kg"
        ariaLabel="Estimated 1RM 111 to 115 kg"
        table={{
          caption: 'Evidence table',
          head: ['Date', 'Est. 1RM'],
          rows: [['6 Oct', '116 kg']],
        }}
      />,
    );
    expect(screen.getByRole('img', { name: 'Estimated 1RM 111 to 115 kg' })).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Evidence table', hidden: true })).toBeTruthy();
  });
  it('draws at most the min and max labels on the y axis, x labels apart', () => {
    const { container } = render(
      <EvidenceChart points={pts} xStart="a" xEnd="b" unit="u" ariaLabel="x" />,
    );
    expect(container.querySelectorAll('.uievc-y span')).toHaveLength(2);
    expect(container.querySelectorAll('.uievc-x span')).toHaveLength(2);
  });
  it('under 2 points renders the empty note instead', () => {
    render(
      <EvidenceChart
        points={[]}
        xStart=""
        xEnd=""
        unit=""
        ariaLabel=""
        empty="Not enough sessions yet (needs 3)"
      />,
    );
    expect(screen.getByText('Not enough sessions yet (needs 3)')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('DecisionCard', () => {
  it('one filled primary; message and links are text actions', () => {
    const onMsg = vi.fn();
    render(
      <DecisionCard
        clientName="Oleh Bondar"
        messageLabel="Message Oleh"
        onMessage={onMsg}
        title="Bench press has not moved in 4 weeks"
        primary={{ label: 'Add a variation + 1 set', onClick: () => undefined }}
        evidence={{ label: 'See evidence and options', onClick: () => undefined }}
      />,
    );
    const prim = document.querySelectorAll('.uibtn--fill');
    expect(prim).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Message Oleh' }));
    expect(onMsg).toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 2 })).toBeTruthy();
  });
});

describe('RequestCard', () => {
  const act = (l: string, a: string) => ({ label: l, ariaLabel: a, onClick: vi.fn() });
  it('answer: Accept / Decline / Propose with client names; result replaces the buttons', () => {
    const accept = act('Accept', 'Accept move for Oleh');
    const { rerender } = render(
      <RequestCard
        kind="answer"
        title="t"
        status="Needs your answer"
        fromLabel="From"
        from="a"
        toLabel="To"
        to="b"
        accept={accept}
        decline={act('Decline', 'Decline move for Oleh')}
        propose={act('Propose another', 'Propose another time to Oleh')}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Accept move for Oleh' }));
    expect(accept.onClick).toHaveBeenCalled();
    rerender(
      <RequestCard
        kind="answer"
        title="t"
        status="s"
        fromLabel="From"
        from="a"
        toLabel="To"
        to="b"
        resultText="Accepted."
        accept={accept}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Accepted.');
  });
  it('waiting: only Cancel request', () => {
    render(
      <RequestCard
        kind="waiting"
        title="t"
        status="Waiting for Maria"
        fromLabel="From"
        from="a"
        toLabel="To"
        to="b"
        accept={act('Accept', 'A')}
        cancel={act('Cancel request', 'Cancel request to Maria')}
      />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
  it('busy disables the answers', () => {
    render(
      <RequestCard
        kind="answer"
        title="t"
        status="s"
        fromLabel="From"
        from="a"
        toLabel="To"
        to="b"
        busy
        accept={act('Accept', 'A1')}
        decline={act('Decline', 'D1')}
      />,
    );
    expect((screen.getByRole('button', { name: 'A1' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('StageBoard', () => {
  const card = (id: string) => ({
    id,
    name: 'Oleh',
    fullName: 'Oleh Bondar',
    status: 'Urgent',
    tone: 'danger' as const,
    title: `T ${id}`,
  });
  const stages = [
    { id: 'a', label: 'Signal', icon: 'pulse', cards: [card('1'), card('2')] },
    { id: 'b', label: 'Evidence', icon: 'magnifying-glass', cards: [] },
  ];
  it('columns: scroll region with a label, headings with counts, cards are buttons with names', () => {
    const onOpen = vi.fn();
    render(
      <StageBoard
        stages={stages}
        label="Stage board, scroll for more"
        emptyText="Nothing here"
        onOpen={onOpen}
      />,
    );
    const region = screen.getByRole('region', { name: 'Stage board, scroll for more' });
    expect(region.getAttribute('tabindex')).toBe('0');
    expect(within(region).getAllByRole('heading', { level: 2 })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Oleh Bondar, Urgent: T 1' }));
    expect(onOpen).toHaveBeenCalledWith('1');
    expect(screen.getByText('Nothing here')).toBeTruthy();
  });
  it('selected card is aria-current', () => {
    render(
      <StageBoard
        stages={stages}
        selectedId="2"
        label="l"
        emptyText="e"
        onOpen={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: /T 2/ }).getAttribute('aria-current')).toBe('true');
  });
  it('accordion: collapsed by default, one open at a time', () => {
    render(
      <StageBoard stages={stages} accordion label="l" emptyText="e" onOpen={() => undefined} />,
    );
    const [h1, h2] = screen.getAllByRole('button');
    expect(h1.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(h1);
    expect(h1.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(h2);
    expect(h1.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('ChoiceList / StepList / LiveWidget', () => {
  it('ChoiceList is a labelled radiogroup; description is the accessible description', () => {
    const onChange = vi.fn();
    render(
      <ChoiceList
        label="Options"
        value="a"
        onChange={onChange}
        options={[
          { id: 'a', title: 'A', description: 'does a', tag: 'Suggested' },
          { id: 'b', title: 'B', description: 'does b' },
        ]}
      />,
    );
    expect(screen.getByRole('radiogroup', { name: 'Options' })).toBeTruthy();
    const b = screen.getByRole('radio', { name: /B/ });
    expect(b.getAttribute('aria-describedby')).toBeTruthy();
    fireEvent.click(b);
    expect(onChange).toHaveBeenCalledWith('b');
  });
  it('ChoiceList locked: no radios, the chosen stays', () => {
    render(
      <ChoiceList
        label="o"
        value="a"
        locked
        onChange={() => undefined}
        options={[{ id: 'a', title: 'A', description: 'x', tag: 'Chosen' }]}
      />,
    );
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByText('Chosen')).toBeTruthy();
  });
  it('StepList is a named list', () => {
    render(
      <StepList
        label="What happens next"
        items={[{ id: 'a', icon: 'eye', title: 'T', body: 'B' }]}
      />,
    );
    expect(
      within(screen.getByRole('list', { name: 'What happens next' })).getAllByRole('listitem'),
    ).toHaveLength(1);
  });
  it('ClientRow as a signal row: selected is aria-current, text status inside the name', () => {
    render(
      <ClientRow
        name="Oleh"
        program="x"
        selected
        onClick={() => undefined}
        status="urgent"
        statusLabel="Urgent"
      />,
    );
    const b = screen.getByRole('button');
    expect(b.getAttribute('aria-current')).toBe('true');
    expect(b.textContent).toContain('Urgent');
  });
  const entries = [
    {
      id: '1',
      name: 'Taras',
      status: 'live' as const,
      detail: 'd',
      metric: '14 min',
      statusText: 'Training now',
    },
    {
      id: '2',
      name: 'Oksana',
      status: 'offline' as const,
      detail: 'd',
      metric: '26 min',
      statusText: 'Last seen 3 min ago',
    },
    {
      id: '3',
      name: 'Denys',
      status: 'finished' as const,
      detail: 'd',
      metric: '1 h',
      statusText: 'Finished',
    },
  ];
  const base = {
    pillLabel: '1 live',
    pillAria: '1 live, open the list',
    title: 'Training now',
    summary: 's',
    groupLabels: { live: 'Live now', offline: 'Offline', finished: 'Finished' },
    noneText: 'Nobody is training right now.',
    privacy: 'p',
  };
  it('LiveWidget: closed pill, open list in three groups, none, only offline', () => {
    const { rerender } = render(<LiveWidget {...base} entries={entries} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '1 live, open the list' }));
    const dlg = screen.getByRole('dialog');
    expect(
      within(dlg)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(['Live now', 'Offline', 'Finished']);
    rerender(<LiveWidget {...base} entries={[]} defaultOpen />);
    cleanup();
    render(<LiveWidget {...base} entries={[]} defaultOpen />);
    expect(screen.getByText('Nobody is training right now.')).toBeTruthy();
    cleanup();
    render(<LiveWidget {...base} entries={[entries[1]]} defaultOpen />);
    expect(screen.queryByText('Live now')).toBeNull();
    expect(screen.getByTitle('Last seen 3 min ago')).toBeTruthy();
  });
  it('LiveWidget rows: no chevron, no inner card; a row is a button only when it navigates and closes the popover', () => {
    const onOpen = vi.fn();
    render(
      <LiveWidget
        {...base}
        entries={[{ ...entries[0], onOpen, ariaLabel: 'Taras, training now' }, entries[1]]}
        defaultOpen
      />,
    );
    const dlg = screen.getByText('Taras').closest('.uilivew-panel') as HTMLElement;
    expect(dlg.querySelector('.uirow-chev')).toBeNull();
    expect(dlg.querySelector('.uigl--flat')).toBeTruthy();
    expect(dlg.querySelector('.uigl--raised')).toBeNull();
    const buttons = within(dlg).getAllByRole('button', { hidden: true });
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['Taras, training now']);
    fireEvent.click(buttons[0]);
    expect(onOpen).toHaveBeenCalled();
    expect(screen.queryByText('Taras')).toBeNull();
  });
});
