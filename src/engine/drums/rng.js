/**
 * Small seedable PRNG with uniform + Gaussian draws (replaces numpy's
 * default_rng in the ported drum engine). Output won't match numpy bit-for-bit,
 * but the statistical behaviour the rules rely on is the same.
 */
export function makeRng(seed) {
  let s = (seed ?? Math.floor(Math.random() * 2 ** 32)) >>> 0
  const next = () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  let spare = null
  return {
    uniform(a = 0, b = 1) { return a + (b - a) * next() },
    normal(mean = 0, std = 1) {
      if (spare !== null) { const v = spare; spare = null; return mean + std * v }
      const u = Math.max(1e-12, next())
      const v = next()
      const mag = Math.sqrt(-2 * Math.log(u))
      spare = mag * Math.sin(2 * Math.PI * v)
      return mean + std * (mag * Math.cos(2 * Math.PI * v))
    },
  }
}

export const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
export const clip = (x, lo, hi) => Math.max(lo, Math.min(hi, x))
