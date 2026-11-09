/** The nine accents of Studio, in the order of the swatch grid. `light` / `dark` are what the accent is by day / by night (display only: the real values live in `_axes.css`). */
export const STUDIO_ACCENTS = [
  { id: 'titan', key: 'accentTitan', light: '#2b3640', dark: '#dbe4ec' },
  { id: 'lime', key: 'accentLime', light: '#9bd600', dark: '#c8ff2e' },
  { id: 'crimson', key: 'accentCrimson', light: '#c8102e', dark: '#ff4560' },
  { id: 'fuchsia', key: 'accentFuchsia', light: '#d4007f', dark: '#ff2daa' },
  { id: 'amber', key: 'accentAmber', light: '#9e5a00', dark: '#ffb020' },
  { id: 'olive', key: 'accentOlive', light: '#5f6b2f', dark: '#a9b36b' },
  { id: 'tiffany', key: 'accentTiffany', light: '#0abab5', dark: '#0abab5' },
  { id: 'indigo', key: 'accentIndigo', light: '#4a55d0', dark: '#8e98ff' },
  { id: 'deeppurple', key: 'accentDeepPurple', light: '#594f63', dark: '#b3a2c4' },
] as const;
export const STUDIO_DEFAULT_ACCENT = 'titan';
export type StudioAccentKey = (typeof STUDIO_ACCENTS)[number]['key'];
