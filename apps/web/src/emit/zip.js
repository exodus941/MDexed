/* A minimal ZIP writer.
 *
 * Deflated entries, using the browser's own `CompressionStream`. Measured on
 * the real payload: 335,401 bytes stored against 85,574 deflated, which is
 * about a quarter of the size.
 *
 * STORED WAS THE RIGHT ANSWER WHILE COMPRESSION MEANT A LIBRARY. This file
 * used to say so, and the reasoning held: a few hundred kilobytes is not worth
 * bundling `pako` at 45kB or `fflate` at 5kB, paid by every reader on first
 * load including the ones who never export. `CompressionStream` ships inside
 * the browser, so that price is now zero and the reason is gone.
 *
 * NO LEVEL. The API exposes none, so this is whatever the implementation
 * picks, which is around 6. Level 9 measured 84,523 against level 6's 85,574:
 * 1,051 bytes, or 1.2% of the compressed size, for 5kB of bundle. It is the
 * wrong trade in both directions.
 *
 * PER ENTRY, WHICHEVER IS SMALLER. Deflate can make a short file LARGER than
 * it started, because a stream that finds no repetition still pays for its
 * own block headers. ZIP stores the method per entry, so a file that does not
 * compress is written stored and the archive never grows.
 *
 * Format: ZIP APPNOTE 6.3.4. A local header plus data for each entry, then a
 * central directory repeating the headers, then an end-of-directory record
 * pointing at it. Method 8 is deflate, in the format since 1993 and read by
 * every unzip tool there is.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c >>> 0
  }
  return t
})()

const crc32 = bytes => {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/* MS-DOS date and time, which is what ZIP stores. Two seconds of resolution
   and an epoch of 1980 — both are the format's, not a shortcut. */
const dosTime = d => ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() / 2)) & 0xffff
const dosDate = d => (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff

const STORED = 0
const DEFLATE = 8

/* `deflate-raw` is deflate with no wrapper, which is exactly what ZIP method 8
   carries. `deflate` would add a zlib header and every tool would reject it.
 *
 * Returns null when the browser has no CompressionStream, or when the result
 * came out no smaller. The caller then stores the entry, so this never has to
 * be the reason an export fails. */
async function deflateRaw(bytes) {
  if (typeof CompressionStream === 'undefined') return null
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))
    const out = new Uint8Array(await new Response(stream).arrayBuffer())
    return out.length < bytes.length ? out : null
  } catch {
    return null
  }
}

/**
 * @param files  `{ path: contents }` — text only. Forward slashes make folders.
 * @param at     timestamp for every entry; pass one so archives are stable.
 * @returns Promise<Blob>
 */
export async function zip(files, at = new Date()) {
  const enc = new TextEncoder()
  const time = dosTime(at), date = dosDate(at)

  /* The CRC and the uncompressed size are always of the ORIGINAL bytes, in
     both headers, whichever method the entry ends up using. Taking either
     from the compressed copy produces an archive that opens and then reports
     every file as corrupt. */
  const entries = await Promise.all(Object.entries(files).map(async ([path, text]) => {
    const name = enc.encode(path)
    const data = enc.encode(text)
    const packed = await deflateRaw(data)
    return {
      name,
      body: packed ?? data,
      size: data.length,
      method: packed ? DEFLATE : STORED,
      crc: crc32(data),
    }
  }))

  const chunks = []
  const central = []
  let offset = 0

  for (const e of entries) {
    const head = new DataView(new ArrayBuffer(30))
    head.setUint32(0, 0x04034b50, true)   // local file header
    head.setUint16(4, 20, true)           // version needed
    head.setUint16(6, 0x0800, true)       // UTF-8 filenames
    head.setUint16(8, e.method, true)
    head.setUint16(10, time, true)
    head.setUint16(12, date, true)
    head.setUint32(14, e.crc, true)
    head.setUint32(18, e.body.length, true)  // compressed
    head.setUint32(22, e.size, true)         // uncompressed
    head.setUint16(26, e.name.length, true)
    head.setUint16(28, 0, true)           // no extra field

    chunks.push(new Uint8Array(head.buffer), e.name, e.body)

    const dir = new DataView(new ArrayBuffer(46))
    dir.setUint32(0, 0x02014b50, true)    // central directory header
    dir.setUint16(4, 20, true)            // version made by
    dir.setUint16(6, 20, true)            // version needed
    dir.setUint16(8, 0x0800, true)
    dir.setUint16(10, e.method, true)
    dir.setUint16(12, time, true)
    dir.setUint16(14, date, true)
    dir.setUint32(16, e.crc, true)
    dir.setUint32(20, e.body.length, true)   // compressed
    dir.setUint32(24, e.size, true)          // uncompressed
    dir.setUint16(28, e.name.length, true)
    dir.setUint32(42, offset, true)       // where the local header sits
    central.push(new Uint8Array(dir.buffer), e.name)

    offset += 30 + e.name.length + e.body.length
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)      // end of central directory
  end.setUint16(8, entries.length, true)
  end.setUint16(10, entries.length, true)
  end.setUint32(12, centralSize, true)
  end.setUint32(16, offset, true)

  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' })
}
