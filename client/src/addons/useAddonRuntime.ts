import { loadTracker } from '../trackerRt';
import { useEffect, useMemo } from 'react';
import { setAtlasInstalled } from '../atlas/aiConsent';
import { reconcileOrphanedConsentsAfter, watchAddonRemoval } from './withdrawConsents';
import { useChallenges } from '../challengesState';
import { getStoredUsage, syncSleepAutoQueue, whenAccountLoaded, whenPrefsLoaded } from '../store';
import { getRole } from '../api';
import { auth } from '../firebase';
import { migrateBrassGlass, migrateRoleAddons } from './migrateRoles';
import { setAllowedThemes } from '../themes/registry';
import { useInstalledThemeIds, useThemesOn } from '../themes/useThemeAccess';
import {
  migrateModules,
  onAddonsRemoved,
  useAddonAvailable,
  useAddonOrBase,
  useEnabledAddons,
} from './enabledSet';
import { installPack, PACK_IDS, removePack } from './packs';

/**
 * What the shell reads from the installed add-ons, plus the effects that follow an install or removal (SPO-518):
 * Apex needs no screen without it; Themes needs a second look next to the base one (themes install one by one);
 * Sleep (auto-start is part of it) rebuilds or clears the server night queue; Atlas tells the consent module and
 * withdraws consent on removal.
 */
