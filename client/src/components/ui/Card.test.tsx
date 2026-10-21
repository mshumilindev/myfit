import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Card } from './Card';

afterEach(cleanup);

describe('Card', () => {
  it('defaults to a neutral div with md padding and no emphasis or tone class', () => {
    render(<Card data-testid="c">body</Card>);
    const el = screen.getByTestId('c');
    expect(el.tagName).toBe('DIV');
    expect(el.className).toContain('uicard--neutral');
    expect(el.className).toContain('uicard--pad-md');
    expect(el.className).not.toContain('uit--');
    expect(el.className).not.toContain('uicard--e-');
    expect(el.className).not.toContain('uicard--selected');
  });

  it('renders as a section or as a typed button', () => {
    const onClick = vi.fn();
    const { rerender } = render(<Card as="section">x</Card>);
    expect(document.querySelector('section.uicard')).toBeTruthy();
    rerender(
      <Card as="button" onClick={onClick}>
        tap
      </Card>,
    );
    const b = screen.getByRole('button', { name: 'tap' });
    expect(b.getAttribute('type')).toBe('button');
    fireEvent.click(b);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('a disabled button card does not fire', () => {
    const onClick = vi.fn();
    render(
      <Card as="button" disabled onClick={onClick}>
        tap
      </Card>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('tone adds the tone family class', () => {
    render(
      <Card tone="danger" data-testid="c">
        x
      </Card>,
    );
    const cls = screen.getByTestId('c').className;
    expect(cls).toContain('uicard--danger');
    expect(cls).toContain('uit--danger');
  });

  it.each(['none', 'sm', 'md', 'lg'] as const)('pad %s maps to a class', (pad) => {
    render(
      <Card pad={pad} data-testid="c">
        x
      </Card>,
    );
    expect(screen.getByTestId('c').className).toContain(`uicard--pad-${pad}`);
  });

  it.each(['hero', 'glass', 'quiet'] as const)('emphasis %s maps to a class', (emphasis) => {
    render(
      <Card emphasis={emphasis} data-testid="c">
        x
      </Card>,
    );
    expect(screen.getByTestId('c').className).toContain(`uicard--e-${emphasis}`);
  });

  it('opaque, nested and selected add their modifiers; selected also takes the tone class', () => {
    render(
      <Card opaque nested selected data-testid="c">
        x
      </Card>,
    );
    const cls = screen.getByTestId('c').className;
    expect(cls).toContain('uicard--opaque');
    expect(cls).toContain('uicard--nested');
    expect(cls).toContain('uicard--selected');
    expect(cls).toContain('uit--neutral');
  });

  it('header renders above the children', () => {
    render(
      <Card header="Title" data-testid="c">
        content
      </Card>,
    );
    const el = screen.getByTestId('c');
    expect(el.firstElementChild?.className).toBe('uicard-header');
    expect(el.firstElementChild?.textContent).toBe('Title');
    expect(el.textContent).toBe('Titlecontent');
  });

  it('blend of several families takes the first as tone and paints a gradient merged with style', () => {
    render(
      <Card blend={['sport', 'rest']} style={{ margin: 4 }} data-testid="c">
        x
      </Card>,
    );
    const el = screen.getByTestId('c');
    expect(el.className).toContain('uicard--sport');
    expect(el.className).toContain('uicard--blend');
    expect(el.style.backgroundImage).toContain('linear-gradient');
    expect(el.style.margin).toBe('4px');
  });

  it('a single-family blend sets the tone without a gradient', () => {
    render(
      <Card blend={['rest']} data-testid="c">
        x
      </Card>,
    );
    const el = screen.getByTestId('c');
    expect(el.className).toContain('uicard--rest');
    expect(el.className).not.toContain('uicard--blend');
  });
});
