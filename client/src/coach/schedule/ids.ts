/** Ids of the schedule. Random ids come from WebCrypto; `opaqueSlotKey` hides the readable date of an instance key. */
export function newId(prefix = ''): string {
  const r =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}${r}`;
}

/**
 * The open `slotKey` of a request: one opaque token per instance so rules can enforce "one open request per slot" without
 * reading a date. Two independent 32-bit FNV-1a hashes (64 bits); NOT a MAC: the key only has to be unique and opaque, it protects nothing (the date is sealed). A purpose-key HMAC would hide equal dates across clients and is an open hardening item, not a bug.
 */
export function opaqueSlotKey(instanceKey: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ instanceKey.length;
  for (let i = 0; i < instanceKey.length; i++) {
    const c = instanceKey.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ (c + i), 0x85ebca6b) >>> 0;
  }
  return `sk_${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}
