/**
 * Real WebAuthn ceremony end to end (SPO-229): Chromium with a virtual platform authenticator (CDP) runs the same
 * `@simplewebauthn/browser` calls as `client/src/accounts/passkey.ts`, against our server rules
 * (`functions/src/passkeysCore.ts`) behind a small local HTTP server with an in-memory store.
 * Not covered here (needs the deployed functions / real devices): Cloud Functions wiring, Safari, real Face ID / Touch ID.
 */
import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import {
  loginOptionsCore,
  loginVerifyCore,
  PasskeyError,
  registerOptionsCore,
  registerVerifyCore,
  type ChallengeDoc,
  type PasskeyDoc,
  type PasskeyStore,
} from '../../functions/src/passkeysCore';

const UID = 'user-olena';

type Swa = {
  startRegistration(a: { optionsJSON: unknown }): Promise<unknown>;
  startAuthentication(a: { optionsJSON: unknown }): Promise<unknown>;
};
interface Body {
  userId?: string;
  challengeId: string;
  response: RegistrationResponseJSON & AuthenticationResponseJSON;
}
const browserBundle = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../node_modules/@simplewebauthn/browser/dist/bundle/index.umd.min.js',
  ),
  'utf8',
);

const challenges = new Map<string, ChallengeDoc>();
const keys = new Map<string, PasskeyDoc>();
const store: PasskeyStore = {
  putChallenge: async (id, d) => void challenges.set(id, d),
  takeChallenge: async (id) => {
    const d = challenges.get(id) ?? null;
    challenges.delete(id);
    return d;
  },
  getPasskey: async (id) => keys.get(id) ?? null,
  savePasskey: async (id, d) => void keys.set(id, d),
  updatePasskey: async (id, p) => void keys.set(id, { ...keys.get(id)!, ...p }),
  listPasskeys: async (uid) =>
    [...keys]
      .filter(([, d]) => d.userId === uid)
      .map(([id, d]) => ({ id, transports: d.transports })),
};

let server: Server;
let origin = '';

const readBody = (req: IncomingMessage) =>
  new Promise<Body>((resolve) => {
    let s = '';
    req.on('data', (c) => (s += c));
    req.on('end', () => resolve(s ? JSON.parse(s) : {}));
  });

test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    const rp = { rpID: 'localhost', origin };
    const json = (code: number, body: unknown) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    try {
      if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end(`<!doctype html><title>passkey e2e</title><script>${browserBundle}</script>`);
        return;
      }
      const b = await readBody(req);
      const now = Date.now();
      if (req.url === '/register/options')
        return json(
          200,
          await registerOptionsCore(store, {
            uid: UID,
            userName: 'olena',
            rp,
            challengeId: randomUUID(),
            now,
          }),
        );
      if (req.url === '/register/verify') {
        await registerVerifyCore(store, {
          uid: UID,
          rp,
          challengeId: b.challengeId,
          response: b.response,
          now,
        });
        return json(200, { ok: true });
      }
      if (req.url === '/login/options')
        return json(
          200,
          await loginOptionsCore(store, {
            userId: b.userId ?? null,
            rp,
            challengeId: randomUUID(),
            now,
          }),
        );
      if (req.url === '/login/verify')
        return json(200, {
          userId: await loginVerifyCore(store, {
            rp,
            challengeId: b.challengeId,
            response: b.response,
            now,
          }),
        });
      json(404, {});
    } catch (e) {
      json(e instanceof PasskeyError ? 403 : 500, { code: (e as PasskeyError).code ?? 'internal' });
    }
  });
  await new Promise<void>((r) => server.listen(0, 'localhost', r));
  origin = `http://localhost:${(server.address() as AddressInfo).port}`;
});
test.afterAll(() => server.close());

async function virtualAuthenticator(page: Page): Promise<{ cdp: CDPSession; id: string }> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return { cdp, id: authenticatorId };
}

