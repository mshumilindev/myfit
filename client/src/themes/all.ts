// Every look at once: for Storybook and the audits, which show any look without the app's loader.
import './bundles/glass';
import './bundles/cyberpunk';
import './bundles/halloween';
import './bundles/christmas';
// theme:new inserts new looks above this line
import { markAllThemeCssReady } from './lazy';

markAllThemeCssReady();
