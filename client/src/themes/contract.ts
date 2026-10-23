/**
 * Theme contract (SPO-344, ADR 010): the tokens EVERY theme file must set on html[data-theme=<id>].
 * Source of truth is the reference theme (glass.css); tests/theme-contract.guard.test.ts fails when a
 * theme misses one, or sets a token that is not listed here. Anything not listed (accent, text
 * colours, status colours) falls back to the base palette in styles.css.
 */
export const THEME_TOKENS = [
  '--color-bg',
  '--color-surface',
  '--glass-surface',
  '--color-control',
  '--color-divider',
  '--glass-backdrop',
  '--glass-float',
  '--glass-rest-tint',
  '--glass-rest-specular',
  '--glass-well',
  '--glass-well-ring',
  '--glass-field',
  '--glass-field-ring',
  '--mood-art',
  '--mood-rest',
  '--mood-sleep',
  '--mood-ok',
  '--mood-bad',
  '--mood-night',
  '--body-dim',
  '--body-dim-stroke',
  '--radius-lg',
  '--radius-md',
  '--radius-sm',
  '--radius-hero',
  '--radius-sheet',
  '--type-d1',
  '--type-h1',
  '--type-h2',
  '--type-h3',
  '--type-b',
  '--type-s',
  '--type-m',
  '--type-l',
  '--type-num',
  '--type-hero',
  '--lava-1',
  '--lava-2',
  '--lava-3',
  '--glass-raised-base',
  '--plate-top',
  '--plate-bot',
  '--plate-rim',
  '--plate-edge',
] as const;

/**
 * Sub-app skins: `html[data-theme=<id>].theme-<skin>` blocks in the same theme file re-colour the
 * screen glow (and, for Coach, the overlay plate) per app. Every theme must cover every skin with at
 * least the REQUIRED tokens; the rest are optional overrides of the theme's own defaults.
 */
export const THEME_SKINS = ['apex', 'learn', 'roster', 'nutrition', 'coach'] as const;
export const SKIN_TOKENS_REQUIRED = ['--lava-2', '--lava-3'] as const;
export const SKIN_TOKENS_OPTIONAL = [
  '--lava-1',
  '--glass-raised-base',
  '--plate-top',
  '--plate-bot',
  '--plate-rim',
  '--plate-edge',
  '--t-base',
  '--t-tint',
  '--t-text',
  '--t-line',
  '--t-on',
] as const;
