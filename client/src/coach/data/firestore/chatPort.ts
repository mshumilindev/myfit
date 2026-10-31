/**
 * The real `ChatPort` over Firestore (plan section 10, Part C). Every document is sealed on this device
 * (`chatCodec`), AAD-bound to cid | epoch | id | sender | time and, when a signer is configured, signed with the
 * sender's device key. A document that does not authenticate is handed to the UI as `unverified` with no content.
 * No message text is ever logged, stored in the open or put in a URL.
 *
 * Both sides use this one class: the trainer lists the conversations where `trainerId == uid && active == true` (the
 * only list query the rules allow) and the client lists their own. Functions maintain `lastAt`, `lastFrom` and
 * `unread` (service.ts `recomputeConversation`), so nothing here counts or writes them.
 */
import type { Vault } from '../../../autoVault';
import type { SignerDirectory, SigningKey } from '../../chat/chatSignature';
import { openChatMessageForUi, sealChatMessage } from '../../chat/chatCodec';
import { PAGE_SIZE, type ChatPort, type MessagesMeta } from '../../chat/port';
import type { ChatMessage, ChatThread, MsgBody, MsgFrom, Unsubscribe } from '../../chat/types';
import { FS_DELETE, type FsApi, type FsRow, type Raw } from './fsApi';
import type { RingProvider } from './keyRing';

export interface FirestoreChatDeps {
  fs: FsApi;
  vault: Vault;
  uid: string;
  side: 'client' | 'trainer';
  rings: RingProvider;
  /** The device signing key. Required when `directory` is set (every message must then be signed). */
  signer?: () => Promise<Pick<SigningKey, 'kid' | 'privateKey'> | null>;
  /** Verifies the sender signature of every received message (C.2 no. 7). */
  directory?: SignerDirectory;
  /** Accept messages written before signing existed. Default false. */
  allowUnsigned?: boolean;
  /** The relationship of a conversation ended (it left the active list): forget its keys and wipe its local cache. */
  onEnded?: (cid: string) => void;
}

/** Rules accept `at` within 5 minutes of server time; a message queued longer is re-stamped at send time. */
const MAX_SKEW = 4 * 60_000;
const PREVIEW_MAX = 80;
const clip = (s: string) => (s.length > PREVIEW_MAX ? `${s.slice(0, PREVIEW_MAX - 1)}…` : s);

const FIXTURE_ALIAS = /^cid-(.+)$/;

