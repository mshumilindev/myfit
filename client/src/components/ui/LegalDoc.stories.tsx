import type { Meta, StoryObj } from '@storybook/react-vite';
import { LegalDoc, DocTable } from './LegalDoc';
import { LegalLinks } from './LegalLinks';
import { Button } from './Button';

const body = (
  <>
    <p>
      The controller of your personal data is <strong>Mykola Volodymyrovych Lukianov</strong>, a
      private individual, Bukowińska 17/1005, Warsaw, Poland.
    </p>
    <ul>
      <li>One bullet with a bit more text so that it wraps on a narrow phone screen.</li>
      <li>Another bullet.</li>
    </ul>
  </>
);

const sections = [
  { id: 's1', title: 'Who we are', body },
  {
    id: 's2',
    title: 'What data we process',
    body: (
      <DocTable
        head={['What', 'Why', 'Legal basis']}
        rows={[
          ['Account data', 'Run your account', 'Contract, Art. 6(1)(b)'],
          ['Training data', 'Provide the tracker', 'Contract, Art. 6(1)(b)'],
        ]}
      />
    ),
  },
  { id: 's3', title: 'Children', body: <p>Spotter is for people aged 18 and over.</p> },
];

const meta = {
  title: 'Kit/LegalDoc',
  component: LegalDoc,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div style={{ height: '100dvh' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    title: 'Spotter Privacy Policy',
    versionLabel: 'Version 2026-10-21',
    updatedLabel: 'Last updated 21 October 2026',
    sections,
    brand: <span className="ut-lg ut-w7">spotter</span>,
    brandLabel: 'Spotter home',
    headerEnd: (
      <Button variant="ghost" size="sm">
        EN
      </Button>
    ),
    contentsLabel: 'Contents',
    saveLabel: 'Save as PDF',
    printLabel: 'Print',
    saveHint:
      'Both buttons open your browser’s print dialog. To get a PDF, choose “Save as PDF” as the printer.',
    onPrint: () => undefined,
    footer: <LegalLinks label="Legal" privacyLabel="Privacy Policy" termsLabel="Terms of Use" />,
  },
} satisfies Meta<typeof LegalDoc>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
/** English shown for a language without its own text (lt, et). */
export const WithNote: Story = {
  args: {
    note: 'This document is available in English, Ukrainian and Polish. The English text is shown.',
  },
};
/** Back (in the app) or Close (a window the app opened) at the start of the header. */
export const WithBack: Story = { args: { backLabel: 'Back', onBack: () => undefined } };
export const LongTitles: Story = {
  args: {
    sections: [
      {
        id: 'l1',
        title:
          'Technical requirements, contract formation, complaints and everything that follows from them',
        body,
      },
      { id: 'l2', title: 'Wymagania techniczne, zawarcie umowy, reklamacje', body },
    ],
  },
};
