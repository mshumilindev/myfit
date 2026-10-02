import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { NicotineHubView } from './NicotineHubView';
import { NicotineProductsView } from './NicotineProductsView';
import { NicotineHealthGroup, NicotineOnboardingRow } from './NicotineSection';
import { setLocale } from '../../../i18n';
import { __getStateForTests, deleteNicotineData, saveNicotineProduct } from '../../../store';
import { newNicotineProduct } from '../../../nicotine';
import { amountText, snapAmount } from './text';

beforeEach(() => {
  setLocale('en');
  deleteNicotineData();
});
afterEach(cleanup);

const products = () => __getStateForTests().nicotine.products;
const row = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });
const save = () => screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;

describe('NicotineProductsView', () => {
  it('is a plain list of the 10 kinds (no tiles, no switches, no bottom bar)', () => {
    render(<NicotineProductsView onBack={() => undefined} />);
    const list = screen.getByLabelText('Products');
    expect(within(list).getAllByRole('button')).toHaveLength(10);
    expect(within(list).getByText('Heated tobacco')).toBeTruthy();
    expect(within(list).getByText('IQOS, glo, etc.')).toBeTruthy();
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    expect(screen.queryByText('Tiles')).toBeNull();
    expect(screen.queryByText(/Nothing selected/)).toBeNull();
    expect(list.querySelectorAll('.uirow-check')).toHaveLength(0);
  });

  it('tapping a row only opens the sheet with defaults; nothing is stored until Save', () => {
    render(<NicotineProductsView onBack={() => undefined} />);
    fireEvent.click(row('Vape'));
    expect(products()).toHaveLength(0);
    expect(screen.getByText('≈ 30 mg a day')).toBeTruthy();
    expect(save().disabled).toBe(false);
    expect(screen.queryByText('Remove this product')).toBeNull();
    fireEvent.click(screen.getByLabelText('Cancel'));
    expect(products()).toHaveLength(0);
    fireEvent.click(row('Vape'));
    fireEvent.click(save());
    expect(products()).toHaveLength(1);
    expect(products()[0]).toMatchObject({ kind: 'vape', active: true, amount: 1.5 });
  });

  it('a check appears only on a saved product, as the row trailing mark', () => {
    saveNicotineProduct(newNicotineProduct('heated', 'nic-heated'));
    render(<NicotineProductsView onBack={() => undefined} />);
    const list = screen.getByLabelText('Products');
    expect(list.querySelectorAll('.uirow-check')).toHaveLength(1);
    expect(row('Heated tobacco').querySelector('.uirow-check')).toBeTruthy();
    expect(row('Vape').querySelector('.uirow-check')).toBeNull();
    expect(within(row('Heated tobacco')).getByText('About 8 sticks a day')).toBeTruthy();
  });

  it('a saved product: Save stays disabled until something changes', () => {
    saveNicotineProduct(newNicotineProduct('vape', 'nic-vape'));
    render(<NicotineProductsView onBack={() => undefined} />);
    fireEvent.click(row('Vape'));
    expect(save().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    expect(save().disabled).toBe(false);
    expect(screen.getByText('≈ 40 mg a day')).toBeTruthy();
    fireEvent.click(save());
    expect(products()[0].amount).toBe(2);
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('strength is typed in mg; it updates the read-only total', () => {
    saveNicotineProduct(newNicotineProduct('vape', 'nic-vape'));
    render(<NicotineProductsView onBack={() => undefined} />);
    fireEvent.click(row('Vape'));
    fireEvent.change(screen.getByLabelText(/Nicotine strength/), { target: { value: '10' } });
    expect(screen.getByText('≈ 15 mg a day')).toBeTruthy();
    fireEvent.click(save());
    expect(products()[0].strengthMg).toBe(10);
  });

  it('the unit toggle keeps the real amount (packs <-> pieces)', () => {
    saveNicotineProduct(newNicotineProduct('cigarettes', 'nic-cigarettes'));
    render(<NicotineProductsView onBack={() => undefined} />);
    fireEvent.click(row('Cigarettes'));
    fireEvent.click(within(screen.getByRole('group', { name: 'Count by' })).getByText('Packs'));
    expect(
      (screen.getByRole('textbox', { name: 'About how much a day' }) as HTMLInputElement).value,
    ).toBe('0.5');
    expect(screen.getByText('≈ 10 mg a day')).toBeTruthy();
    expect(save().disabled).toBe(false);
  });

  it('From time to time hides the amount controls and keeps only the strength', () => {
    saveNicotineProduct({ ...newNicotineProduct('vape', 'nic-vape'), unit: 'pods' });
    render(<NicotineProductsView onBack={() => undefined} />);
    fireEvent.click(row('Vape'));
    expect(screen.getByRole('group', { name: 'Count by' })).toBeTruthy();
    expect(screen.getByLabelText(/Pod size/)).toBeTruthy();
    fireEvent.click(
      within(screen.getByRole('group', { name: 'How often' })).getByText('From time to time'),
    );
    expect(screen.queryByRole('group', { name: 'Count by' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: /^About how much/ })).toBeNull();
    expect(screen.queryByLabelText(/Pod size/)).toBeNull();
    expect(screen.queryByRole('group', { name: /Per week|From time to time$/ })).toBeNull();
    expect(screen.getByLabelText(/Nicotine strength/)).toBeTruthy();
    expect(screen.getByText(/Counted as a small background amount/)).toBeTruthy();
    expect(screen.getByText('≈ 0.6 mg a day')).toBeTruthy();
    fireEvent.click(save());
    expect(products()[0]).toMatchObject({ kind: 'vape', occasional: true });
    expect('perDays' in products()[0]).toBe(false);
    expect(within(row('Vape')).getByText('From time to time')).toBeTruthy();
  });

  it("toggling modes keeps the other mode's values; Every day brings the amount back", () => {
    saveNicotineProduct(newNicotineProduct('heated', 'nic-heated'));
    render(<NicotineProductsView onBack={() => undefined} />);
    fireEvent.click(row('Heated tobacco'));
    const amount = () =>
      screen.getByRole('textbox', { name: 'About how much a day' }) as HTMLInputElement;
    fireEvent.change(amount(), { target: { value: '12' } });
    fireEvent.blur(amount());
    const how = () => within(screen.getByRole('group', { name: 'How often' }));
    fireEvent.click(how().getByText('From time to time'));
    fireEvent.change(screen.getByLabelText(/Nicotine strength/), { target: { value: '3' } });
    fireEvent.click(how().getByText('Every day'));
    expect(amount().value).toBe('12');
    expect((screen.getByLabelText(/Nicotine strength/) as HTMLInputElement).value).toBe('3');
    expect(save().disabled).toBe(false);
  });

  it('a saved occasional product opens on From time to time; Save is dirty-checked', () => {
    saveNicotineProduct({ ...newNicotineProduct('pipe', 'nic-pipe'), occasional: true });
    render(<NicotineProductsView onBack={() => undefined} />);
    fireEvent.click(row('Pipe'));
    const pressed = (name: string) =>
      within(screen.getByRole('group', { name: 'How often' }))
        .getByText(name)
        .closest('button')
        ?.getAttribute('aria-pressed');
    expect(pressed('From time to time')).toBe('true');
    expect(save().disabled).toBe(true);
    fireEvent.click(
      within(screen.getByRole('group', { name: 'How often' })).getByText('Every day'),
    );
    expect(save().disabled).toBe(false);
    fireEvent.click(save());
    expect('occasional' in products()[0]).toBe(false);
    fireEvent.click(row('Pipe'));
    expect(pressed('Every day')).toBe('true');
  });

  it('Vape pods: an optional ml-per-pod field (default 2), dirty-checked, feeds mg a day', () => {
    saveNicotineProduct(newNicotineProduct('vape', 'nic-vape'));
    render(<NicotineProductsView onBack={() => undefined} />);
    fireEvent.click(row('Vape'));
    expect(screen.queryByLabelText(/Pod size/)).toBeNull();
    fireEvent.click(within(screen.getByRole('group', { name: 'Count by' })).getByText('Pods'));
    const pod = screen.getByLabelText(/Pod size/) as HTMLInputElement;
    expect(pod.value).toBe('2');
    expect(screen.getByText('Optional. Most pods hold 0.7 to 2 ml.')).toBeTruthy();
    fireEvent.change(pod, { target: { value: '1' } });
    expect(save().disabled).toBe(false);
    fireEvent.click(save());
    expect(products()[0]).toMatchObject({ unit: 'pods', mlPerPod: 1 });
    fireEvent.click(row('Vape'));
    expect((screen.getByLabelText(/Pod size/) as HTMLInputElement).value).toBe('1');
    expect(save().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Pod size/), { target: { value: '2' } });
    expect(save().disabled).toBe(false);
  });

  it('Remove (saved products only) asks first; cancel keeps it, confirm removes it', () => {
    saveNicotineProduct(newNicotineProduct('snus', 'nic-snus'));
    render(<NicotineProductsView onBack={() => undefined} />);
    fireEvent.click(row('Snus'));
    fireEvent.click(screen.getByText('Remove this product'));
    expect(screen.getByText('Remove this product?')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' }).at(-1) as HTMLElement);
    expect(products()).toHaveLength(1);
    fireEvent.click(screen.getByText('Remove this product'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(products()).toHaveLength(0);
  });
});

describe('Nicotine entry points', () => {
  it('Health group: empty hint, then the summary; opens the hub', () => {
    let opened = 0;
    const view = render(<NicotineHealthGroup onOpen={() => (opened += 1)} />);
    expect(screen.getByText('Lifestyle')).toBeTruthy();
    expect(screen.getByText('What you use, to adjust your numbers')).toBeTruthy();
    view.unmount();
    saveNicotineProduct(newNicotineProduct('vape', 'nic-vape'));
    saveNicotineProduct(newNicotineProduct('heated', 'nic-heated'));
    render(<NicotineHealthGroup onOpen={() => (opened += 1)} />);
    fireEvent.click(screen.getByText('Vape + Heated · ≈ 38 mg a day'));
    expect(opened).toBe(1);
  });

  it('hub: two rows (no privacy row any more), each opens its page', () => {
    const seen: string[] = [];
    render(<NicotineHubView onOpen={(s) => seen.push(s)} onBack={() => undefined} />);
    expect(screen.getByText('On')).toBeTruthy();
    fireEvent.click(screen.getByText('What I use'));
    fireEvent.click(screen.getByText('Use in calculations'));
    expect(seen).toEqual(['products', 'calc']);
    expect(screen.queryByText('Privacy and sharing')).toBeNull();
  });

  it('onboarding row is optional and opens What I use', () => {
    let opened = 0;
    render(<NicotineOnboardingRow onOpen={() => (opened += 1)} />);
    expect(screen.getByText('Optional')).toBeTruthy();
    fireEvent.click(screen.getByText('Nicotine'));
    expect(opened).toBe(1);
  });
});

describe('amounts the stepper can represent', () => {
  it('snapAmount rounds to the unit step and never to 0; amountText uses the stepper decimals', () => {
    expect(snapAmount(0.75, 'pods')).toBe(1);
    expect(snapAmount(0.2, 'pods')).toBe(0.5);
    expect(snapAmount(1.5, 'ml')).toBe(1.5);
    expect(snapAmount(47, 'puffs')).toBe(50);
    expect(snapAmount(0, 'ml')).toBe(0);
    expect(amountText(0.75, 'pods')).toBe('0.8');
    expect(amountText(8, 'sticks')).toBe('8');
  });

  it('switching the default vape (1.5 ml) to pods lands on 1 pod, and the list says the same as the stepper', () => {
    saveNicotineProduct(newNicotineProduct('vape', 'nic-vape'));
    render(<NicotineProductsView onBack={() => undefined} />);
    fireEvent.click(row('Vape'));
    fireEvent.click(within(screen.getByRole('group', { name: 'Count by' })).getByText('Pods'));
    expect(
      (screen.getByRole('textbox', { name: 'About how much a day' }) as HTMLInputElement).value,
    ).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(products()[0]).toMatchObject({ unit: 'pods', amount: 1 });
    expect(within(row('Vape')).getByText('About 1 pods a day')).toBeTruthy();
  });
});
