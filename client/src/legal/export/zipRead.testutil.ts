/** Test-only ZIP reader: walks the central directory and returns each stored file with its recorded CRC. */
export interface ZipFile {
  name: string;
  data: Uint8Array;
  crc: number;
}

export function joinParts(parts: Uint8Array[]): Uint8Array {
  const buf = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    buf.set(p, o);
    o += p.length;
  }
  return buf;
}

export function readZip(parts: Uint8Array[]): ZipFile[] {
  const buf = joinParts(parts);
  const v = new DataView(buf.buffer);
  const end = buf.length - 22;
  if (v.getUint32(end, true) !== 0x06054b50) throw new Error('no end record');
  const n = v.getUint16(end + 10, true);
  let p = v.getUint32(end + 16, true);
  const files: ZipFile[] = [];
  for (let i = 0; i < n; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('bad central header');
    const crc = v.getUint32(p + 16, true);
    const size = v.getUint32(p + 24, true);
    const nl = v.getUint16(p + 28, true);
    const off = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nl));
    if (v.getUint32(off, true) !== 0x04034b50) throw new Error('bad local header');
    if (v.getUint16(off + 8, true) !== 0) throw new Error('not stored');
    const start = off + 30 + v.getUint16(off + 26, true);
    files.push({ name, crc, data: buf.slice(start, start + size) });
    p += 46 + nl;
  }
  return files;
}

export const text = (f: ZipFile | undefined): string => new TextDecoder().decode(f?.data);