/** Same calls as client/src/accounts/passkey.ts, run inside the page against the local server. */
const registerInPage = (page: Page) =>
  page.evaluate(async () => {
    const post = (u: string, b?: unknown) =>
      fetch(u, { method: 'POST', body: JSON.stringify(b ?? {}) }).then((r) => r.json());
    const { challengeId, options } = await post('/register/options');
    const response = await (
      window as unknown as { SimpleWebAuthnBrowser: Swa }
    ).SimpleWebAuthnBrowser.startRegistration({
      optionsJSON: options,
    });
    return post('/register/verify', { challengeId, response });
  });

const loginInPage = (page: Page, userId: string) =>
  page.evaluate(async (uid) => {
    const post = (u: string, b?: unknown) =>
      fetch(u, { method: 'POST', body: JSON.stringify(b ?? {}) }).then((r) => r.json());
    const { challengeId, options } = await post('/login/options', { userId: uid });
    const response = await (
      window as unknown as { SimpleWebAuthnBrowser: Swa }
    ).SimpleWebAuthnBrowser.startAuthentication({
      optionsJSON: options,
    });
    const out = await post('/login/verify', { challengeId, response });
    return { out, challengeId, response };
  }, userId);

test('register once, then sign in by tapping the person: counter moves, replay is refused', async ({
  page,
}) => {
  keys.clear();
  await page.goto(origin);
  const { cdp, id } = await virtualAuthenticator(page);

  expect(await registerInPage(page)).toEqual({ ok: true });
  expect(keys.size).toBe(1);
  const { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId: id });
  expect(credentials).toHaveLength(1);
  expect(credentials[0]!.isResidentCredential).toBe(true);

  const first = await loginInPage(page, UID);
  expect(first.out).toEqual({ userId: UID });
  const credId = [...keys.keys()][0]!;
  expect(keys.get(credId)!.lastUsedAt).not.toBeNull();

  const second = await loginInPage(page, UID);
  expect(second.out).toEqual({ userId: UID });
  expect(keys.get(credId)!.counter).toBeGreaterThan(0);

  // Replaying the first assertion with its (already spent) challenge must fail.
  const replay = await page.evaluate(
    async ({ challengeId, response }) =>
      fetch('/login/verify', {
        method: 'POST',
        body: JSON.stringify({ challengeId, response }),
      }).then((r) => r.status),
    { challengeId: first.challengeId, response: first.response },
  );
  expect(replay).toBe(403);
});

test('no passkey on the device: the browser prompt fails, so the app falls back to the password', async ({
  page,
}) => {
  keys.clear();
  await page.goto(origin);
  await virtualAuthenticator(page); // empty authenticator: nothing registered
  const err = await page.evaluate(async () => {
    try {
      const r = await fetch('/login/options', { method: 'POST', body: '{}' }).then((x) => x.json());
      await (
        window as unknown as { SimpleWebAuthnBrowser: Swa }
      ).SimpleWebAuthnBrowser.startAuthentication({ optionsJSON: r.options });
      return null;
    } catch (e) {
      return (e as Error).name;
    }
  });
  expect(err).not.toBeNull();
});

test('an assertion from another origin is rejected by the server', async ({ page }) => {
  keys.clear();
  await page.goto(origin);
  await virtualAuthenticator(page);
  await registerInPage(page);
  const saved = origin;
  origin = 'http://localhost:1'; // server now expects a different origin than the page signs for
  try {
    const status = await page.evaluate(async (uid) => {
      const post = (u: string, b?: unknown) =>
        fetch(u, { method: 'POST', body: JSON.stringify(b ?? {}) });
      const { challengeId, options } = await (await post('/login/options', { userId: uid })).json();
      const response = await (
        window as unknown as { SimpleWebAuthnBrowser: Swa }
      ).SimpleWebAuthnBrowser.startAuthentication({
        optionsJSON: options,
      });
      return (await post('/login/verify', { challengeId, response })).status;
    }, UID);
    expect(status).toBe(403);
  } finally {
    origin = saved;
  }
});
