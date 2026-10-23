/**
 * Stylelint for the token model (ADR 010, SPO-136). The rules only encode what
 * `.claude/rules/ui.md` already says in prose: styles read tokens, not raw values.
 * Existing violations are frozen per file and rule in `tests/stylelint-baseline.json`
 * and may only shrink (`npm run lint:css`, see scripts/stylelint-ratchet.mjs).
 * Hex colours are flagged everywhere, custom-property definitions included: ADR 010 allows raw
 * colours only in `tokens/primitives.css` (exempted below). The token definitions that still
 * hold hex today are frozen in the baseline until migration step 2 moves them there.
 * Literal px is flagged in real declarations only; a token may still be defined as `--s-4: 16px`.
 */
export default {
  overrides: [
    {
      files: ['client/src/tokens/primitives.css'],
      rules: { 'color-no-hex': null, 'function-disallowed-list': null },
    },
  ],
  rules: {
    // 1. No raw colours in declarations: use a semantic colour token.
    'color-no-hex': [
      true,
      { message: 'Raw hex colour: use a semantic --color-* token (ADR 010).' },
    ],
    // 1b. rgb()/rgba()/hsl() literals are raw colours too: primitives only (--c-<hex>-a<alpha>).
    'function-disallowed-list': [
      ['/^(rgb|rgba|hsl|hsla)$/'],
      { message: 'Raw rgb()/hsl() colour: use a --c-* primitive or a semantic token (ADR 010).' },
    ],
    // 2. No !important: raise specificity through the kit or a component token instead.
    'declaration-no-important': [
      true,
      { message: 'No !important: use a kit class or a component token (ADR 010).' },
    ],
    // 3. z-index is a --z-* token, never a literal number.
    'declaration-property-value-disallowed-list': [
      { 'z-index': ['/^-?\\d+$/'] },
      { message: 'Literal z-index: use a --z-* token (ADR 010).' },
    ],
    // 3b. Every backdrop-filter reads a --bf-* recipe (or `none`), so prefers-reduced-transparency
    //     can switch the whole blur layer off in one place (styles.css).
    'declaration-property-value-allowed-list': [
      { '/^(-webkit-)?backdrop-filter$/': ['none', '/^var\\(--(bf-|glass-backdrop)/'] },
      {
        message: 'backdrop-filter must be `none` or a --bf-* token (prefers-reduced-transparency).',
      },
    ],
    // 4. No literal px in declarations: use the --s-* / --r-* / --fs-* / --ctl-* scales.
    'declaration-property-unit-disallowed-list': [
      { '/^(?!--)/': ['px'] },
      { message: 'Literal px: use a spacing/radius/font/control token (ADR 010).' },
    ],
    // 5. Breakpoints are tokens too (custom media), not literal widths.
    'media-feature-name-value-allowed-list': [
      { '/(width|height)/': ['/^(?!.*px)/'] },
      { message: 'Literal px breakpoint: use a custom media breakpoint (ADR 010).' },
    ],
  },
};
