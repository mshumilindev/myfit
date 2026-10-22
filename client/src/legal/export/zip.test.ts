import { describe, expect, it } from 'vitest';
import { crc32, dosDateTime, ZipWriter } from './zip';
import { readZip, text } from './zipRead.testutil';

describe('crc32', () => {
  it('matches the standard check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe('dosDateTime', () => {
  it('packs local date and time', () => {
    const { date, time } = dosDateTime(new Date(2026, 9, 22, 13, 45, 30));
    expect(date).toBe(((2026 - 1980) << 9) | (10 << 5) | 22);
    expect(time).toBe((13 << 11) | (45 << 5) | 15);
  });
  it('clamps years outside the DOS range', () => {
    expect(dosDateTime(new Date(1970, 0, 1)).date >> 9).toBe(0);
  });
});

describe('ZipWriter', () => {
  it('round-trips names, bytes and checksums (UTF-8 included)', () => {
    const z = new ZipWriter(new Date(2026, 9, 22));
    const bin = Uint8Array.from([0, 1, 2, 255, 254]);
    z.add('a.json', '{"x":1}');
    z.add('dir/Привіт.csv', 'a,b\n1,2\n');
    z.add('empty.txt', '');
    z.add('bin.dat', bin);
    const files = readZip(z.toParts());
    expect(files.map((f) => f.name)).toEqual(['a.json', 'dir/Привіт.csv', 'empty.txt', 'bin.dat']);
    expect(text(files[0])).toBe('{"x":1}');
    expect(text(files[1])).toBe('a,b\n1,2\n');
    expect(files[2].data.length).toBe(0);
    expect([...files[3].data]).toEqual([...bin]);
    for (const f of files) expect(f.crc).toBe(crc32(f.data));
    expect(z.count).toBe(4);
  });

  it('an empty archive is just the end record', () => {
    const parts = new ZipWriter().toParts();
    expect(parts).toHaveLength(1);
    expect(parts[0].length).toBe(22);
  });

  it('rejects duplicate and unsafe names', () => {
    const z = new ZipWriter();
    z.add('a.txt', 'x');
    expect(() => z.add('a.txt', 'y')).toThrow(/duplicate/);
    expect(() => z.add('/abs.txt', 'y')).toThrow(/bad entry name/);
    expect(() => z.add('../up.txt', 'y')).toThrow(/bad entry name/);
    expect(() => z.add('a\\b.txt', 'y')).toThrow(/bad entry name/);
    expect(() => z.add('', 'y')).toThrow(/bad entry name/);
  });

  it('produces a zip Blob of the exact size', () => {
    const z = new ZipWriter();
    z.add('a.txt', 'hello');
    const b = z.toBlob();
    expect(b.type).toBe('application/zip');
    expect(b.size).toBe(30 + 5 + 5 + 46 + 5 + 22);
  });
});
