import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { safeEn as sf } from '../../i18n/coachSafe.en';
import { createFixturesClientPort } from './data/__fixtures__/fixtures';
import { ChatGate } from './ClientRoutes';

afterEach(cleanup);

describe('#/trainer/chat gate (verify iter 15)', () => {
  it('no trainer link: the "No trainer yet" page with a way out, not a thread skeleton that never ends', async () => {
    const onClose = vi.fn();
    render(<ChatGate onClose={onClose} port={createFixturesClientPort({ scenario: 'none' })} />);
    expect(await screen.findByText(sf.mtNoneTitle)).toBeTruthy();
    screen.getByRole('button', { name: sf.mtNoneCta }).click();
    expect(onClose).toHaveBeenCalled();
  });
});
