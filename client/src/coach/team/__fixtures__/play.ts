/** Storybook `play` helpers for the team stories: open a sheet or a dialog the way a person does (never imported by app code). */
const WAIT_MS = 50;
const TRIES = 80;

/** Click the first button (or button-like row) whose text or aria-label contains `label`; waits for it to appear. */
export async function clickLabel(label: string, within?: () => ParentNode | null): Promise<void> {
  for (let i = 0; i < TRIES; i++) {
    const root = within?.() ?? document;
    const hit = [...root.querySelectorAll<HTMLElement>('button, [role="button"]')].find(
      (b) => b.textContent?.includes(label) || b.getAttribute('aria-label')?.includes(label),
    );
    if (hit) {
      hit.click();
      return;
    }
    await new Promise((r) => setTimeout(r, WAIT_MS));
  }
}

/** Click `labels` one after the other (open a sheet, then its action). */
export const clickThrough =
  (...labels: string[]) =>
  async (): Promise<void> => {
    for (const l of labels) await clickLabel(l);
  };
