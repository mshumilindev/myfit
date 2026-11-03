import type { Meta, StoryObj } from '@storybook/react-vite';
import { CallState } from './CallState';
import { CallScreen } from './CallScreen';
import { Notice } from './Notice';
import { Button } from './Button';

const meta = {
  title: 'Kit/CallState',
  component: CallState,
  parameters: { layout: 'fullscreen' },
  args: { icon: 'phone-disconnect', title: 'Call ended', children: null },
} satisfies Meta<typeof CallState>;
export default meta;
type Story = StoryObj<typeof meta>;

const End = (p: {
  status: string;
  icon: string;
  title: string;
  body: string;
  primary?: string;
  secondary?: string;
  steps?: string;
}) => (
  <CallScreen
    name="Anna Kovalenko"
    status={p.status}
    foot={
      <div className="uicall-end-act">
        {p.primary && <Button variant="primary">{p.primary}</Button>}
        <Button variant="secondary">{p.secondary ?? 'Close'}</Button>
      </div>
    }
  >
    <CallState name="Anna Kovalenko" icon={p.icon} title={p.title} body={p.body}>
      {p.steps && (
        <Notice tone="neutral" icon="info">
          {p.steps}
        </Notice>
      )}
    </CallState>
  </CallScreen>
);

const story = (p: Parameters<typeof End>[0]): Story => ({ render: () => <End {...p} /> });

export const EndedSummary = story({
  status: 'Call ended',
  icon: 'phone-disconnect',
  title: 'Call ended · 12:41',
  body: 'It is saved in your chat with Anna.',
  primary: 'Call again',
});
export const Declined = story({
  status: 'Declined',
  icon: 'phone-x',
  title: 'Anna declined the call',
  body: 'You can write to her in the chat.',
  primary: 'Message',
});
export const NoAnswer = story({
  status: 'No answer',
  icon: 'phone-x',
  title: 'Anna did not answer',
  body: 'She will see a missed call in the chat.',
  primary: 'Call again',
});
export const Busy = story({
  status: 'Busy',
  icon: 'phone-x',
  title: 'Anna is on another call',
  body: 'Try again in a few minutes.',
  primary: 'Call again',
});
export const Unavailable = story({
  status: 'Unavailable',
  icon: 'moon',
  title: 'Anna is not available right now',
  body: 'Leave a message in the chat; she will see it when she is back.',
  primary: 'Message',
});
export const NoAccess = story({
  status: 'Not available',
  icon: 'lock-simple',
  title: 'Calls are not available',
  body: 'You can call people you work with while your coaching link is active.',
});
export const ConnectionLost = story({
  status: 'Connection lost',
  icon: 'wifi-slash',
  title: 'The call could not continue',
  body: 'Check your connection and try again.',
  primary: 'Call again',
});
export const OfflineCannotCall = story({
  status: 'Offline',
  icon: 'cloud-slash',
  title: 'You are offline',
  body: 'Calls need an internet connection. Your chat messages will be sent when you are back online.',
});
export const PermissionAsk = story({
  status: 'Before the call',
  icon: 'microphone',
  title: 'Allow the microphone and camera',
  body: 'Spotter uses them only during a call, and never records it.',
  primary: 'Allow',
  secondary: 'Not now',
});
export const PermissionDenied = story({
  status: 'Microphone blocked',
  icon: 'microphone-slash',
  title: 'The microphone is blocked',
  body: 'Calls need the microphone. Allow it in your browser or system settings, then try again.',
  primary: 'Try again',
  steps: 'Browser: the lock icon in the address bar, Site settings, Microphone, Allow.',
});
export const NoDevice = story({
  status: 'No microphone',
  icon: 'microphone-slash',
  title: 'No microphone found',
  body: 'Connect a microphone or headset and try again.',
  primary: 'Try again',
});
export const Unsupported = story({
  status: 'Not supported',
  icon: 'warning',
  title: 'This browser cannot make calls',
  body: 'Open Spotter in an up-to-date browser, or install the app.',
});