export function useAddonRuntime() {
  // Media packs: an installed item downloads its pictures once (a little after start, so the first screen is not slowed),
  // and a removed one drops them from the cache.
  const available = useAddonAvailable();
  const packKey = PACK_IDS.filter(available).join(',');
  useEffect(() => {
    if (!packKey) return;
    const t = window.setTimeout(
      () => packKey.split(',').forEach((id) => void installPack(id)),
      3000,
    );
    return () => window.clearTimeout(t);
  }, [packKey]);
  useEffect(() => onAddonsRemoved((ids) => ids.forEach((id) => void removePack(id))), []);
  const apexOn = useAddonOrBase('apex');
  const themesOn = useThemesOn();
  const installedThemes = useInstalledThemeIds();
  const sleepOn = useAddonOrBase('sleep');
  const atlasOn = useAddonOrBase('atlas');
  const masteryOn = useAddonOrBase('mastery');
  // Challenges are an Apex module: with it off they leave the bell and the launcher count.
  const allChallenges = useChallenges();
  const challengesOn = useAddonOrBase('apex-challenges');
  const ranksOn = useAddonOrBase('apex-ranks');
  const awardsOn = useAddonOrBase('apex-awards');
  const challenges = useMemo(
    () => (challengesOn ? allChallenges : []),
    [challengesOn, allChallenges],
  );
  const alcoholOn = useAddonOrBase('alcohol');
  // The Alcohol modules are a lazy chunk fetched only while the add-on is installed (SPO-500 I8).
  useEffect(() => {
    if (alcoholOn) loadTracker('alcohol', () => import('../alcoholBoot'));
  }, [alcoholOn]);
  const nicotineOn = useAddonOrBase('nicotine');
  useEffect(() => {
    if (nicotineOn) loadTracker('nicotine', () => import('../nicotineBoot'));
  }, [nicotineOn]);
  const supplementsOn = useAddonOrBase('supplements');
  useEffect(() => {
    if (supplementsOn) loadTracker('supplements', () => import('../supplementsBoot'));
  }, [supplementsOn]);
  const cycleOn = useAddonOrBase('cycle');
  useEffect(() => {
    if (cycleOn) loadTracker('cycle', () => import('../cycleBoot'));
  }, [cycleOn]);
  const conditionsOn = useAddonOrBase('conditions');
  useEffect(() => {
    if (conditionsOn) loadTracker('conditions', () => import('../conditionsBoot'));
  }, [conditionsOn]);
  useEffect(() => {
    if (sleepOn) loadTracker('sleep', () => import('../sleepBoot'));
  }, [sleepOn]);
  // Planner is a separate lazy package: its chunk is fetched only while it is installed (addons.md item 14).
  const plannerOn = useAddonOrBase('planner');
  useEffect(() => {
    if (plannerOn) loadTracker('planner', () => import('../planner/plannerBoot'));
  }, [plannerOn]);
  // Periodization (a module of Advanced training) is a lazy chunk too: fetched only while it is installed.
  const periodizationOn = useAddonOrBase('periodization');
  useEffect(() => {
    if (periodizationOn)
      loadTracker('periodization', () => import('../periodization/periodizationBoot'));
  }, [periodizationOn]);
  // Supersets (a module of Advanced training): the pairing sheet is a lazy chunk too.
  const supersetsOn = useAddonOrBase('supersets');
  useEffect(() => {
    if (supersetsOn) loadTracker('supersets', () => import('../supersets/supersetsBoot'));
  }, [supersetsOn]);
  // Equipment (a module of Advanced training): the inventory board and the equipment picker are a lazy chunk too.
  const equipmentOn = useAddonOrBase('equipment');
  useEffect(() => {
    if (equipmentOn) loadTracker('equipment', () => import('../equipment/equipmentBoot'));
  }, [equipmentOn]);
  // Circuit (a module of Advanced training): the round screens are a lazy chunk too.
  const circuitOn = useAddonOrBase('circuit');
  useEffect(() => {
    if (circuitOn) loadTracker('circuit', () => import('../circuit/circuitBoot'));
  }, [circuitOn]);
  // RPE / RIR (a module of Advanced training): the effort entry is a lazy chunk too.
  const effortOn = useAddonOrBase('effort');
  useEffect(() => {
    if (effortOn) loadTracker('effort', () => import('../effort/effortBoot'));
  }, [effortOn]);
  // Fatigue & readiness (SPO-558): the fatigue, readiness and muscle-map pieces are a lazy chunk.
  const fatigueOn = useAddonOrBase('fatigue-readiness');
  useEffect(() => {
    if (fatigueOn) loadTracker('fatigue', () => import('../fatigue/fatigueBoot'));
  }, [fatigueOn]);
  // Set types (a module of Advanced training): drop / reverse-drop / weighted-hold editing is a lazy chunk too.
  const setTypesOn = useAddonOrBase('set-types');
  useEffect(() => {
    if (setTypesOn) loadTracker('set-types', () => import('../setTypes/setTypesBoot'));
  }, [setTypesOn]);
  const healthOn = useAddonOrBase('health');
  const injuryOn = useAddonOrBase('injury-log');
  useEffect(() => migrateModules(), []);
  // Existing trainers and admins keep what they had (once their data has loaded; the marker makes it one time).
  useEffect(
    () =>
      whenAccountLoaded(() => {
        const t = auth.currentUser?.metadata.creationTime;
        migrateRoleAddons(getRole(), getStoredUsage(), t ? Date.parse(t) : null);
      }),
    [],
  );
  useEffect(() => whenPrefsLoaded(migrateBrassGlass), []);
  useEffect(() => syncSleepAutoQueue(), [sleepOn]);
  useEffect(() => setAtlasInstalled(atlasOn), [atlasOn]);
  // SPO-571: no add-on, no consent. The person's own removal withdraws what the add-on owned; a removal made on another
  // device is caught once the list and the server's consent records are known (see addons/withdrawConsents.ts).
  useEffect(() => watchAddonRemoval(), []);
  // Re-runs when the installed list changes (a removal synced from another device while this one is open).
  const installed = useEnabledAddons();
  useEffect(() => reconcileOrphanedConsentsAfter(whenPrefsLoaded), [installed]);
  useEffect(() => setAllowedThemes(installedThemes), [installedThemes]);
  return {
    apexOn,
    masteryOn,
    ranksOn,
    awardsOn,
    challenges,
    themesOn,
    sleepOn,
    atlasOn,
    healthOn,
    injuryOn,
  };
}
