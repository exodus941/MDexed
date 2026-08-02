/* A minimal ZIP writer.
 *
 * Stored entries only — no compression. The payload here is a handful of text
 * files totalling a few hundred kilobytes, so deflate would save a moment of
 * download in exchange for a compression library and a class of bug that is
 * miserable to diagnose. Stored archives open in every unzip tool there is,
 * including Explorer and Finder.
 *
 * Format: ZIP APPNOTE 6.3.4. A local header plus data for each entry, then a
 * central directory repeating the headers, then an end-of-directory record
 * pointing at it.
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

/**
 * @param files  `{ path: contents }` — text only. Forward slashes make folders.
 * @param at     timestamp for every entry; pass one so archives are stable.
 * @returns Blob
 */
export function zip(files, at = new Date()) {
  const enc = new TextEncoder()
  const time = dosTime(at), date = dosDate(at)

  const entries = Object.entries(files).map(([path, text]) => {
    const name = enc.encode(path)
    const data = enc.encode(text)
    return { name, data, crc: crc32(data) }
  })

  const chunks = []
  const central = []
  let offset = 0

  for (const e of entries) {
    const head = new DataView(new ArrayBuffer(30))
    head.setUint32(0, 0x04034b50, true)   // local file header
    head.setUint16(4, 20, true)           // version needed
    head.setUint16(6, 0x0800, true)       // UTF-8 filenames
    head.setUint16(8, 0, true)            // stored
    head.setUint16(10, time, true)
    head.setUint16(12, date, true)
    head.setUint32(14, e.crc, true)
    head.setUint32(18, e.data.length, true)
    head.setUint32(22, e.data.length, true)
    head.setUint16(26, e.name.length, true)
    head.setUint16(28, 0, true)           // no extra field

    chunks.push(new Uint8Array(head.buffer), e.name, e.data)

    const dir = new DataView(new ArrayBuffer(46))
    dir.setUint32(0, 0x02014b50, true)    // central directory header
    dir.setUint16(4, 20, true)            // version made by
    dir.setUint16(6, 20, true)            // version needed
    dir.setUint16(8, 0x0800, true)
    dir.setUint16(10, 0, true)
    dir.setUint16(12, time, true)
    dir.setUint16(14, date, true)
    dir.setUint32(16, e.crc, true)
    dir.setUint32(20, e.data.length, true)
    dir.setUint32(24, e.data.length, true)
    dir.setUint16(28, e.name.length, true)
    dir.setUint32(42, offset, true)       // where the local header sits
    central.push(new Uint8Array(dir.buffer), e.name)

    offset += 30 + e.name.length + e.data.length
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
