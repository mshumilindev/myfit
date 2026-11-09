// Loads every theme file in this folder (not `_*.css`). Imported by main.tsx and Storybook, right
// before glass.css, so the cascade order matches the pre-SPO-344 build.
import.meta.glob(['./*.css', '!./_*.css'], { eager: true });
import './_axes.css';
import.meta.glob('./_studio.axes.*.css', { eager: true });
import './_cyberpunk.structure.css';
import './_switch.css';
import './_studio.switch.css';
import './_studio.structure.css';
import './_glass.page.css';
import './_cyberpunk.route.css';
import './_halloween.structure.css';
import './_christmas.fonts.css';
import './_christmas.structure.css';
export * from './registry';
