// SPO-41 lab: the stock Storybook config, plus one resolver tweak — TodayView's `NudgeStack` import is
// swapped for the lab switch (?bv=NN picks a variant, ?bn=1|3|6 the number of banners). The REAL Today
// page, kit and CSS render; only the banner stack differs. Nothing here ships (client/design-lab/).
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import base from '../../../.storybook/main.ts';

const swap = fileURLToPath(new URL('../Switch.tsx', import.meta.url));

function bannerLab(): Plugin {
  return {
    name: 'spotter-banner-lab',
    enforce: 'pre',
    resolveId(source, importer) {
      if (importer && /views[\\/]TodayView\.tsx$/.test(importer) && source === '../components/NudgeStack')
        return swap;
      return null;
    },
  };
}

export default {
  ...base,
  staticDirs: [fileURLToPath(new URL('../../../public', import.meta.url))],
  stories: ['../../../src/views/TodayView.stories.tsx'],
  viteFinal: async (cfg: unknown, opts: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c: any = await (base as any).viteFinal(cfg, opts);
    return { ...c, plugins: [bannerLab(), ...c.plugins] };
  },
};
