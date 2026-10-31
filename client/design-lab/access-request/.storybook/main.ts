// SPO-99 design lab: the real Coach / client stories with (1) the "please share" card swapped for the new request card,
// (2) seeded ask messages in both chat fixtures, (3) the trainer's "Ask to share" button swapped for the new request
// sheet. Nothing here ships (client/design-lab/).
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import base from '../../../.storybook/main.ts';

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const card = at('../AskCardLab.tsx');
const chips = at('../ConsentControlsLab.tsx');
const clientChat = at('../fx/clientChat.ts');
const trainerChat = at('../fx/trainerChat.ts');

function lab(): Plugin {
  return {
    name: 'spotter-access-request-lab',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || importer.includes('design-lab')) return null;
      if (/AskCard$/.test(source) && /(renderClientBody|threadExtras)\.tsx$/.test(importer)) return card;
      if (/components\/ui\/ConsentControls$/.test(source) && /Client360Overview\.tsx$/.test(importer)) return chips;
      if (/data\/__fixtures__\/chat$/.test(source) && /Client\.stories\.tsx$/.test(importer)) return clientChat;
      if (/chat\/__fixtures__\/fixtures$/.test(source) && /ShareStoryFrame\.tsx$/.test(importer)) return trainerChat;
      return null;
    },
  };
}

export default {
  ...base,
  staticDirs: [fileURLToPath(new URL('../../../public', import.meta.url))],
  stories: [
    '../../../src/coach/client/Client.stories.tsx',
    '../../../src/coach/screens/Client360.stories.tsx',
    '../../../src/coach/share/ChatShare.stories.tsx',
  ],
  viteFinal: async (cfg: unknown, opts: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c: any = await (base as any).viteFinal(cfg, opts);
    return { ...c, plugins: [lab(), ...c.plugins] };
  },
};
