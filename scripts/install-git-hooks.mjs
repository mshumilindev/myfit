// Вмикає гіт-хуки репозиторію: git config core.hooksPath .githooks
// Запускається автоматично з npm-лайфциклу 'prepare' (npm install).
// Мовчки виходить, якщо це не git-репозиторій (напр., установка з архіву).
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmodSync } from 'node:fs';

try {
  if (!existsSync('.git')) {
    console.log('[hooks] .git відсутній — пропускаю встановлення хуків (зроби git init).');
    process.exit(0);
  }
  for (const hook of ['.githooks/pre-commit', '.githooks/pre-push']) {
    if (existsSync(hook)) chmodSync(hook, 0o755);
  }
  execSync('git config core.hooksPath .githooks', { stdio: 'inherit' });
  console.log('[hooks] core.hooksPath = .githooks — хуки ввімкнено.');
} catch (err) {
  console.warn('[hooks] не вдалося ввімкнути хуки:', err instanceof Error ? err.message : err);
}
