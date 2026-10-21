#!/usr/bin/env node
/**
 * Гард «пороги покриття лише ростуть» (SPO-47, правило в .claude/rules/tests.md).
 *
 * Порівнює coverage-блок двох vitest-конфігів (корінь і client) з підлогою `coverage-thresholds.json`:
 *   - жоден поріг не нижчий за підлогу;
 *   - жоден запис `include` з підлоги не зник (скоуп не звужується; ширший glob, що його вкриває, ок);
 *   - жодного нового запису в `exclude`, якого нема в підлозі;
 *   - сама підлога не знижена відносно бази в git (`--base <ref>`, типово HEAD).
 *
 * Конфіги — TypeScript. Їх НЕ виконуємо: читаємо через AST (пакет `typescript`) лише літерали
 * `test.coverage.{include,exclude,thresholds}`. Нелітеральне значення = помилка гарда.
 *
 * Використання:
 *   node scripts/check-coverage-thresholds.mjs                      перевірка (код виходу 1 при порушенні)
 *   node scripts/check-coverage-thresholds.mjs --update             піднімає підлогу до поточних конфігів,
 *                                                                   лише якщо ВСІ значення >= старих
 *   node scripts/check-coverage-thresholds.mjs --update --baseline-from <coverage-summary.json>
 *                                                                   оновлює й `client_full_baseline` (лише вгору)
 *   --root <dir>     читати конфіги й підлогу з іншої теки (негативні демо/тести; git-перевірка тоді пропускається)
 *   --base <ref>     з чим порівнювати підлогу (типово HEAD; у CI — база PR/попередній коміт main)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

export const FLOOR_FILE = 'coverage-thresholds.json';
export const CONFIGS = ['vitest.config.ts', 'client/vitest.config.ts'];
const METRICS = ['statements', 'branches', 'functions', 'lines'];

/** Чи вкриває шаблон `pattern` запис `entry` (збіг, `**` або префікс-тека `dir/**`). */
export function covers(pattern, entry) {
  if (pattern === entry || pattern === '**' || pattern === '**/*') return true;
  if (pattern.endsWith('/**')) return entry.startsWith(pattern.slice(0, -2));
  return false;
}

/**
 * Порівнює поточний блок з підлогою. Повертає масив повідомлень про порушення (порожній = ок).
 * `label` — що порівнюємо (ім'я конфіга або «підлога vs git»).
 */
export function compareBlock(floor, current, label) {
  const problems = [];
  const fT = floor.thresholds ?? {};
  const cT = current.thresholds ?? {};
  for (const [key, min] of Object.entries(fT)) {
    const now = cT[key];
    if (typeof min === 'number') {
      if (typeof now !== 'number') {
        problems.push(
          `${label}: поріг «thresholds.${key}» зник (підлога ${min}). Пороги можна лише піднімати.`,
        );
      } else if (now < min) {
        problems.push(
          `${label}: поріг «thresholds.${key}» знижено з ${min} до ${now}. Пороги можна лише піднімати.`,
        );
      }
    } else if (min === true && now !== true) {
      problems.push(`${label}: прапорець «thresholds.${key}» вимкнено (у підлозі true).`);
    }
  }
  const curInc = current.include ?? [];
  for (const entry of floor.include ?? []) {
    if (!curInc.some((p) => covers(p, entry))) {
      problems.push(
        `${label}: з «include» прибрано «${entry}» — скоуп покриття не можна звужувати.`,
      );
    }
  }
  const floorExc = floor.exclude ?? [];
  for (const entry of current.exclude ?? []) {
    if (!floorExc.includes(entry)) {
      problems.push(
        `${label}: до «exclude» додано «${entry}» — нові виключення заборонені без запису в Linear і рішення власника ` +
          `(тоді додай запис у ${FLOOR_FILE} окремим комітом).`,
      );
    }
  }
  return problems;
}

/** Порівнює всі конфіги підлоги з поточними. `floors`/`currents`: { [configPath]: block }. */
export function compareAll(floors, currents) {
  const problems = [];
  for (const name of Object.keys(floors)) {
    if (!currents[name]) {
      problems.push(`${name}: конфіг зник або не містить coverage-блока.`);
      continue;
    }
    problems.push(...compareBlock(floors[name], currents[name], name));
  }
  return problems;
}

