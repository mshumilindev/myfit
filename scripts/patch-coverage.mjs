#!/usr/bin/env node
/**
 * Patch-coverage (SPO-268): покриття лише ЗМІНЕНИХ у diff виконуваних операторів client/src.
 * Повний гейт (test:coverage, coverage:guard) лишається в CI; тут — швидка відповідь «чи покрив автор свій diff».
 *
 *   node scripts/patch-coverage.mjs --run     [--base <ref>] [--budget <с>] [--min <pct>]   pre-push: related-тести з покриттям
 *   node scripts/patch-coverage.mjs --vitest-args --base <ref>   CI-шард: прапори vitest для покриття лише змінених файлів
 *   node scripts/patch-coverage.mjs --collect <dir…> [--base <ref>] [--min <pct>]          CI: звести coverage-final.json шардів
 *
 * Поріг: `patch.statements` у coverage-thresholds.json (лише росте, див. check-coverage-thresholds.mjs); --min перекриває.
 */
import { spawnSync, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Файли, що рахуються як «код продукту»: не тести, сторі, фікстури, типи, точка входу. */
export function isSourceFile(path) {
  if (!path.startsWith('client/src/')) return false;
  if (!/\.(ts|tsx)$/.test(path)) return false;
  if (/\.d\.ts$/.test(path)) return false;
  if (/\.(test|spec|stories|cases\.test)\.(ts|tsx)$/.test(path)) return false;
  if (/\/(__fixtures__|__tests__|__mocks__)\//.test(path)) return false;
  return path !== 'client/src/main.tsx';
}

/** `git diff -U0` → { 'client/src/a.ts': Set(рядки) } лише для вихідних файлів; видалені рядки не рахуємо. */
export function parseChangedLines(diff) {
  const out = {};
  let file = null;
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) {
      const p = line.slice(4).trim();
      file = p === '/dev/null' ? null : p.replace(/^b\//, '');
      if (file && !isSourceFile(file)) file = null;
      continue;
    }
    const m = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (m && file) {
      const start = Number(m[1]);
      const count = m[2] === undefined ? 1 : Number(m[2]);
      for (let i = 0; i < count; i++) (out[file] ??= new Set()).add(start + i);
    }
  }
  return out;
}

/** Зливає кілька coverage-final.json (шарди): лічильники операторів складаються. Ключ — шлях відносно кореня репо. */
export function mergeCoverage(reports, root = ROOT) {
  const merged = {};
  for (const rep of reports) {
    for (const [abs, cov] of Object.entries(rep)) {
      const key =
        abs.startsWith('/') || /^[A-Za-z]:/.test(abs)
          ? relative(root, abs).replace(/\\/g, '/')
          : abs;
      const cur = merged[key];
      if (!cur) {
        merged[key] = { statementMap: cov.statementMap, s: { ...cov.s } };
        continue;
      }
      for (const [id, n] of Object.entries(cov.s)) cur.s[id] = (cur.s[id] ?? 0) + n;
    }
  }
  return merged;
}

/**
 * Рахує покриті оператори серед змінених рядків. Оператор вважається «зміненим», якщо його ПОЧАТОК у зміненому рядку.
 * Файл без жодного запису в coverage (не завантажений тестами й не в include) = усі його змінені рядки непокриті ми
 * не знаємо → повертаємо у `missing`, виклик вирішує (CI-збір гарантує include, тож це збій конфігурації).
 */
export function evaluate(merged, changed) {
  let total = 0;
  let covered = 0;
  const uncovered = {};
  const missing = [];
  for (const [file, lines] of Object.entries(changed)) {
    const cov = merged[file];
    if (!cov) {
      missing.push(file);
      continue;
    }
    for (const [id, loc] of Object.entries(cov.statementMap)) {
      if (!lines.has(loc.start.line)) continue;
      total += 1;
      if ((cov.s[id] ?? 0) > 0) covered += 1;
      else (uncovered[file] ??= new Set()).add(loc.start.line);
    }
  }
  const pct = total === 0 ? 100 : Math.round((covered / total) * 10000) / 100;
  return { total, covered, pct, uncovered, missing };
}

export function formatReport(res, min) {
  const lines = [
    `patch-coverage: ${res.covered}/${res.total} змінених операторів покрито = ${res.pct}% (поріг ${min}%)`,
  ];
  for (const [f, set] of Object.entries(res.uncovered))
    lines.push(`  ✗ ${f}: непокриті рядки ${[...set].sort((a, b) => a - b).join(', ')}`);
  for (const f of res.missing) lines.push(`  ? ${f}: немає даних покриття (файл не в include?)`);
  return lines.join('\n');
}

export function readMin(root = ROOT) {
  try {
    const j = JSON.parse(readFileSync(join(root, 'coverage-thresholds.json'), 'utf8'));
    if (typeof j.patch?.statements === 'number') return j.patch.statements;
  } catch {
    /* fall through */
  }
  return 80;
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function findReports(dir) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...findReports(p));
    else if (n === 'coverage-final.json') out.push(p);
  }
  return out;
}

