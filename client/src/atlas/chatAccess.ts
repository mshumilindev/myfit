/**
 * Closed testing for Atlas's Gemini chat: only accounts listed in the
 * Firestore doc config/atlas (chatUsers = usernames, chatUids = uids) see the
 * composer. The doc is edited in the console only (rules: read-only here); no
 * doc → nobody. Everything else Atlas does works for everyone.
 */
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { currentUid, getUsername } from '../api';

export interface ChatAccessConfig {
  chatUsers?: string[];
  chatUids?: string[];
}

export function chatAllowed(
  cfg: ChatAccessConfig | null,
  uid: string | null,
  username: string | null,
): boolean {
  if (!cfg) return false;
  const u = username?.trim().toLowerCase();
  return (
    (!!uid && (cfg.chatUids ?? []).includes(uid)) ||
    (!!u && (cfg.chatUsers ?? []).some((x) => x.trim().toLowerCase() === u))
  );
}

export function useChatAccess(): boolean {
  const [cfg, setCfg] = useState<ChatAccessConfig | null>(null);
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'config', 'atlas'),
        (snap) => setCfg(snap.exists() ? (snap.data() as ChatAccessConfig) : null),
        () => setCfg(null),
      ),
    [],
  );
  return chatAllowed(cfg, currentUid(), getUsername());
}
