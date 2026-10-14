import { ALL_OFF } from '../../../domain/consent';
import type { Consent } from '../../../domain/types';
import { C, T, makeServer, settle, type Server } from './harness';
import { makeClient, makeTrainer, type ClientSide, type TrainerSide } from './sides';

export const log = (id: string, status: 'PASS' | 'FAIL' | 'INFO', note: string) =>
  console.log(`AUDIT|${id}|${status}|${note}`);

export const firstOf = <X>(
  sub: (on: (x: X) => void, err: (e: unknown) => void) => () => void,
): Promise<X> =>
  new Promise((res, rej) => {
    let off: () => void = () => undefined;
    let done = false;
    off = sub((x) => {
      if (done) return;
      done = true;
      res(x);
      queueMicrotask(() => off());
    }, rej);
  });

export interface World {
  s: Server;
  tr: TrainerSide;
  cl: ClientSide;
  cid: string;
  token: string;
}

/** invite -> accept (client's own consent). `hello` = the client sends one chat message (the only thing that publishes the key). */
export async function linkUp(
  consent: Partial<Consent> = { totals: 'full', sets: 'effects' },
  opts: { hello?: boolean; request?: Partial<Consent> } = {},
): Promise<World> {
  const s = await makeServer();
  const tr = await makeTrainer(s);
  const cl = await makeClient(s);
  const inv = await tr.invite.create({
    name: 'Oleh',
    mode: 'app',
    request: { ...ALL_OFF, ...(opts.request ?? consent) } as Consent,
  });
  const token = inv.url!.split('/').pop()!;
  await cl.port.acceptInvite(token, { ...ALL_OFF, ...consent } as Consent);
  await settle(60);
  const cid = s.cidOf(C, T);
  if (opts.hello !== false) {
    await cl.chatClient.send(cid, { id: 'hello1', text: 'Hi coach', at: cl.fs.now() });
    await settle(40);
    await cl.book.refresh();
    await tr.book.refresh();
  }
  await tr.world.load({ signal: new AbortController().signal });
  return { s, tr, cl, cid, token };
}
export { settle };

/** Latest value a subscription delivers within `ms` (the real listeners emit a cached/empty snapshot first). */
export async function latest<X>(
  sub: (on: (x: X) => void, err: (e: unknown) => void) => () => void,
  ms = 60,
): Promise<X | undefined> {
  let v: X | undefined;
  const off = sub(
    (x) => {
      v = x;
    },
    () => undefined,
  );
  await settle(ms);
  off();
  return v;
}