const arg = (argv, name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

function changedFor(base) {
  return parseChangedLines(
    git(['diff', '-U0', '--no-color', '--diff-filter=AM', base, '--', 'client/src']),
  );
}

function runMode(argv) {
  const base = arg(argv, '--base') ?? 'HEAD';
  const budget = Number(arg(argv, '--budget') ?? 120);
  const min = Number(arg(argv, '--min') ?? readMin());
  const changed = changedFor(base);
  // Важкі Atlas-тести пропускає швидкий крок (вони в CI), тож їхні файли тут не оцінюємо.
  for (const f of Object.keys(changed)) if (f.startsWith('client/src/atlas/')) delete changed[f];
  const files = Object.keys(changed);
  // `related` запускаємо від ВСІХ змінених файлів client/src (тести й сторі теж): змінений лише тест має бути прогнаний.
  const all = git(['diff', '--name-only', '--diff-filter=d', base, '--', 'client/src'])
    .split('\n')
    .filter(Boolean);
  if (all.length === 0) {
    console.log('patch-coverage: змін у client/src немає — пропускаю');
    return 0;
  }
  const rel = all.map((f) => f.replace(/^client\//, ''));
  const dir = mkdtempSync(join(tmpdir(), 'patchcov-'));
  try {
    console.log(
      `patch-coverage: ${all.length} змінених файл(ів), з них код продукту ${files.length}, бюджет ${budget} с, поріг ${min}%`,
    );
    const res = spawnSync(
      join(ROOT, 'node_modules/.bin/vitest'),
      [
        'related',
        ...rel,
        '--run',
        '--bail=1',
        '--maxWorkers=100%',
        '--reporter=dot',
        '--passWithNoTests',
        '--exclude',
        'src/atlas/kb.*.test.ts',
        '--exclude',
        'src/atlas/numbers.test.ts',
        '--exclude',
        'src/atlas/eval/**',
        ...vitestCoverageArgs(files, dir),
      ],
      {
        cwd: join(ROOT, 'client'),
        stdio: 'inherit',
        timeout: budget * 1000,
        killSignal: 'SIGTERM',
      },
    );
    if (res.error && res.error.code === 'ETIMEDOUT') {
      console.log(
        `[patch-coverage] бюджет ${budget} с вичерпано без червоних тестів — покриття патча оцінить CI`,
      );
      return 0;
    }
    if (res.status !== 0) return res.status ?? 1;
    const reports = findReports(dir).map((p) => JSON.parse(readFileSync(p, 'utf8')));
    return finish(evaluate(mergeCoverage(reports), changed), min);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Прапори `vitest run` для покриття лише змінених файлів (порожньо = нічого міряти). */
export function vitestCoverageArgs(files, dir = 'coverage-patch') {
  if (files.length === 0) return [];
  return [
    '--coverage.enabled',
    '--coverage.provider=v8',
    '--coverage.reporter=json',
    `--coverage.reportsDirectory=${dir}`,
    ...files.map((f) => `--coverage.include=${f.replace(/^client\//, '')}`),
    '--coverage.thresholds.statements=0',
    '--coverage.thresholds.branches=0',
    '--coverage.thresholds.functions=0',
    '--coverage.thresholds.lines=0',
  ];
}

function argsMode(argv) {
  const base = arg(argv, '--base');
  if (!base || /^0+$/.test(base)) return 0;
  try {
    console.log(vitestCoverageArgs(Object.keys(changedFor(base))).join(' '));
  } catch {
    // база недоступна (форс-пуш, нова гілка): шард біжить без покриття, зведення це побачить
  }
  return 0;
}

function collectMode(argv) {
  const baseArg = arg(argv, '--base');
  if (!baseArg || /^0+$/.test(baseArg)) {
    console.log(
      'patch-coverage: немає бази для порівняння (розклад/ручний запуск/нова гілка) — пропускаю',
    );
    return 0;
  }
  const dirs = argv.slice(argv.indexOf('--collect') + 1).filter((a) => !a.startsWith('--'));
  const base = arg(argv, '--base') ?? 'HEAD';
  const min = Number(arg(argv, '--min') ?? readMin());
  const changed = changedFor(base);
  if (Object.keys(changed).length === 0) {
    console.log('patch-coverage: змін у client/src (код продукту) немає — пропускаю');
    return 0;
  }
  const reports = dirs
    .flatMap((d) => (existsSync(d) ? findReports(d) : []))
    .map((p) => JSON.parse(readFileSync(p, 'utf8')));
  if (reports.length === 0) {
    console.error('patch-coverage: жодного coverage-final.json у', dirs.join(', '));
    return 1;
  }
  return finish(evaluate(mergeCoverage(reports), changed), min);
}

function finish(res, min) {
  console.log(formatReport(res, min));
  if (res.missing.length) return 1;
  return res.pct < min ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  if (argv.includes('--vitest-args')) process.exit(argsMode(argv));
  if (argv.includes('--collect')) process.exit(collectMode(argv));
  if (argv.includes('--run')) process.exit(runMode(argv));
  console.error(
    'usage: patch-coverage.mjs --run | --collect <dir…> [--base <ref>] [--min <pct>] [--budget <s>]',
  );
  process.exit(2);
}
