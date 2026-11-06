/**
 * Which looks this person has: the base one (Brass Glass; the holiday themes are never picked by hand) plus every
 * installed theme item. The Themes screen and its button exist from two looks on — with only the base there is nothing to pick.
 */
import { useMemo } from 'react';
import { themeIdsOf, useEnabledAddons } from '../addons/enabledSet';
import { DEFAULT_THEME, PICKABLE_THEMES, type ThemeDef } from './registry';

/** The pickable themes for these installed theme ids (the base one is always among them). Pure. */
export function pickableFor(installed: readonly string[]): readonly ThemeDef[] {
  return PICKABLE_THEMES.filter((t) => t.id === DEFAULT_THEME || installed.includes(t.id));
}

export function useInstalledThemeIds(): string[] {
  const enabled = useEnabledAddons();
  const key = themeIdsOf(enabled).join(',');
  return useMemo(() => (key ? key.split(',') : []), [key]);
}

/** The themes the person can pick now. */
export function useMyThemes(): readonly ThemeDef[] {
  const ids = useInstalledThemeIds();
  return useMemo(() => pickableFor(ids), [ids]);
}

/** Two or more looks: the Themes button, screen and onboarding step exist. */
export function useThemesOn(): boolean {
  return useMyThemes().length >= 2;
}
