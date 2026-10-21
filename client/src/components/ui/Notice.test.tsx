import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Notice } from './Notice';

afterEach(cleanup);

describe('Notice', () => {
  it('defaults to a neutral status strip', () => {
    render(<Notice>offline</Notice>);
    const el = screen.getByRole('status');
    expect(el.className).toContain('uinotice');
    expect(el.className).toContain('uit--neutral');
    expect(screen.getByText('offline').className).toContain('uinotice-t');
  });

  it('danger tone is an alert', () => {
    render(<Notice tone="danger">failed</Notice>);
    const el = screen.getByRole('alert');
    expect(el.className).toContain('uit--danger');
  });

  it('an explicit role wins over the tone default', () => {
    render(
      <Notice tone="danger" role="none">
        x
      </Notice>,
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('aligned and nested add their modifier classes', () => {
    const { container } = render(
      <Notice aligned nested icon="info" className="extra">
        row
      </Notice>,
    );
    const cls = (container.firstChild as HTMLElement).className;
    expect(cls).toContain('uinotice--row');
    expect(cls).toContain('uinotice--nested');
    expect(cls).toContain('extra');
  });

  it('draws the icon inline, or in a tile when aligned', () => {
    const a = render(<Notice icon="info">t</Notice>);
    expect(a.container.querySelector('.uinotice-i')).not.toBeNull();
    a.unmount();
    const b = render(
      <Notice icon="info" aligned>
        t
      </Notice>,
    );
    expect(b.container.querySelector('.uinotice-i')).toBeNull();
  });

  it('renders trail and below only when given', () => {
    const a = render(<Notice>t</Notice>);
    expect(a.container.querySelector('.uinotice-tr')).toBeNull();
    expect(a.container.querySelector('.uinotice-b')).toBeNull();
    a.unmount();
    const b = render(
      <Notice trail={<button>Retry</button>} below={<span>more</span>}>
        t
      </Notice>,
    );
    expect(screen.getByText('Retry').closest('.uinotice-tr')).not.toBeNull();
    expect(screen.getByText('more').closest('.uinotice-b')).not.toBeNull();
    b.unmount();
  });
});
