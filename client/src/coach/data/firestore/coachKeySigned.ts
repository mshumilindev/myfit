import type { FsApi } from './fsApi';

/** Asks the server to sign this coach's public key whenever it is missing or older than the key (key pinning). */
export function keepCoachKeySigned(fs: FsApi, uid: string): () => void {
  let busy = false;
  return fs.listenDoc(
    `coachKeys/${uid}`,
    (k) => {
      if (!k || busy) return;
      const signed =
        typeof k.sig === 'string' &&
        typeof k.signedAt === 'number' &&
        typeof k.updatedAt === 'number' &&
        k.signedAt >= k.updatedAt;
      if (signed) return;
      busy = true;
      void fs
        .call('coachKeySign', {})
        .catch(() => undefined) // offline / not deployed: the next change of the doc asks again
        .finally(() => {
          busy = false;
        });
    },
    () => undefined,
  );
}
