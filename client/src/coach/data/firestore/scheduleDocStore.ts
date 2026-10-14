/**
 * The Firestore `ScheduleDocStore` under the sealed schedule port (plan 11). Both sides use it:
 *   schedules/{clientId}                    one sealed doc per client; the trainer writes it (optimistic `rev` in a
 *                                           transaction, rules: rev == previous + 1), the client reads it.
 *   conversations/{cid}/requests/{rid}      reschedule requests. Clients can only READ them: the requester creates one
 *                                           through the `rescheduleCreate` callable (it validates the open fields, one open
 *                                           request per `slotKey`), the other party answers through `rescheduleRespond`
 *                                           (only `status` / `decidedAt` change). The server never holds a key.
 *
 * Listeners are per client (a list query on `schedules` cannot be proven by the rules, they check the relationship per
 * document), so the set follows the ring book: a new active conversation adds a listener, an ended one removes it.
 */
import type { RawDoc, RawSchedule, ScheduleDocStore, Unsubscribe } from '../../schedule/port';
import type { FsApi, Raw } from './fsApi';
import type { RingBook } from './ringBook';

export interface ScheduleDocStoreDeps {
  fs: FsApi;
  book: RingBook;
}

interface Watch {
  cid: string;
  offs: (() => void)[];
}

export function createFirestoreScheduleStore(d: ScheduleDocStoreDeps): ScheduleDocStore {
  return {
    subscribe(on, onError): Unsubscribe {
      let stop = false;
      const watches = new Map<string, Watch>();
      const sched = new Map<string, RawDoc>();
      const reqs = new Map<string, { clientId: string; raw: RawDoc }[]>();
      let scheduled = false;

      const emit = () => {
        if (stop || scheduled) return;
        scheduled = true;
        queueMicrotask(() => {
          scheduled = false;
          if (stop) return;
          const out: RawSchedule = {
            schedules: [...sched.values()],
            requests: [...reqs.values()].flat(),
          };
          on(out);
        });
      };

      const drop = (clientId: string) => {
        watches.get(clientId)?.offs.forEach((o) => o());
        watches.delete(clientId);
        sched.delete(clientId);
        reqs.delete(clientId);
      };

      const sync = () => {
        if (stop) return;
        const now = new Map(d.book.entries().map((e) => [e.clientId, e]));
        for (const id of [...watches.keys()]) {
          const cur = now.get(id);
          if (!cur || cur.cid !== watches.get(id)?.cid) drop(id);
        }
        for (const e of now.values()) {
          if (watches.has(e.clientId)) continue;
          const offs: (() => void)[] = [];
          watches.set(e.clientId, { cid: e.cid, offs });
          offs.push(
            d.fs.listenDoc(
              `schedules/${e.clientId}`,
              (doc) => {
                if (doc) sched.set(e.clientId, doc);
                else sched.delete(e.clientId);
                emit();
              },
              onError,
            ),
            d.fs.listen(
              `conversations/${e.cid}/requests`,
              {},
              (rows) => {
                reqs.set(
                  e.clientId,
                  rows.map((r) => ({
                    clientId: e.clientId,
                    raw: { ...r.data, id: r.data.id ?? r.id },
                  })),
                );
                emit();
              },
              onError,
            ),
          );
        }
        emit();
      };

      const unwatch = d.book.watch(sync);
      void d.book.ready().then(sync, onError);
      return () => {
        stop = true;
        unwatch();
        for (const id of [...watches.keys()]) drop(id);
      };
    },

    async setSchedule(clientId, raw, expectedRev) {
      const path = `schedules/${clientId}`;
      return d.fs.transact(async (tx) => {
        const cur = await tx.get(path);
        if (Number(cur?.rev ?? 0) !== expectedRev) return false;
        tx.set(path, raw as Raw);
        return true;
      });
    },

    async setRequest(clientId, id, raw) {
      // The callable validates the open fields and writes the document; it never sees the sealed content.
      await d.fs.call('rescheduleCreate', { clientId, request: { ...raw, id } });
    },

    async patchRequest(clientId, id, patch) {
      await d.fs.call('rescheduleRespond', { clientId, id, status: patch.status });
    },
  };
}
