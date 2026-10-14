/** "Fix in editor" lands on the weekday and the row a finding names: a one-shot request read by the editor on open. */
export interface EditorFocus {
  clientId: string;
  day?: number;
  itemId?: string;
}
let pending: EditorFocus | null = null;
export const requestEditorFocus = (f: EditorFocus): void => {
  pending = f;
};
export function consumeEditorFocus(clientId: string): EditorFocus | null {
  const f = pending && pending.clientId === clientId ? pending : null;
  if (f) pending = null;
  return f;
}
