/**
 * The tray / menu bar menu as plain data (SPO-552 I8), so its content can be tested without Electron. The text of "Up next" comes
 * from the page (decrypted there); the shell only shows it. Menu labels of the shell itself are Ukrainian like the rest of main.ts.
 */
export interface TrayState {
  /** The next reminder: shown as one disabled line. */
  next: { label: string } | null;
}

export type TrayItem =
  | { kind: 'item'; id: 'open' | 'update' | 'quit'; label: string }
  | { kind: 'text'; label: string }
  | { kind: 'separator' };

const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function parseTrayState(input: unknown): TrayState {
  const n = (input as { next?: { label?: unknown } } | null)?.next;
  return {
    next:
      n && typeof n.label === 'string' && n.label.trim()
        ? { label: clip(n.label.trim(), 80) }
        : null,
  };
}

export function trayItems(state: TrayState, updateReady: boolean): TrayItem[] {
  return [
    ...(state.next
      ? [{ kind: 'text' as const, label: state.next.label }, { kind: 'separator' as const }]
      : []),
    { kind: 'item', id: 'open', label: 'Відкрити Spotter' },
    ...(updateReady
      ? [{ kind: 'item' as const, id: 'update' as const, label: 'Перезапустити й оновити' }]
      : []),
    { kind: 'separator' },
    { kind: 'item', id: 'quit', label: 'Вийти' },
  ];
}