/** Підлога не може бути нижчою за базу: ті самі правила, що й для конфігів (підлога = «поточне» для бази). */
export function compareFloorToBase(base, next) {
  const problems = [];
  for (const name of Object.keys(base.configs ?? {})) {
    const cur = next.configs?.[name];
    if (!cur) {
      problems.push(`${FLOOR_FILE}: з підлоги прибрано конфіг «${name}».`);
      continue;
    }
    // exclude у підлозі може лише зменшуватись; нові — заборонені так само, як у конфігах
    problems.push(...compareBlock(base.configs[name], cur, `${FLOOR_FILE} → ${name}`));
  }
  // Поріг patch-coverage (SPO-268) теж лише росте
  const bp = base.patch?.statements;
  if (typeof bp === 'number') {
    const np = next.patch?.statements;
    if (typeof np !== 'number' || np < bp)
      problems.push(
        `${FLOOR_FILE} → patch.statements: ${np ?? 'відсутній'} < ${bp} — поріг покриття патча можна лише піднімати.`,
      );
  }
  return problems;
}

/** Рішення для `--update`: або нова підлога, або список причин відмови (щось нижче за стару). */
export function planUpdate(oldFloor, currents) {
  if (oldFloor) {
    const problems = compareAll(oldFloor.configs ?? {}, currents);
    if (problems.length) return { ok: false, problems };
  }
  const configs = {};
  for (const name of CONFIGS) {
    if (currents[name]) configs[name] = normalize(currents[name]);
  }
  return { ok: true, floor: { ...(oldFloor ?? {}), configs } };
}

/** Новий client_full_baseline з coverage-summary.json; не може бути нижчим за старий. */
export function planBaseline(oldBaseline, summaryTotal) {
  const totals = {};
  for (const m of METRICS) {
    const t = summaryTotal[m];
    totals[m] = { pct: t.pct, covered: t.covered, total: t.total };
  }
  const problems = [];
  for (const m of METRICS) {
    const was = oldBaseline?.totals?.[m]?.pct;
    if (typeof was === 'number' && totals[m].pct < was) {
      problems.push(
        `client_full_baseline.totals.${m}: ${totals[m].pct}% < ${was}% — базу покриття не знижуємо.`,
      );
    }
  }
  return problems.length ? { ok: false, problems } : { ok: true, totals };
}

function normalize(block) {
  return {
    include: [...(block.include ?? [])],
    exclude: [...(block.exclude ?? [])],
    thresholds: { ...(block.thresholds ?? {}) },
  };
}

// ---------- читання конфігів без виконання (AST) ----------

function literal(node, what) {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  ) {
    return -Number(node.operand.text);
  }
  if (ts.isArrayLiteralExpression(node)) return node.elements.map((e) => literal(e, what));
  if (ts.isObjectLiteralExpression(node)) {
    const out = {};
    for (const p of node.properties) {
      if (!ts.isPropertyAssignment(p))
        throw new Error(`${what}: непідтримуваний елемент об'єкта (лише key: literal)`);
      const key = ts.isIdentifier(p.name) || ts.isStringLiteralLike(p.name) ? p.name.text : null;
      if (key === null) throw new Error(`${what}: обчислюваний ключ не підтримується`);
      out[key] = literal(p.initializer, `${what}.${key}`);
    }
    return out;
  }
  throw new Error(
    `${what}: значення не літерал (${ts.SyntaxKind[node.kind]}); гард читає конфіг без виконання`,
  );
}

function prop(obj, name) {
  return obj.properties.find((p) => ts.isPropertyAssignment(p) && p.name?.text === name)
    ?.initializer;
}

