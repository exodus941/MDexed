/* ── The ground tint ──
 *
 * The neutral seed decides `bg`, `surface` and every border, so it — not the
 * accent — decides whether a page reads as a room with a coloured button in
 * it or as a grey slab with a foreign hue stuck on. In LIGHT that hardly
 * matters: at L 94 the eye cannot see chroma 0.005 either way. In DARK it
 * decides everything, because at L 20 to 28 a near-zero chroma is a dead grey.
 *
 * A tint is a SHORTCUT TO THE SEED, not a second source of truth. Picking one
 * writes the neutral seed's hue and chroma and holds its lightness, so the
 * swatch in the Colour panel always shows what the page renders. Editing the
 * seed afterwards leaves no tint selected, and the picker says `custom`.
 *
 * Measured with the dark chroma floor in place, holding the shipped seed's
 * L 53.4:
 *
 *   tint         seed       light surface   dark surface   accent/ground
 *   accent       hue-locked        0.0090         0.0260            5.1x
 *   cool-low     #606f7e           0.0090         0.0260            5.1x
 *   cool-vivid   #55708c           0.0160         0.0450            3.0x
 *
 * The shipped grey seed gives 0.0140 in dark and a 9.5x jump, so every tint
 * here is a step toward the ground and the accent belonging to one another.
 *
 * 250 degrees is the cool hue. It is not a preference: it is far enough from
 * every meaning band this system reserves — success 130-165, warning 62-92,
 * danger 18-40 — that a ground tinted with it cannot be read as a status. */
import { toOklchObj, fromOklch, toHex, parseColor } from './convert.js'

const COOL_HUE = 250

/* Held from the shipped neutral seed, so a tint changes hue and chroma only.
   Lightness is what the ramp's own curve is built around, and moving it here
   would slide every step. */
export const GROUND_L = 0.534

export const GROUND_TINTS = {
  accent: {
    label: 'Accent hue',
    desc: 'The ground joins the accent’s own family. Quietest, and the accent stops standing out by hue alone.',
    chroma: 0.030,
    /* null means "read the accent seed", resolved at apply time. */
    hue: null,
  },
  'cool-low': {
    label: 'Cool, low chroma',
    desc: 'A cool slate under any accent. The ground carries hue without becoming a colour.',
    chroma: 0.030,
    hue: COOL_HUE,
  },
  'cool-vivid': {
    label: 'Cool, vivid chroma',
    desc: 'A blue room. The strongest separation between the ground and the accent.',
    chroma: 0.055,
    hue: COOL_HUE,
  },
}

export const DEFAULT_GROUND_TINT = 'cool-low'

/** The hex a tint writes into the neutral seed, given the accent seed. */
export function groundSeedHex(tintName, accentHex) {
  const tint = GROUND_TINTS[tintName]
  if (!tint) return null
  let hue = tint.hue
  if (hue == null) {
    const a = toOklchObj(parseColor(accentHex) ?? '#000000')
    hue = a.h
  }
  return toHex(fromOklch({ l: GROUND_L, c: tint.chroma, h: hue }))
}

/* Which tint a neutral seed corresponds to, or 'custom'.
 *
 * Read from the SEED rather than stored beside it. A stored name and a stored
 * hex are two sources for one decision, and they disagree the first time
 * somebody edits the hex — which is exactly the state the picker has to be
 * able to show. Compared on the rendered hex, so the answer cannot drift from
 * what `groundSeedHex` would write.
 *
 * TWO TINTS CAN LAND ON ONE HEX, and the order below is what settles it. The
 * shipped accent is a blue at hue 250, which is the cool hue, so `accent` and
 * `cool-low` write the identical #606f7e for it. That is the truth rather
 * than a fault: under a blue accent the two options are one option. Checking
 * the fixed-hue tints first means the picker names the one that stays put,
 * instead of reading `accent` and then changing its own label the moment
 * somebody moves the accent seed. */
const MATCH_ORDER = ['cool-low', 'cool-vivid', 'accent']

export function groundTintOf(neutralHex, accentHex) {
  const want = toHex(parseColor(neutralHex) ?? '#000000')
  for (const name of MATCH_ORDER) {
    if (groundSeedHex(name, accentHex) === want) return name
  }
  return 'custom'
}

/** True when two tints resolve to one colour, so the UI can say so. */
export function tintsCollide(accentHex) {
  return groundSeedHex('accent', accentHex) === groundSeedHex('cool-low', accentHex)
}
