import { describe, expect, it } from 'vitest';
import { APEX_WIDGET_MODULE, MASTERY_WIDGET_IDS, widgetById } from './registry';

describe('Apex module widgets', () => {
  it('every gated widget exists and is also an Apex widget', () => {
    for (const id of Object.keys(APEX_WIDGET_MODULE)) {
      expect(widgetById(id), id).toBeDefined();
      expect(MASTERY_WIDGET_IDS.has(id), id).toBe(true);
    }
  });
});
