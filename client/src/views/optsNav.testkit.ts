import { within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * The options sheet has no tabs (SPO-608): Exercise and Session are two rows at the end of "More" on
 * the set screen, each opening its own screen with a Back. Tests reach a screen the same way a person does.
 */
export async function openScope(d: HTMLElement, scope: 'Exercise' | 'Session'): Promise<void> {
  const title = new RegExp(`${scope} options`);
  if (within(d).queryByText(title)) return; // already on that screen
  const back = within(d).queryByRole('button', { name: /^Back/ });
  if (back) await userEvent.click(back); // on the other drill screen: back to the set screen first
  const rx = new RegExp(`^${scope}`);
  let row = within(d).queryByRole('button', { name: rx });
  if (!row) {
    const more = within(d).queryByRole('button', { name: /^More/ });
    if (more && more.getAttribute('aria-expanded') !== 'true') await userEvent.click(more);
    row = within(d).queryByRole('button', { name: rx });
  }
  if (!row) throw new Error(`no "${scope}" row in the options sheet`);
  await userEvent.click(row);
}
