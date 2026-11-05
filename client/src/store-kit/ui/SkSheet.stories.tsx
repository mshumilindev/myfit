import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage } from '../stories/SkStage';
import { SK_ICONS } from '../icons';
import { SkBtn } from './SkBtn';
import { SkSheet, type SkSheetVariant } from './SkSheet';
import './SkScrim.css';
import './SkSheet.stories.css';

const meta = {
  title: 'Store/SkSheet',
  component: SkSheet,
  args: { open: true, onClose: () => {}, label: 'Remove Health?', children: null },
} satisfies Meta<typeof SkSheet>;
export default meta;
type Story = StoryObj<typeof meta>;

function Frame({ variant, children }: { variant: SkSheetVariant; children: ReactNode }) {
  return (
    <div className={`sk-scrim-host sk-sheet-frame sk-sheet-frame-${variant}`}>
      <div className="sk-p16 sk-t-h1">Installed</div>
      <SkSheet open onClose={() => {}} label="Dialog" variant={variant} contained>
        {children}
      </SkSheet>
    </div>
  );
}

/** Board 14: remove confirm. */
function Confirm() {
  return (
    <>
      <div className="sk-t-h2">Remove Health?</div>
      <div className="sk-t-b sk-mt16">Injury log, Cycle and Supplements are removed with it.</div>
      <div className="sk-note sk-ok sk-mt16">
        <svg className="sk-svg" viewBox="0 0 24 24" aria-hidden="true">
          <path d={SK_ICONS.check} />
        </svg>
        <div className="sk-f1">
          Your entries stay saved. They come back if you add Health again.
        </div>
      </div>
      <div className="sk-rowf sk-g12 sk-mt24">
        <SkBtn kind="ghost" className="sk-f1">
          Cancel
        </SkBtn>
        <SkBtn kind="bad" className="sk-f1">
          Remove
        </SkBtn>
      </div>
    </>
  );
}

/** Board 13: configure add-on (a title plus rows). */
function Configure() {
  return (
    <>
      <div className="sk-t-h2">Health</div>
      <div className="sk-t-s sk-mt4">Choose what to show</div>
      <div className="sk-col sk-g12 sk-mt16">
        {['Injury log', 'Cycle', 'Supplements', 'Nicotine and alcohol'].map((n) => (
          <div key={n} className="sk-rowf sk-sb">
            <span className="sk-t-b sk-b6">{n}</span>
            <SkBtn kind="tint" size="s">
              Edit
            </SkBtn>
          </div>
        ))}
      </div>
      <SkBtn kind="bad" size="l" className="sk-mt24">
        Remove Health
      </SkBtn>
    </>
  );
}

/** Mobile bottom sheet with grabber (board 14 mobile). */
export const RemoveConfirmSheet: Story = {
  render: () => (
    <SkStage width="phone">
      <Frame variant="sheet">
        <Confirm />
      </Frame>
    </SkStage>
  ),
};

/** Desktop centred modal (board 14 desktop). */
export const RemoveConfirmModal: Story = {
  render: () => (
    <SkStage width="wide" themes={['light', 'dark']}>
      <Frame variant="modal">
        <Confirm />
      </Frame>
    </SkStage>
  ),
};

/** Board 13 as a sheet. */
export const ConfigureSheet: Story = {
  render: () => (
    <SkStage width="phone">
      <Frame variant="sheet">
        <Configure />
      </Frame>
    </SkStage>
  ),
};

/** Long text must wrap, never overflow. */
export const LongText: Story = {
  render: () => (
    <SkStage width="phone">
      <Frame variant="sheet">
        <div className="sk-t-h2">
          Remove a very long add-on name that keeps going and going and going?
        </div>
        <div className="sk-t-b sk-mt16">
          Injury log, Cycle, Supplements, Nicotine and alcohol, Sleep quality and many more modules
          are removed together with it.
        </div>
      </Frame>
    </SkStage>
  ),
};

/** Interactive: real fixed overlay with focus trap (Escape closes). */
export const Playground: Story = {
  render: (args) => (
    <SkStage width="phone" themes={['light']}>
      <SkSheet {...args}>
        <Confirm />
      </SkSheet>
    </SkStage>
  ),
};
