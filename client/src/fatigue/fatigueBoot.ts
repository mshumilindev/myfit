/**
 * Boot of the Fatigue & readiness chunk (SPO-558). Imported lazily (and only) by `addons/useAddonRuntime.ts` while the add-on is
 * installed. The pieces the screens draw (muscle fatigue, readiness, the muscle map) are handed over here step by step as they
 * leave the core; until a piece is moved the core still draws it.
 */
import { fatigueHost } from '../fatigueApi';
import { provide, trackerReady } from '../trackerRt';
import { ReadinessWidget } from './ReadinessWidget';
import { FatigueWidget } from './FatigueWidget';
import { MuscleStatePanel } from './MuscleStatePanel';
import { ReadinessLens, buildReadinessNudge } from './Readiness';

provide(fatigueHost, {
  FatigueWidget,
  ReadinessWidget,
  MuscleStatePanel,
  ReadinessLens,
  buildReadinessNudge,
});

trackerReady('fatigue');
