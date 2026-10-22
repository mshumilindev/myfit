/**
 * A minimal ZIP writer (SPO-295 N6): STORE only (no compression), UTF-8 names, no ZIP64. The export is JSON and CSV text of
 * one person's own data, so compression would save little and a dependency (fflate, jszip) costs bundle size and an ADR.
 * Parts are kept as separate arrays and joined by `Blob`, so the whole archive is never copied into one buffer.
 */

const MAX_ENTRIES = 0xffff;
const MAX_SIZE = 0xffffffff;

let table: Uint32Array | null = null;
function crcTable(): Uint32Array {
  if (table) return table;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  table = t;
  return t;
}

/** CRC-32 (IEEE) of `data`. */
export function crc32(data: Uint8Array): number {
  const t = crcTable();
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = t[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** MS-DOS date and time of `d` (local time, 2-second resolution, years 1980-2107). */
export function dosDateTime(d: Date): { date: number; time: number } {
  const y = Math.min(2107, Math.max(1980, d.getFullYear()));
  return {
    date: ((y - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
  };
}

interface Central {
  name: Uint8Array;
  crc: number;
  size: number;
  offset: number;
  date: number;
  time: number;
}

const enc = new TextEncoder();

export class ZipWriter {
  private parts: Uint8Array[] = [];
  private central: Central[] = [];
  private offset = 0;
  private names = new Set<string>();

  constructor(private readonly modified: Date = new Date()) {}

  get count(): number {
    return this.central.length;
  }

  /** Adds one file. `name` uses `/` and no leading slash; a duplicate or unsafe name throws. */
  add(name: string, data: Uint8Array | string): void {
    if (!name || name.startsWith('/') || name.includes('\\') || name.split('/').includes('..'))
      throw new Error(`zip: bad entry name "${name}"`);
    if (this.names.has(name)) throw new Error(`zip: duplicate entry "${name}"`);
    if (this.central.length >= MAX_ENTRIES) throw new Error('zip: too many entries');
    const bytes = typeof data === 'string' ? enc.encode(data) : data;
    const nameBytes = enc.encode(name);
    if (this.offset + bytes.length + nameBytes.length + 30 > MAX_SIZE)
      throw new Error('zip: archive too large');
    const { date, time } = dosDateTime(this.modified);
    const crc = crc32(bytes);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true); // version needed
    h.setUint16(6, 0x0800, true); // flags: UTF-8 names
    h.setUint16(8, 0, true); // method: stored
    h.setUint16(10, time, true);
    h.setUint16(12, date, true);
    h.setUint32(14, crc, true);
    h.setUint32(18, bytes.length, true);
    h.setUint32(22, bytes.length, true);
    h.setUint16(26, nameBytes.length, true);
    h.setUint16(28, 0, true);
    this.central.push({
      name: nameBytes,
      crc,
      size: bytes.length,
      offset: this.offset,
      date,
      time,
    });
    this.names.add(name);
    this.parts.push(new Uint8Array(h.buffer), nameBytes, bytes);
    this.offset += 30 + nameBytes.length + bytes.length;
  }

  private tail(): Uint8Array[] {
    const out: Uint8Array[] = [];
    let size = 0;
    for (const c of this.central) {
      const h = new DataView(new ArrayBuffer(46));
      h.setUint32(0, 0x02014b50, true);
      h.setUint16(4, 20, true); // made by
      h.setUint16(6, 20, true); // needed
      h.setUint16(8, 0x0800, true);
      h.setUint16(10, 0, true);
      h.setUint16(12, c.time, true);
      h.setUint16(14, c.date, true);
      h.setUint32(16, c.crc, true);
      h.setUint32(20, c.size, true);
      h.setUint32(24, c.size, true);
      h.setUint16(28, c.name.length, true);
      h.setUint32(42, c.offset, true);
      out.push(new Uint8Array(h.buffer), c.name);
      size += 46 + c.name.length;
    }
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true);
    e.setUint16(8, this.central.length, true);
    e.setUint16(10, this.central.length, true);
    e.setUint32(12, size, true);
    e.setUint32(16, this.offset, true);
    out.push(new Uint8Array(e.buffer));
    return out;
  }

  /** The finished archive as separate parts (tests join them). */
  toParts(): Uint8Array[] {
    return [...this.parts, ...this.tail()];
  }

  toBlob(): Blob {
    return new Blob(this.toParts() as BlobPart[], { type: 'application/zip' });
  }
}
