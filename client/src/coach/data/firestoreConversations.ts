/** Firestore adapter for the unread map. Query shape is fixed by the rules (`trainerId == uid && active == true`). */
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import type { ConversationsPort, ConversationUnreadDoc } from './unreadStore';

export const firestoreConversations: ConversationsPort = {
  subscribe(trainerUid, onDocs, onError) {
    const q = query(
      collection(db, 'conversations'),
      where('trainerId', '==', trainerUid),
      where('active', '==', true),
    );
    return onSnapshot(
      q,
      (snap) =>
        onDocs(
          snap.docs.map((d) => {
            const x = d.data();
            return {
              cid: d.id,
              clientId: String(x.clientId ?? ''),
              trainerId: String(x.trainerId ?? ''),
              active: x.active === true,
              unread: (x.unread ?? undefined) as Record<string, number> | undefined,
            } satisfies ConversationUnreadDoc;
          }),
        ),
      onError,
    );
  },
};
