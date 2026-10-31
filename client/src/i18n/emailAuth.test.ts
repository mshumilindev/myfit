import { describe, expect, it } from 'vitest';
import { EMAIL_AUTH_LOCALES, emailAuthTexts, type EmailAuthStrings } from './emailAuth';

const shape = (o: unknown): unknown =>
  typeof o === 'function'
    ? 'fn'
    : o && typeof o === 'object'
      ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, shape(v)]))
      : typeof o;

describe('email auth strings', () => {
  const en = EMAIL_AUTH_LOCALES.en;
  it.each(['uk', 'pl', 'lt', 'et'] as const)(
    '%s has the same keys as en and no empty text',
    (id) => {
      const t = EMAIL_AUTH_LOCALES[id];
      expect(shape(t)).toEqual(shape(en));
      const walk = (o: unknown): void => {
        if (typeof o === 'string') expect(o.trim()).not.toBe('');
        else if (o && typeof o === 'object') Object.values(o).forEach(walk);
      };
      walk(t);
    },
  );
  it('functions carry the address', () => {
    for (const t of Object.values(EMAIL_AUTH_LOCALES) as EmailAuthStrings[]) {
      expect(t.hintPending('a@b.co')).toContain('a@b.co');
      expect(t.gateCheckTitle('a@b.co')).toContain('a@b.co');
    }
  });
  it('falls back to en', () => {
    expect(emailAuthTexts('xx' as never)).toBe(en);
  });
});
