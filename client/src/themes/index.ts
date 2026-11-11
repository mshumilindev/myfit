// Loads the base look (Studio) and the files every look shares. Imported by main.tsx and Storybook, right before
// glass.css, so the cascade order matches the pre-SPO-344 build. The other looks load on demand (lazy.ts, bundles/).
import './studio.css';
import './_axes.css';
import.meta.glob('./_studio.axes.*.css', { eager: true });
import './_switch.css';
import './_studio.switch.css';
import './_studio.structure.css';
export * from './registry';