export function createFirestoreChatPort(d: FirestoreChatDeps): ChatPort {
  const { fs, uid } = d;
  const convs = new Map<string, Raw>();
  const byClient = new Map<string, string>();

  const roleOf =
    (cid: string) =>
    (who: string): MsgFrom => {
      const c = convs.get(cid);
      return who === c?.clientId ? 'client' : who === c?.trainerId ? 'trainer' : 'system';
    };

  const remember = (cid: string, c: Raw) => {
    convs.set(cid, c);
    if (typeof c.clientId === 'string') byClient.set(c.clientId, cid);
  };

  /** A real cid, or the fixtures alias `cid-<clientId>` the schedule code still sends to (resolved by client id). */
  async function resolve(cid: string): Promise<string> {
    const m = FIXTURE_ALIAS.exec(cid);
    if (!m || cid.length === 26) return cid;
    const known = byClient.get(m[1]);
    if (known) return known;
    const rows = await fs.getDocs('conversations', {
      where:
        d.side === 'trainer'
          ? [
              ['trainerId', '==', uid],
              ['active', '==', true],
            ]
          : [['clientId', '==', uid]],
    });
    for (const r of rows) remember(r.id, r.data);
    const found = byClient.get(m[1]);
    if (!found) throw new Error('no-conversation');
    return found;
  }

  async function convOf(cid: string): Promise<Raw> {
    const c = convs.get(cid) ?? (await fs.get(`conversations/${cid}`));
    if (!c) throw new Error('no-conversation');
    remember(cid, c);
    return c;
  }

  const verifyOpts = () =>
    d.directory ? { directory: d.directory, allowUnsigned: d.allowUnsigned ?? false } : undefined;

  const opened = new Map<string, ChatMessage>();
  async function openRow(cid: string, r: FsRow): Promise<ChatMessage> {
    const raw = r.data;
    const from = roleOf(cid)(String(raw.from ?? ''));
    const at = Number.isSafeInteger(raw.at) ? (raw.at as number) : 0;
    if (raw.deleted === true)
      return {
        id: r.id,
        cid,
        from,
        at,
        body: { kind: 'unsupported' },
        deleted: true,
        state: 'sent',
      };
    const ck = `${cid}/${r.id}/${JSON.stringify((raw.enc as Raw | undefined)?.ct ?? '')}/${String(raw.sig ?? '')}`;
    const hit = opened.get(ck);
    if (hit) return hit;
    const ring = await d.rings.forEpoch(cid, Number(raw.keyEpoch)).catch(() => null);
    const m = await openChatMessageForUi(
      { vault: d.vault, ring },
      cid,
      r.id,
      raw,
      roleOf(cid),
      verifyOpts(),
    );
    if (!m.unverified) opened.set(ck, m); // a failure may be a key that arrives later: do not cache it
    return m;
  }

  const previews = new Map<string, { lastAt: number; text: string | null }>();

  const port: ChatPort = {
    now: () => fs.now(),

    subscribeThreads(listUid, onThreads, onError) {
      let stop = false;
      const seenActive = new Set<string>();
      const emit = () => {
        const threads: ChatThread[] = [...convs.entries()]
          .filter(([, c]) => c.active === true || d.side === 'client')
          .map(([cid, c]) => ({
            cid,
            clientId: String(c.clientId),
            active: c.active === true,
            lastAt: typeof c.lastAt === 'number' ? c.lastAt : null,
            lastFrom: (c.lastFrom as MsgFrom | null) ?? null,
            preview:
              previews.get(cid) && previews.get(cid)!.lastAt === c.lastAt
                ? previews.get(cid)!.text
                : null,
            unread: Number((c.unread as Record<string, number> | undefined)?.[uid] ?? 0),
            clearedBefore: Number(
              (c.clearedBefore as Record<string, number> | undefined)?.[uid] ?? 0,
            ),
          }))
          .sort((a, b) => (b.lastAt ?? 0) - (a.lastAt ?? 0));
        onThreads(threads);
      };
      const off = fs.listen(
        'conversations',
        {
          where:
            d.side === 'trainer'
              ? [
                  ['trainerId', '==', listUid],
                  ['active', '==', true],
                ]
              : [['clientId', '==', uid]],
        },
        (rows) => {
          if (stop) return;
          for (const id of [...convs.keys()]) if (!rows.some((r) => r.id === id)) convs.delete(id);
          for (const r of rows) remember(r.id, r.data);
          // a conversation that was active and no longer is: the relationship ended (R-BE-REL-7)
          const nowActive = new Set(rows.filter((r) => r.data.active === true).map((r) => r.id));
          for (const id of [...seenActive]) {
            if (nowActive.has(id)) continue;
            seenActive.delete(id);
            d.onEnded?.(id);
          }
          nowActive.forEach((id) => seenActive.add(id));
          emit();
          // previews are decrypted locally from the newest message; they never travel in the open
          for (const r of rows) {
            const lastAt = typeof r.data.lastAt === 'number' ? r.data.lastAt : null;
            if (lastAt == null || previews.get(r.id)?.lastAt === lastAt) continue;
            void fs
              .getDocs(`conversations/${r.id}/messages`, { orderBy: ['at', 'desc'], limit: 3 })
              .then(async (msgs) => {
                for (const m of msgs) {
                  if (
                    m.data.deleted === true ||
                    (m.data.del as Raw | undefined)?.state === 'pending'
                  )
                    continue;
                  const o = await openRow(r.id, m);
                  const b = o.body;
                  const text =
                    o.unverified || o.deleted
                      ? null
                      : b.kind === 'text'
                        ? clip(b.text)
                        : b.kind === 'system'
                          ? b.text
                            ? clip(b.text)
                            : null
                          : null;
                  previews.set(r.id, { lastAt, text });
                  if (!stop) emit();
                  return;
                }
              })
              .catch(() => undefined);
          }
        },
        onError,
      );
      return () => {
        stop = true;
        off();
      };
    },

    subscribeMessages(cidIn, onMessages, onError, opts) {
      let stop = false;
      const offs: Unsubscribe[] = [];
      let seq = 0;
      void resolve(cidIn)
        .then((cid) => {
          if (stop) return;
          const limit = opts?.limit ?? PAGE_SIZE;
          let rows: FsRow[] = [];
          const render = async () => {
            const mine = ++seq;
            const c = convs.get(cid) ?? {};
            const cleared = Number(
              (c.clearedBefore as Record<string, number> | undefined)?.[uid] ?? 0,
            );
            // one extra row is fetched only to know whether older messages exist; it is never shown
            const win = rows.slice(0, limit);
            const visible = win.filter(
              (r) =>
                !(Number(r.data.at) <= cleared) &&
                !((r.data.del as Raw | undefined)?.state === 'pending' && r.data.from === uid),
            );
            const list = await Promise.all(visible.map((r) => openRow(cid, r)));
            if (stop || mine !== seq) return;
            list.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
            const meta: MessagesMeta = { hasMore: rows.length > limit };
            onMessages(list, meta);
          };
          offs.push(
            fs.listenDoc(
              `conversations/${cid}`,
              (doc) => {
                if (doc) remember(cid, doc);
                void render().catch(onError);
              },
              onError,
            ),
            fs.listen(
              `conversations/${cid}/messages`,
              { orderBy: ['at', 'desc'], limit: limit + 1 },
              (r) => {
                rows = r;
                void render().catch(onError);
              },
              onError,
            ),
          );
        })
        .catch(onError);
      return () => {
        stop = true;
        offs.forEach((o) => o());
      };
    },

    async send(cidIn, draft) {
      const cid = await resolve(cidIn);
      const ring = await d.rings.current(cid);
      const signer = (await d.signer?.()) ?? null;
      if (d.directory && !signer) throw new Error('signing-key-missing');
      const now = fs.now();
      const at = now - draft.at > MAX_SKEW ? now : draft.at;
      const body: MsgBody = draft.body ?? { kind: 'text', text: draft.text };
      const doc = await sealChatMessage(
        { vault: d.vault, ring },
        { id: draft.id, fromUid: uid, at, body },
        signer ?? undefined,
      );
      const path = `conversations/${cid}/messages/${draft.id}`;
      try {
        await fs.set(path, doc);
      } catch (e) {
        // A retry of a message that already reached the server is an update the rules refuse: that is success.
        if (
          await fs.get(path).then(
            (x) => x != null,
            () => false,
          )
        )
          return;
        throw e;
      }
    },

    async markRead(cidIn) {
      const cid = await resolve(cidIn);
      const c = await convOf(cid);
      const mark = Math.max(fs.now(), Number(c.lastAt ?? 0));
      await fs.update(`conversations/${cid}`, { [`readUpTo.${uid}`]: mark });
    },

    async softDelete(cidIn, id) {
      const cid = await resolve(cidIn);
      await fs.update(`conversations/${cid}/messages/${id}`, {
        del: { state: 'pending', at: fs.now() },
      });
    },
    async undoDelete(cidIn, id) {
      const cid = await resolve(cidIn);
      await fs.update(`conversations/${cid}/messages/${id}`, { del: FS_DELETE });
    },
    async commitDelete(cidIn, id) {
      const cid = await resolve(cidIn);
      const path = `conversations/${cid}/messages/${id}`;
      const cur = await fs.get(path);
      if (!cur || cur.deleted === true) return;
      // the ciphertext is physically dropped; a stub stays for "Message deleted"
      await fs.set(path, {
        id: cur.id,
        from: cur.from,
        at: cur.at,
        v: cur.v,
        keyEpoch: cur.keyEpoch,
        // the open mirror of an access ask / answer stays, so the server pause still counts a deleted ask
        ...(typeof cur.k === 'string' ? { k: cur.k } : {}),
        ...(typeof cur.r === 'string' ? { r: cur.r } : {}),
        deleted: true,
        deletedAt: fs.now(),
      });
      opened.forEach((_, k) => k.startsWith(`${cid}/${id}/`) && opened.delete(k));
    },

    async clearChat(cidIn) {
      const cid = await resolve(cidIn);
      const c = await convOf(cid);
      const previous = Number((c.clearedBefore as Record<string, number> | undefined)?.[uid] ?? 0);
      const mark = Math.max(fs.now(), Number(c.lastAt ?? 0));
      await fs.update(`conversations/${cid}`, { [`clearedBefore.${uid}`]: mark });
      return { previous };
    },
    async undoClear(cidIn, previous) {
      const cid = await resolve(cidIn);
      await fs.update(`conversations/${cid}`, { [`clearedBefore.${uid}`]: previous });
    },
  };
  return port;
}
