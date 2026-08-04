import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { config } from './config.js';
import { authRouter } from './auth.js';
import { adminRouter } from './admin.js';
import { trainerRouter } from './trainer.js';
import { profileRouter } from './profile.js';
import { programsRouter } from './programs.js';
import { noticesRouter } from './notices.js';
import { exercisesRouter } from './exercises.js';
import { services } from './services.js';
import { apiRateLimit } from './rate-limit.js';

export function createApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', apiRateLimit, (_req, res) => {
    res.json({ ok: true, time: Date.now() });
  });

  // Platform-level auth shared by every service.
  app.use('/api/auth', authRouter);
  // Roles (AC-ROLE): admin + trainer surfaces, own profile & avatars.
  app.use('/api/admin', adminRouter);
  app.use('/api/trainer', trainerRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/programs', programsRouter);
  app.use('/api/notices', noticesRouter);
  // Shared exercise catalog: admin/trainer-authored custom exercises.
  app.use('/api/exercises', exercisesRouter);
  // Service modules from the registry: /api/<service-id>/...
  for (const service of services) {
    for (const router of service.routers) {
      app.use(`/api/${service.id}`, router);
    }
  }

  // --- Static client (built PWA) -----------------------------------------
  const here = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = process.env.CLIENT_DIST ?? path.resolve(here, '../../client/dist');

  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    // SPA fallback for anything that's not /api
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  } else {
    console.warn(`[server] client build not found at ${clientDist} (dev mode?)`);
  }

  return app;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  createApp().listen(config.port, () => {
    console.log(`[server] listening on http://localhost:${config.port}`);
    console.log(`[server] data dir: ${config.dataDir}`);
  });
}
