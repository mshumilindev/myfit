import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { LEARN_ATLAS_WIDGETS } from './learnatlas';
import { widgetMatrix } from '../__fixtures__/matrix';
import { NOW, STATES, PRESETS, renderWidget, seed, setLocale } from '../__fixtures__/widgetHarness';
import type { WidgetSize } from '../../components/ui/Widget';

const byId = (id: string) => LEARN_ATLAS_WIDGETS.find((w) => w.id === id)!;
const textOf = (id: string, size: WidgetSize) =>
  renderWidget(byId(id), size).container.textContent ?? '';

widgetMatrix('learnatlas widgets', LEARN_ATLAS_WIDGETS);
widgetMatrix('learnatlas widgets (other locales)', LEARN_ATLAS_WIDGETS, {
  locales: ['uk', 'pl', 'lt', 'et'],
  scenarios: [
    ['rich', 'program'],
    ['rich', 'local'],
    ['empty', 'none'],
  ],
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  localStorage.clear();
  setLocale('en');
  PRESETS.none();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('learnatlas behaviour', () => {
  it('placeholder', () => {
    seed(STATES.empty());
    expect(textOf(LEARN_ATLAS_WIDGETS[0].id, 'M').length).toBeGreaterThan(0);
  });
});
