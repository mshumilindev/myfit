#!/usr/bin/env node
/**
 * npm run theme:new <id> "<Name>"  — scaffold a theme (SPO-344, ADR 010).
 * Copies the reference theme (client/src/themes/glass.css) to <id>.css with the selector renamed,
 * registers it in client/src/themes/registry.ts. Then edit the values; the guards check the rest
 * (theme contract, AA contrast for theme × day/night × skins).
 */
import fs from 'node:fs';

const [id, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(' ').trim();
if (!id || !name || !/^[a-z][a-z0-9-]*$/.test(id)) {
  console.error('usage: npm run theme:new <id> "<Name>"   (id: lowercase letters, digits, dashes)');
  process.exit(2);
}
const DIR = 'client/src/themes';
const target = `${DIR}/${id}.css`;
if (fs.existsSync(target)) {
  console.error(`${target} already exists`);
  process.exit(1);
}
const ref = fs.readFileSync(`${DIR}/glass.css`, 'utf8');
const body = ref
  .slice(ref.indexOf("html[data-theme='glass']"))
  .replace(/data-theme='glass'/, `data-theme='${id}'`);
fs.writeFileSync(
  target,
  `/* ${name} — theme file. Tokens only (contract: themes/contract.ts). Started from Brass Glass:\n   change the values; every token below is read by the kit, nothing else is needed. */\n${body}`,
);

const reg = `${DIR}/registry.ts`;
const src = fs.readFileSync(reg, 'utf8');
const marker = '  // theme:new inserts new themes above this line';
if (!src.includes(marker)) {
  console.error(
    `could not find the marker in ${reg}; add { id: '${id}', name: '${name}' } by hand`,
  );
  process.exit(1);
}
fs.writeFileSync(
  reg,
  src.replace(
    marker,
    `  { id: '${id}', name: '${name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}' },\n${marker}`,
  ),
);
console.log(
  `created ${target} and registered "${name}".\nNext: edit the values, then \`npx vitest run tests/theme-contract.guard.test.ts tests/contrast-matrix.guard.test.ts\`.`,
);
