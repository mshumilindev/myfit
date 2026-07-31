import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const DATA_DIR = process.env.GYM_DATA_DIR ?? path.join(os.homedir(), '.gym-tracker');

fs.mkdirSync(DATA_DIR, { recursive: true });

function loadOrCreateSecret(): string {
  if (process.env.GYM_JWT_SECRET) return process.env.GYM_JWT_SECRET;
  const secretFile = path.join(DATA_DIR, 'jwt-secret');
  try {
    return fs.readFileSync(secretFile, 'utf8').trim();
  } catch {
    const secret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretFile, secret, { mode: 0o600 });
    return secret;
  }
}

export const config = {
  port: Number(process.env.PORT ?? 4477),
  dataDir: DATA_DIR,
  dbFile: path.join(DATA_DIR, 'gym.sqlite'),
  jwtSecret: loadOrCreateSecret(),
  jwtExpiresIn: '90d' as const,
  /** Workout auto-finishes this long after it started. */
  autoFinishAfterMs: 8 * 60 * 60 * 1000,
};
