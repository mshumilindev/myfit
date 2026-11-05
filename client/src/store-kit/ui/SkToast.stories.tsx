import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage } from '../stories/SkStage';
import { SkBtn } from './SkBtn';
import { SkToast, type SkToastTone } from './SkToast';
import './SkScrim.css';
import './SkSheet.stories.css';

const meta = {
  title: 'Store/SkToast',
  component: SkToast,
  args: { children: 'Health added', tone: 'info' },
  argTypes: { tone: { control: 'select', options: ['info', 'ok', 'warn', 'bad'] } },
} satisfies Meta<typeof SkToast>;
export default meta;
type Story = StoryObj<typeof meta>;

const TONES: SkToastTone[] = ['info', 'ok', 'warn', 'bad'];

/** Every tone inside a phone-sized frame (contained, so the stage keeps its layout). */
export const Tones: Story = {
  render: () => (
    <SkStage width="phone">
      {TONES.map((t) => (
        <div key={t} className="sk-scrim-host sk-toast-frame">
          <SkToast contained tone={t} onDismiss={() => {}}>
            {t === 'bad' ? 'Could not install Sleep' : 'Health added'}
          </SkToast>
        </div>
      ))}
    </SkStage>
  ),
};

export const WithActionAndLongText: Story = {
  render: () => (
    <SkStage width="phone">
      <div className="sk-scrim-host sk-toast-frame">
        <SkToast
          contained
          tone="ok"
          action={
            <SkBtn kind="ghost" size="s">
              Undo
            </SkBtn>
          }
        >
          Injury log, Cycle and Supplements were removed together with Health
        </SkToast>
      </div>
    </SkStage>
  ),
};
