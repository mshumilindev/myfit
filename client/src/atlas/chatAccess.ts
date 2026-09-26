/**
 * Atlas's AI chat is open to everyone. The Firestore doc config/atlas can
 * switch it off for all (chatOff: true) — an emergency brake, edited in the
 * console only (rules: read-only here). No doc → on. Atlas's own answers
 * never depend on this; it only decides whether hard questions may go to
 * Gemini (and Puter after Gemini's daily quota).
 */
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export interface ChatAccessConfig {
  chatOff?: boolean;
}

export function chatAllowed(cfg: ChatAccessConfig | null): boolean {
  return !cfg?.chatOff;
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
  return chatAllowed(cfg);
}