/** Повертає { include, exclude, thresholds } з test.coverage або null, якщо блока нема. */
export function readCoverageBlock(file) {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  let root = null;
  source.forEachChild((n) => {
    if (ts.isExportAssignment(n)) {
      let e = n.expression;
      if (ts.isCallExpression(e)) e = e.arguments[0]; // defineConfig({...})
      if (e && ts.isObjectLiteralExpression(e)) root = e;
    }
  });
  if (!root)
    throw new Error(
      `${file}: не знайдено «export default defineConfig({...})» з об'єктним літералом`,
    );
  const test = prop(root, 'test');
  const cov = test && ts.isObjectLiteralExpression(test) ? prop(test, 'coverage') : null;
  if (!cov || !ts.isObjectLiteralExpression(cov)) return null;
  const get = (name, fallback) => {
    const n = prop(cov, name);
    return n ? literal(n, `${file} coverage.${name}`) : fallback;
  };
  return {
    include: get('include', []),
    exclude: get('exclude', []),
    thresholds: get('thresholds', {}),
  };
}

export function readCurrent(root) {
  const out = {};
  for (const name of CONFIGS) {
    const p = join(root, name);
    if (!existsSync(p)) continue;
    const block = readCoverageBlock(p);
    if (block) out[name] = block;
  }
  return out;
}

function readFloorFromGit(root, ref) {
  try {
    const text = execFileSync('git', ['-C', root, 'show', `${ref}:${FLOOR_FILE}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ---------- CLI ----------

function arg(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

export function main(argv) {
  const here = dirname(fileURLToPath(import.meta.url));
  const customRoot = arg(argv, '--root');
  const root = resolve(customRoot ?? join(here, '..'));
  const floorPath = join(root, FLOOR_FILE);
  const update = argv.includes('--update');
  const baselineFrom = arg(argv, '--baseline-from');

  let currents;
  try {
    currents = readCurrent(root);
  } catch (e) {
    console.error(`[coverage:guard] ПОМИЛКА: ${e.message}`);
    return 1;
  }
  const oldFloor = existsSync(floorPath) ? JSON.parse(readFileSync(floorPath, 'utf8')) : null;

  if (update) {
    const plan = planUpdate(oldFloor, currents);
    if (!plan.ok) {
      console.error('[coverage:guard] --update відхилено: підлогу можна лише піднімати.');
      for (const p of plan.problems) console.error(`  - ${p}`);
      return 1;
    }
    if (baselineFrom) {
      const summary = JSON.parse(readFileSync(resolve(baselineFrom), 'utf8'));
      const b = planBaseline(plan.floor.client_full_baseline, summary.total);
      if (!b.ok) {
        console.error('[coverage:guard] --update відхилено:');
        for (const p of b.problems) console.error(`  - ${p}`);
        return 1;
      }
      plan.floor.client_full_baseline = {
        ...(plan.floor.client_full_baseline ?? {}),
        totals: b.totals,
      };
    }
    writeFileSync(floorPath, `${JSON.stringify(plan.floor, null, 2)}\n`);
    console.log(`[coverage:guard] підлогу записано: ${FLOOR_FILE}`);
    return 0;
  }

  if (!oldFloor) {
    console.error(
      `[coverage:guard] ПОМИЛКА: немає ${FLOOR_FILE}. Створи його: node scripts/check-coverage-thresholds.mjs --update`,
    );
    return 1;
  }
  const problems = compareAll(oldFloor.configs ?? {}, currents);

  if (!customRoot) {
    const ref = arg(argv, '--base') ?? 'HEAD';
    const base = readFloorFromGit(root, ref);
    if (base) problems.push(...compareFloorToBase(base, oldFloor));
    else
      console.log(
        `[coverage:guard] підлоги в ${ref} ще нема (або нема git) — порівняння з базою пропущено.`,
      );
  }

  if (problems.length) {
    console.error(
      '[coverage:guard] ПОРУШЕНО правило «пороги покриття лише ростуть» (.claude/rules/tests.md):',
    );
    for (const p of problems) console.error(`  - ${p}`);
    console.error(
      `Підняти підлогу легально: node scripts/check-coverage-thresholds.mjs --update (лише якщо всі значення >= старих).`,
    );
    return 1;
  }
  const n = Object.keys(oldFloor.configs ?? {}).length;
  console.log(`[coverage:guard] OK: ${n} конфіги не нижчі за підлогу ${FLOOR_FILE}.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
