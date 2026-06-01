import { describe, expect, it } from 'vitest';
import { buildZipStored, type ZipEntry } from './zip';

const u8 = (s: string) => new TextEncoder().encode(s);

function readU16LE(buf: Uint8Array, off: number): number {
  return buf[off]! | (buf[off + 1]! << 8);
}
function readU32LE(buf: Uint8Array, off: number): number {
  return (
    (buf[off]! | (buf[off + 1]! << 8) | (buf[off + 2]! << 16) | (buf[off + 3]! << 24)) >>> 0
  );
}

function findEocd(buf: Uint8Array): number {
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (readU32LE(buf, i) === 0x06054b50) return i;
  }
  throw new Error('EOCD not found');
}

function parseEntries(zip: Uint8Array): Array<{
  name: string;
  data: Uint8Array;
  crc: number;
  method: number;
  size: number;
}> {
  const eocd = findEocd(zip);
  const cdSize = readU32LE(zip, eocd + 12);
  const cdOffset = readU32LE(zip, eocd + 16);
  const count = readU16LE(zip, eocd + 10);
  const out: Array<{ name: string; data: Uint8Array; crc: number; method: number; size: number }> =
    [];
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (readU32LE(zip, p) !== 0x02014b50) throw new Error(`bad CDH at ${p}`);
    const method = readU16LE(zip, p + 10);
    const crc = readU32LE(zip, p + 16);
    const compSize = readU32LE(zip, p + 20);
    const uncompSize = readU32LE(zip, p + 24);
    const nameLen = readU16LE(zip, p + 28);
    const extraLen = readU16LE(zip, p + 30);
    const commentLen = readU16LE(zip, p + 32);
    const localOff = readU32LE(zip, p + 42);
    const name = new TextDecoder().decode(zip.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;

    // Local file header
    if (readU32LE(zip, localOff) !== 0x04034b50) throw new Error('bad LFH');
    const lfhNameLen = readU16LE(zip, localOff + 26);
    const lfhExtraLen = readU16LE(zip, localOff + 28);
    const dataStart = localOff + 30 + lfhNameLen + lfhExtraLen;
    const data = zip.subarray(dataStart, dataStart + compSize);
    expect(compSize).toBe(uncompSize);
    out.push({ name, data, crc, method, size: uncompSize });
  }
  expect(p).toBe(cdOffset + cdSize);
  return out;
}

describe('buildZipStored', () => {
  it('produces a valid empty archive', () => {
    const zip = buildZipStored([]);
    expect(zip.length).toBe(22);
    expect(readU32LE(zip, 0)).toBe(0x06054b50);
    expect(readU16LE(zip, 10)).toBe(0); // entry count
  });

  it('round-trips a single entry', () => {
    const entry: ZipEntry = { name: 'hello.txt', data: u8('hello world') };
    const zip = buildZipStored([entry]);
    const parsed = parseEntries(zip);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.name).toBe('hello.txt');
    expect(parsed[0]!.method).toBe(0); // STORED
    expect(parsed[0]!.size).toBe(11);
    expect(new TextDecoder().decode(parsed[0]!.data)).toBe('hello world');
  });

  it('preserves multiple entries in order', () => {
    const entries: ZipEntry[] = [
      { name: '01.txt', data: u8('first') },
      { name: '02.txt', data: u8('second') },
      { name: '03.txt', data: u8('third') },
    ];
    const zip = buildZipStored(entries);
    const parsed = parseEntries(zip);
    expect(parsed.map((e) => e.name)).toEqual(['01.txt', '02.txt', '03.txt']);
    expect(parsed.map((e) => new TextDecoder().decode(e.data))).toEqual([
      'first',
      'second',
      'third',
    ]);
  });

  it('computes CRC-32 matching the known IEEE polynomial', () => {
    // "hello world" CRC-32 (IEEE) = 0x0d4a1185
    const zip = buildZipStored([{ name: 'hello.txt', data: u8('hello world') }]);
    const parsed = parseEntries(zip);
    expect(parsed[0]!.crc).toBe(0x0d4a1185);
  });

  it('CRC of empty input is 0', () => {
    const zip = buildZipStored([{ name: 'empty.bin', data: new Uint8Array(0) }]);
    const parsed = parseEntries(zip);
    expect(parsed[0]!.crc).toBe(0);
    expect(parsed[0]!.size).toBe(0);
  });

  it('handles binary payloads with high bytes', () => {
    const data = new Uint8Array(256);
    for (let i = 0; i < 256; i++) data[i] = i;
    const zip = buildZipStored([{ name: 'bytes.bin', data }]);
    const parsed = parseEntries(zip);
    expect(parsed[0]!.size).toBe(256);
    expect(Array.from(parsed[0]!.data)).toEqual(Array.from(data));
  });

  it('CDH local-header offsets point to valid LFH signatures', () => {
    const zip = buildZipStored([
      { name: 'a.txt', data: u8('aaa') },
      { name: 'b.txt', data: u8('bbbb') },
    ]);
    const eocd = findEocd(zip);
    const cdOffset = readU32LE(zip, eocd + 16);
    // first CDH
    const firstLocalOff = readU32LE(zip, cdOffset + 42);
    expect(readU32LE(zip, firstLocalOff)).toBe(0x04034b50);
    // second CDH starts after 46 + nameLen of first
    const firstNameLen = readU16LE(zip, cdOffset + 28);
    const secondCdh = cdOffset + 46 + firstNameLen;
    const secondLocalOff = readU32LE(zip, secondCdh + 42);
    expect(readU32LE(zip, secondLocalOff)).toBe(0x04034b50);
    expect(secondLocalOff).toBeGreaterThan(firstLocalOff);
  });

  it('encodes UTF-8 filenames byte-for-byte', () => {
    const name = 'café-été.txt'; // café-été.txt
    const zip = buildZipStored([{ name, data: u8('x') }]);
    const parsed = parseEntries(zip);
    expect(parsed[0]!.name).toBe(name);
  });
});
